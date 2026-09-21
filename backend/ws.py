"""Hub WebSocket — Phase 05, việc 5.3.

MỘT socket duy nhất `/ws`, hai chiều: telemetry xuống, lệnh lên, box nhận diện
xuống. Hình dạng mọi message thuộc `backend/schemas.py` — file này chỉ vận
chuyển và điều phối, không định nghĩa hợp đồng.

Ba quyết định thiết kế, mỗi cái sửa một lỗi cụ thể:

1. **Một vòng broadcast cho TẤT CẢ socket**, không phải vòng-mỗi-socket như
   `app.py` bản cũ. Với một client thì như nhau; với hai tab thì vòng-mỗi-socket
   làm hai tab lệch pha và serialize hai lần cùng một dữ liệu.

2. **Message hỏng KHÔNG đóng socket.** Trả `error` rồi đi tiếp. Đóng socket vì
   một message sai chính tả là làm mất luôn telemetry — hại nhiều hơn lợi.

3. **Một người lái.** Chỉ một socket giữ quyền tại một thời điểm; Version 1
   không có cơ chế cướp quyền.
"""

from __future__ import annotations

import asyncio
import contextlib
import itertools
import json
import logging
import math
import time
from collections.abc import Awaitable, Callable

from fastapi import WebSocket, WebSocketDisconnect
from pydantic import BaseModel, ValidationError

from backend import __version__, config
from backend.events import BUS
from backend.mavlink.safety import SafetyState
from backend.mavlink.telemetry import build_telemetry, is_link_alive
from backend.schemas import (
    CONTRACT_VERSION,
    UPLINK_IMPLEMENTED_IN,
    UPLINK_MODELS,
    UPLINK_RATE_LIMITS,
    AckPayload,
    CameraStatus,
    Envelope,
    ErrorPayload,
    EventPayload,
    LimitsPayload,
    MissionStatus,
    PongPayload,
    SafetyStatus,
    StatusPayload,
    TelemetryState,
)

log = logging.getLogger(__name__)

# Trả tối đa một `rate_limited` mỗi giây cho mỗi socket — không spam ngược lại
# client đang spam ta.
_RATE_ERROR_COOLDOWN_S = 1.0

# Vòng đệm sự kiện chờ đẩy ra socket. Đầy thì bỏ cái cũ nhất: thà mất một dòng
# log còn hơn chặn thread telemetry.
_EVENT_QUEUE_MAX = 256


def frame(type_: str, data: BaseModel | dict | None = None) -> dict:
    """Bọc `data` vào phong bì hợp đồng. Chiều xuống không có `id`."""
    payload = data.model_dump() if isinstance(data, BaseModel) else dict(data or {})
    return {"v": CONTRACT_VERSION, "type": type_, "ts": time.time(), "data": payload}


class _TokenBucket:
    """Giới hạn nhịp cho một (socket, type). Cho phép bùng `rate` cái rồi giữ
    đều `rate`/giây — dễ chịu hơn kiểu ép khoảng cách tối thiểu cứng nhắc."""

    __slots__ = ("_capacity", "_rate", "_tokens", "_updated")

    def __init__(self, rate: float) -> None:
        self._rate = rate
        self._capacity = float(max(1, math.ceil(rate)))
        self._tokens = self._capacity
        self._updated = time.monotonic()

    def allow(self, now: float | None = None) -> bool:
        timestamp = time.monotonic() if now is None else now
        self._tokens = min(self._capacity, self._tokens + (timestamp - self._updated) * self._rate)
        self._updated = timestamp
        if self._tokens < 1.0:
            return False
        self._tokens -= 1.0
        return True


class _Client:
    """Những gì hub nhớ về một socket."""

    __slots__ = ("buckets", "dead", "last_rate_error", "socket_id", "ws")

    def __init__(self, socket_id: str, ws: WebSocket) -> None:
        self.socket_id = socket_id
        self.ws = ws
        self.buckets: dict[str, _TokenBucket] = {}
        self.last_rate_error = 0.0
        # Gửi hỏng một lần là socket coi như chết. `receive_loop` kiểm cờ này
        # để không xử lý tiếp lệnh của một socket mà ta không trả lời được.
        self.dead = False

    def allow(self, type_: str) -> bool:
        rate = UPLINK_RATE_LIMITS.get(type_)
        if rate is None:
            return True
        bucket = self.buckets.get(type_)
        if bucket is None:
            bucket = self.buckets[type_] = _TokenBucket(rate)
        return bucket.allow()


Handler = Callable[["WebSocketHub", str, Envelope, BaseModel], Awaitable[None]]


class WebSocketHub:
    """Giữ danh sách socket, broadcast, và điều phối lệnh chiều lên."""

    def __init__(
        self,
        state: TelemetryState,
        safety: SafetyState,
        bus=BUS,
    ) -> None:
        self.state = state
        self.safety = safety
        self.bus = bus

        self._clients: dict[str, _Client] = {}
        self._seq = itertools.count(1)

        # Socket đang giữ quyền lái, hoặc None. Chỉ sửa trên event loop.
        self.web_control_owner: str | None = None

        # Cả hai chỉ có giá trị khi đang chạy — xem `start_background`.
        self._events: asyncio.Queue[EventPayload] | None = None
        self._loop: asyncio.AbstractEventLoop | None = None
        self._tasks: list[asyncio.Task] = []

        # Ảnh chụp trạng thái lần trước, để chỉ broadcast `status` KHI CÓ ĐỔI.
        self._last_mode: str | None = None
        self._last_link_alive: bool | None = None

    # -- vòng đời socket ----------------------------------------------------
    async def connect(self, ws: WebSocket) -> str:
        await ws.accept()
        socket_id = f"s-{next(self._seq)}"
        self._clients[socket_id] = _Client(socket_id, ws)
        log.info("WebSocket %s mở (tổng %d)", socket_id, len(self._clients))
        # Gửi status NGAY, trước cả telemetry: tab mới mở phải biết giới hạn an
        # toàn và ai đang giữ quyền lái trước khi vẽ bất cứ thứ gì.
        await self.send_to(socket_id, "status", self.build_status())
        for event in self.bus.recent(limit=50):
            await self.send_to(socket_id, "event", event)
        return socket_id

    async def disconnect(self, socket_id: str) -> None:
        client = self._clients.pop(socket_id, None)
        if client is not None:
            client.dead = True
        if self.web_control_owner == socket_id:
            # Socket đóng = mất quyền lái. Đây CHÍNH LÀ cơ chế an toàn, không
            # phải dọn dẹp phụ trợ: Phase 06 nối thêm "gửi velocity 0" vào đây.
            self.web_control_owner = None
            self.safety.on_web_disconnected()
            self.bus.emit(
                "warn",
                "safety",
                "web_control.revoked",
                "Tab giữ quyền lái đã đóng — thu hồi quyền điều khiển của web",
                {"reason": "web_disconnected", "socket_id": socket_id},
            )
            await self.broadcast("status", self.build_status())
        log.info("WebSocket %s đóng (còn %d)", socket_id, len(self._clients))

    # -- gửi ----------------------------------------------------------------
    async def send_to(
        self, socket_id: str, type_: str, data: BaseModel | dict | None = None
    ) -> None:
        client = self._clients.get(socket_id)
        if client is None:
            return
        try:
            await client.ws.send_json(frame(type_, data))
        except Exception:  # noqa: BLE001 — socket chết giữa chừng là chuyện thường
            # PHẢI đi qua disconnect() chứ không chỉ `pop`. Chỉ pop thì
            # `receive_loop` vẫn chạy trên socket đó và vẫn THỰC THI lệnh —
            # đã đo được: một lần gửi hỏng lúc mở socket là đủ để client giành
            # được quyền lái rồi không nhận lại một frame nào, kể cả ack. Đó
            # đúng là "im lặng nuốt một lệnh" mà hợp đồng cấm.
            await self.disconnect(socket_id)

    async def broadcast(self, type_: str, data: BaseModel | dict | None = None) -> None:
        if not self._clients:
            return
        payload = frame(type_, data)
        dead: list[str] = []
        for socket_id, client in list(self._clients.items()):
            try:
                await client.ws.send_json(payload)
            except Exception:  # noqa: BLE001
                # Một socket chết KHÔNG được làm gãy vòng broadcast của cả
                # đám — loại nó ra rồi đi tiếp.
                dead.append(socket_id)
        for socket_id in dead:
            await self.disconnect(socket_id)

    async def send_error(
        self,
        socket_id: str,
        code: str,
        message: str,
        *,
        ref: str | None = None,
        command: str | None = None,
        detail: dict | None = None,
    ) -> None:
        await self.send_to(
            socket_id,
            "error",
            ErrorPayload(ref=ref, command=command, code=code, message=message, detail=detail),
        )

    async def send_ack(
        self,
        socket_id: str,
        command: str,
        status: str,
        *,
        ref: str | None = None,
        detail: dict | None = None,
    ) -> None:
        await self.send_to(
            socket_id,
            "ack",
            AckPayload(ref=ref, command=command, status=status, detail=detail),  # type: ignore[arg-type]
        )

    # -- dựng status --------------------------------------------------------
    def build_status(self) -> StatusPayload:
        return StatusPayload(
            backend_version=__version__,
            endpoint=config.MAVLINK_ENDPOINT,
            connected=self.state.connected and is_link_alive(self.state),
            safety=SafetyStatus(
                web_control_enabled=self.safety.web_control_enabled,
                web_control_owner=self.web_control_owner,
                current_mode=self.safety.current_mode,
                rc_available=self.safety.rc_available,
                # Hai trường dưới là chỗ trống Phase 06 điền.
                deadman_tripped=False,
                last_zero_velocity_reason=None,
            ),
            limits=LimitsPayload(**config.safety_limits()),
            mission=MissionStatus(),  # Phase 07
            camera=CameraStatus(),  # Phase 07
        )

    # -- nhận ---------------------------------------------------------------
    async def receive_loop(self, socket_id: str, ws: WebSocket) -> None:
        """Đọc lệnh từ một socket cho tới khi nó đóng.

        Mọi lỗi nội dung đều trả `error` rồi ĐI TIẾP. Chỉ `WebSocketDisconnect`
        mới thoát vòng.

        Dùng `receive()` chứ KHÔNG dùng `receive_text()`: `receive_text()` của
        Starlette làm `message["text"]` trần, nên một frame NHỊ PHÂN (browser
        chỉ cần `ws.send(new Uint8Array(...))`) ném `KeyError: 'text'`, thoát
        cả vòng và đóng socket — đúng điều quyết định 2 ở đầu file nói là
        không được xảy ra.
        """
        while True:
            message = await ws.receive()
            if message["type"] == "websocket.disconnect":
                raise WebSocketDisconnect(message.get("code", 1000))

            raw = message.get("text")
            if raw is None:
                await self.send_error(
                    socket_id,
                    "bad_payload",
                    "Chỉ nhận frame văn bản JSON, không nhận frame nhị phân",
                )
                continue

            # Socket đã chết giữa chừng (một lần gửi hỏng) — không xử lý tiếp
            # lệnh mà ta không có cách nào trả lời.
            client = self._clients.get(socket_id)
            if client is None or client.dead:
                raise WebSocketDisconnect(1011)

            await self._dispatch(socket_id, raw)

    async def _dispatch(self, socket_id: str, raw: str) -> None:
        # 1. Phong bì đọc được không?
        try:
            envelope = Envelope.model_validate(json.loads(raw))
        except (json.JSONDecodeError, ValidationError) as exc:
            await self.send_error(
                socket_id,
                "bad_payload",
                "Không đọc được phong bì message — cần {v, type, data}",
                detail={"error": str(exc)[:300]},
            )
            return

        # 2. Đúng phiên bản hợp đồng không?
        if envelope.v != CONTRACT_VERSION:
            await self.send_error(
                socket_id,
                "unsupported_version",
                f"Hợp đồng phiên bản {envelope.v} không được hỗ trợ, backend dùng "
                f"v{CONTRACT_VERSION}",
                ref=envelope.id,
                command=envelope.type,
            )
            return

        # 3. `type` có trong hợp đồng không?
        model = UPLINK_MODELS.get(envelope.type)
        if model is None:
            await self.send_error(
                socket_id,
                "unknown_type",
                f"Type '{envelope.type}' không có trong hợp đồng chiều lên",
                ref=envelope.id,
                command=envelope.type,
            )
            return

        # 4. Có vượt nhịp không?
        client = self._clients.get(socket_id)
        if client is None:
            # Socket biến mất giữa chừng. Fail-closed: KHÔNG chạy lệnh cho một
            # socket không còn nhận được phản hồi (bản trước bỏ qua luôn cả
            # giới hạn nhịp ở đây, nên một socket chết spam được thoải mái).
            return
        if not client.allow(envelope.type):
            now = time.monotonic()
            if now - client.last_rate_error >= _RATE_ERROR_COOLDOWN_S:
                client.last_rate_error = now
                await self.send_error(
                    socket_id,
                    "rate_limited",
                    f"Gửi '{envelope.type}' quá nhanh (tối đa "
                    f"{UPLINK_RATE_LIMITS[envelope.type]:g}/giây) — message bị bỏ",
                    ref=envelope.id,
                    command=envelope.type,
                )
            return

        # 5. `data` đúng kiểu không?
        try:
            payload = model.model_validate(envelope.data)
        except ValidationError as exc:
            await self.send_error(
                socket_id,
                "bad_payload",
                f"Dữ liệu của '{envelope.type}' sai kiểu hoặc thiếu trường",
                ref=envelope.id,
                command=envelope.type,
                detail={"errors": exc.errors(include_url=False)[:5]},
            )
            return

        handler = COMMAND_HANDLERS.get(envelope.type)
        if handler is None:
            phase = UPLINK_IMPLEMENTED_IN.get(envelope.type, 0)
            await self.send_error(
                socket_id,
                "not_implemented",
                f"Lệnh '{envelope.type}' có trong hợp đồng nhưng Phase {phase:02d} "
                f"mới hiện thực hành vi",
                ref=envelope.id,
                command=envelope.type,
            )
            return

        try:
            await handler(self, socket_id, envelope, payload)
        except Exception as exc:  # noqa: BLE001
            log.exception("Handler '%s' ném lỗi", envelope.type)
            await self.send_error(
                socket_id,
                "internal",
                f"Lỗi backend khi xử lý '{envelope.type}' — đây là bug, báo lại đi",
                ref=envelope.id,
                command=envelope.type,
                detail={"error": str(exc)[:300]},
            )

    # -- task nền -----------------------------------------------------------
    def start_background(self, loop: asyncio.AbstractEventLoop | None = None) -> None:
        """Bật vòng telemetry + vòng bơm sự kiện. Gọi trong lifespan.

        Hàng đợi sự kiện được tạo Ở ĐÂY chứ không phải trong `__init__`. Lý do
        không phải thẩm mỹ: `HUB` là singleton dựng lúc IMPORT, khi chưa có
        event loop nào; `asyncio.Queue` gắn chặt vào loop đầu tiên dùng nó, nên
        lần chạy thứ hai trên một loop khác sẽ ném
        "Queue is bound to a different event loop". Gặp đúng lỗi này với
        `uvicorn --reload` và với mỗi `TestClient` trong test suite.
        """
        self._loop = loop or asyncio.get_running_loop()
        self._events = asyncio.Queue(maxsize=_EVENT_QUEUE_MAX)
        self.bus.subscribe(self._on_event_from_thread)
        self._tasks = [
            asyncio.create_task(self.telemetry_loop(), name="ws-telemetry"),
            asyncio.create_task(self.event_loop(), name="ws-events"),
        ]

    async def stop_background(self) -> None:
        self.bus.unsubscribe(self._on_event_from_thread)
        for task in self._tasks:
            task.cancel()
        for task in self._tasks:
            # Không chỉ nuốt CancelledError: một task đã chết vì lỗi khác sẽ
            # ném lại ở đây, tức là ném ra khỏi lifespan `finally` và làm hỏng
            # cả trình tự tắt. Ghi lại rồi tắt cho trọn.
            try:  # noqa: SIM105 — cần log, không chỉ suppress
                await task
            except asyncio.CancelledError:
                pass
            except Exception:  # noqa: BLE001
                log.exception("Task nền '%s' đã chết từ trước khi tắt", task.get_name())
        self._tasks = []
        # Bỏ mọi thứ gắn với loop vừa đóng, để lần start_background sau dựng
        # lại sạch trên loop mới.
        self._events = None
        self._loop = None
        self._clients.clear()
        self.web_control_owner = None
        self._last_mode = None
        self._last_link_alive = None

    def _on_event_from_thread(self, payload: EventPayload) -> None:
        """Subscriber của EventBus. CHẠY TRONG THREAD TELEMETRY, không phải
        event loop — nên chỉ được dùng `call_soon_threadsafe`, tuyệt đối không
        `create_task` hay `await` gì ở đây."""
        loop = self._loop
        if loop is None or loop.is_closed():
            return
        # RuntimeError = loop đã đóng giữa chừng lúc backend tắt. Không phải lỗi.
        with contextlib.suppress(RuntimeError):
            loop.call_soon_threadsafe(self._enqueue_event, payload)

    def _enqueue_event(self, payload: EventPayload) -> None:
        queue = self._events
        if queue is None:
            return
        if queue.full():
            with contextlib.suppress(asyncio.QueueEmpty):
                queue.get_nowait()
        with contextlib.suppress(asyncio.QueueFull):
            queue.put_nowait(payload)

    async def event_loop(self) -> None:
        # Giữ tham chiếu cục bộ: `stop_background` đặt `self._events = None`.
        queue = self._events
        if queue is None:
            return
        while True:
            payload = await queue.get()
            try:
                await self.broadcast("event", payload)
            except Exception:  # noqa: BLE001 — xem _khong_duoc_chet_lang_le
                self._khong_duoc_chet_lang_le("event_loop")

    async def telemetry_loop(self) -> None:
        """MỘT vòng cho TẤT CẢ socket. Xem quyết định 1 ở đầu file.

        Vòng này KHÔNG chỉ bơm telemetry: nó là chỗ DUY NHẤT gọi
        `_reconcile_control_ownership`, tức là chỗ duy nhất thu hồi quyền lái
        khi mode rời GUIDED hoặc khi mất link. Nó chết = mất cả cơ chế an toàn
        đó, mà socket vẫn mở nên không ai thấy gì. Vì vậy thân vòng phải bắt
        mọi lỗi và đi tiếp — xem `_khong_duoc_chet_lang_le`.
        """
        interval = 1.0 / max(config.TELEMETRY_HZ, 1.0)
        loop = asyncio.get_running_loop()
        moc_ke = loop.time()

        while True:
            try:
                await self._reconcile_control_ownership()
                await self.broadcast("telemetry", build_telemetry(self.state))
            except Exception:  # noqa: BLE001
                self._khong_duoc_chet_lang_le("telemetry_loop")

            # Ngủ tới MỐC KẾ, không phải ngủ đủ `interval`. Ngủ đủ interval sau
            # khi làm việc thì chu kỳ = việc + interval, nên nhịp trôi xuống
            # dưới TELEMETRY_HZ. Đo thật với SITL: 7,29 Hz (giãn cách 125-142 ms)
            # thay vì 8 Hz — trượt cổng pass §5.6 bài 3.
            moc_ke += interval
            cho = moc_ke - loop.time()
            if cho < 0:
                # Tụt lại quá xa (máy nghẽn). BỎ nhịp đã lỡ thay vì bắn dồn một
                # loạt để "trả nợ" — dồn nhịp làm client ngập chứ không giúp gì.
                moc_ke = loop.time()
                cho = 0
            await asyncio.sleep(cho)

    def _khong_duoc_chet_lang_le(self, ten_vong: str) -> None:
        """Ghi lỗi của một vòng nền và BÁO RA NGOÀI, rồi để vòng chạy tiếp.

        `asyncio.Task` nuốt exception cho tới lúc có ai `await` nó — ở đây là
        `stop_background()`, tức là lúc tắt tiến trình, có khi hàng giờ sau.
        Trong khoảng đó `/api/health` vẫn trả 200 và socket vẫn mở: hệ thống
        chết mà mọi đèn đều xanh. Phát một `event` để UI thấy ngay.
        """
        log.exception("Vòng nền '%s' ném lỗi — đã ghi lại và chạy tiếp", ten_vong)
        with contextlib.suppress(Exception):
            self.bus.emit(
                "error",
                "backend",
                "loop.error",
                f"Vòng nền '{ten_vong}' gặp lỗi — đây là bug, xem log backend",
                {"loop": ten_vong},
            )

    async def _reconcile_control_ownership(self) -> None:
        """Thu hồi quyền lái khi mode rời GUIDED hoặc khi mất link.

        Chạy ở đây (trên event loop) chứ không trong thread MAVLink: mọi thay
        đổi của `SafetyState` và `web_control_owner` đều nằm trên MỘT luồng,
        nên không cần khoá và không có race.
        """
        mode = self.state.mode
        link_alive = self.state.connected and is_link_alive(self.state)
        changed = False

        if mode != self._last_mode:
            self._last_mode = mode
            had_owner = self.web_control_owner is not None
            # SafetyState tự tắt web control khi mode ra khỏi whitelist.
            self.safety.on_mode_change(mode)
            if had_owner and not self.safety.web_control_enabled:
                self.web_control_owner = None
                self.bus.emit(
                    "warn",
                    "safety",
                    "web_control.revoked",
                    f"Mode đổi sang {mode} — web mất quyền lái, pilot đang cầm",
                    {"reason": "mode_change", "mode": mode},
                )
            changed = True

        if link_alive != self._last_link_alive:
            self._last_link_alive = link_alive
            if not link_alive and self.web_control_owner is not None:
                self.web_control_owner = None
                self.safety.disable_web_control()
                self.bus.emit(
                    "warn",
                    "safety",
                    "web_control.revoked",
                    "Mất link MAVLink — thu hồi quyền lái của web",
                    {"reason": "link_lost"},
                )
            changed = True

        if changed:
            await self.broadcast("status", self.build_status())


# ---------------------------------------------------------------------------
# Handler chiều lên
#
# Phase 05 chỉ làm `ping` và `cmd.web_control_enable` (mức CỜ — chưa gửi
# MAVLink nào). Mọi `cmd.*` khác rơi xuống nhánh `not_implemented` trong
# `_dispatch`, kèm số phase sẽ làm. Phase 06 và 07 thay dần bằng cách thêm
# dòng vào bảng dưới cùng.
# ---------------------------------------------------------------------------
async def _handle_ping(hub: WebSocketHub, socket_id: str, envelope: Envelope, _payload) -> None:
    await hub.send_to(socket_id, "pong", PongPayload(server_ts=time.time()))


async def _handle_web_control_enable(
    hub: WebSocketHub, socket_id: str, envelope: Envelope, payload
) -> None:
    command = envelope.type
    owner = hub.web_control_owner

    if payload.enabled:
        if owner is not None and owner != socket_id:
            await hub.send_error(
                socket_id,
                "command_denied",
                "Mot tab khac dang giu quyen lai",
                ref=envelope.id,
                command=command,
                detail={"owner": owner},
            )
            return
        hub.web_control_owner = socket_id
        hub.safety.enable_web_control()
        hub.bus.emit(
            "info",
            "safety",
            "web_control.enabled",
            "Web đã được trao quyền lái",
            {"socket_id": socket_id},
        )
    else:
        if owner is not None and owner != socket_id:
            await hub.send_error(
                socket_id,
                "command_denied",
                "Mot tab khac dang giu quyen lai",
                ref=envelope.id,
                command=command,
                detail={"owner": owner},
            )
            return
        if owner == socket_id:
            hub.web_control_owner = None
            hub.safety.disable_web_control()
            hub.bus.emit(
                "info",
                "safety",
                "web_control.disabled",
                "Web đã trả lại quyền lái",
                {"socket_id": socket_id},
            )

    await hub.send_ack(socket_id, command, "done", ref=envelope.id)
    await hub.broadcast("status", hub.build_status())


COMMAND_HANDLERS: dict[str, Handler] = {
    "ping": _handle_ping,
    "cmd.web_control_enable": _handle_web_control_enable,
}


async def websocket_endpoint(hub: WebSocketHub, ws: WebSocket) -> None:
    """Toàn bộ vòng đời một socket. `app.py` chỉ việc gọi hàm này."""
    socket_id = await hub.connect(ws)
    try:
        await hub.receive_loop(socket_id, ws)
    except WebSocketDisconnect:
        pass
    finally:
        await hub.disconnect(socket_id)
