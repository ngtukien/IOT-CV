# Phase 05: Backend — lớp MAVLink, telemetry và HỢP ĐỒNG WebSocket

| Trạng thái | Phụ thuộc | Ước lượng | Cần phần cứng |
|---|---|---|---|
| chưa bắt đầu | Phase 01 (repo đã tái cấu trúc, uv + Python 3.11), Phase 02 (WSL2 + SITL chạy được) | ~10 giờ | Không |

## Mục tiêu

Biến `backend/` thành một lớp MAVLink **bền**: tự nối lại khi rớt, chủ động yêu cầu flight controller gửi đúng message với đúng tần số, chuẩn hoá tất cả thành một model pydantic duy nhất, và đẩy xuống trình duyệt qua **một** WebSocket hai chiều.

Phase này còn là nơi **chốt Hợp đồng WebSocket** — mục [Hợp đồng WebSocket](#hợp-đồng-websocket) là **SSOT** (nguồn sự thật duy nhất) của giao tiếp backend ↔ web. Phase 06, 07, 08, 09, 10 đều **import** hợp đồng từ đây và **không được định nghĩa lại**.

Xong phase này: mở `ws://127.0.0.1:8000/ws` bằng một script dòng lệnh là thấy telemetry của drone ảo chảy về 8 lần mỗi giây. Chưa gửi được lệnh nào (đó là Phase 06).

## Đầu vào cần có

**Phải đọc trước:**

- `SAFETY.md` mục 1 — ai được quyền điều khiển máy bay. Ràng buộc cứng cho mọi phase backend.
- `plans/reports/260921-research-web-gcs-stack.md` §1.2 (giữ pymavlink; `SET_MESSAGE_INTERVAL` là lệnh id **511**, hỗ trợ từ ArduPilot 4.0+) và §1.3 (dùng `mavp2p`/`--out` khi cần 2 GCS cùng lúc).
- `plans/reports/260921-research-web-gcs-stack.md` §2.3 — vì sao bắt buộc WebSocket chứ không phải SSE (dead-man dựa trên "socket đóng = mất quyền").
- `plans/_phase-index.md` — để biết phase nào dùng lại hợp đồng này.

**Phải chạy được:**

- SITL trong WSL2 (`sim_vehicle.py -v ArduCopter`) — thành quả Phase 02.
- `uv` + Python 3.11 pin ở gốc repo — thành quả Phase 01.
- Mission Planner trên Windows (dùng làm GCS đối chứng).

### Hiện trạng code (prior art — đã rà, KHÔNG phải greenfield)

Phạm vi đã tìm: `backend/**/*.py` (21 file, ~824 LOC), `.env.example`, `pyproject.toml`, `requirements*.txt`, `frontend/*.js`.

| File | Đang có gì | Phase 05 làm gì |
|---|---|---|
| `backend/app.py` (95 dòng) | **Chạy được**. `GET /api/health`, `GET /api/status`, `WS /ws/telemetry` (chỉ đẩy xuống, không nhận lên), `status_payload()`, lifespan gọi `READER.start()/stop()`, biến `TELEMETRY_AUTOSTART` để test khỏi mở link, mount `frontend/` tĩnh cuối cùng. Đã có `except WebSocketDisconnect: SAFETY.on_web_disconnected()` | Tách REST → `api.py`, WS → `ws.py`; thay `/ws/telemetry` bằng `/ws` **hai chiều** |
| `backend/config.py` (113 dòng) | **Đầy đủ**. Loader `.env` tự viết (`_load_dotenv`, env shell thắng file), `_env_str/_env_int/_env_float`, `MAVLINK_ENDPOINT`, `MAVLINK_BAUD`, `HEARTBEAT_TIMEOUT_S`, `LINK_TIMEOUT_S`, `TELEMETRY_HZ`, nhóm giới hạn an toàn, `safety_limits()` | Chỉ **thêm** khoá mới, không đổi khoá cũ |
| `backend/mavlink/connection.py` (99 dòng) | `MavlinkConnection.connect()` + `wait_heartbeat()` + `recv_match()` + `close()` + `_main()` in "CỔNG PASS 5A". **Chưa có**: reconnect, khoá ghi, gửi lệnh, `SET_MESSAGE_INTERVAL`, đặt sysid riêng | Mở rộng (5.1) |
| `backend/mavlink/telemetry.py` (195 dòng) | **Chạy được**. `TelemetryState` dataclass 15 trường; `update_state()` là **hàm thuần** đã parse `HEARTBEAT` (mode + armed qua bit `0b1000_0000`), `GLOBAL_POSITION_INT` (lat/lon/relative_alt/hdg, xử lý `hdg==65535`), `GPS_RAW_INT`, `ATTITUDE` (roll/pitch), `SYS_STATUS` (loại `0` và `65535`), `VFR_HUD`; bảng `COPTER_MODES` 27 mode; `is_link_alive()`; `TelemetryReader` chạy thread nền, connect lỗi thì log warning chứ không làm chết backend | Thêm message mới, chuyển model sang pydantic (5.2) |
| `backend/mavlink/safety.py` (95 dòng) | **Chạy được đủ**: `note_manual_command(now=)`, `should_send_zero_velocity(now=, timeout_ms=)`, `enable/disable_web_control()`, `on_mode_change()`, `on_web_disconnected()`, `may_accept_web_command()`, `clamp_velocity()`, `WEB_CONTROLLABLE_MODES = {"GUIDED"}` | Phase 05 **không sửa**. Phase 06/07 mới đụng |
| `backend/mavlink/control.py` (76 dòng) | 8 method đều `NotImplementedError`. Có `KEY_VELOCITY_MAP` đúng quy ước NED | Phase 06 |
| `backend/mavlink/mission.py` (131 dòng) | `validate_mission()` + `haversine_m()` **đã chạy**; `MissionManager.*` là `NotImplementedError` | Phase 07 |
| `backend/vision/*.py` | `stream.py`, `detector.py`, `events.py` đều `NotImplementedError` | Phase 07 chỉ thêm nguồn giả; bản thật thuộc `plans/ai/` và Phase 17 |
| `backend/tests/` (4 file, ~340 dòng) | `test_app.py` (3 test), `test_safety.py` (4 test), `test_mission_validation.py`, `test_telemetry.py` (có sẵn class `FakeMessage`) — **tất cả đang xanh** | Giữ; thêm `test_ws_protocol.py` |

> Kết luận: `connection.py`, `telemetry.py`, `safety.py` là **vốn đang chạy**. Phase 05 mở rộng chứ không viết lại.

## File và thư mục sở hữu

Chỉ được tạo/sửa các đường dẫn sau. **Không đụng `frontend/`** (Phase 08–10 sở hữu), **không đụng `control.py`** (Phase 06), **không đụng `mission.py` / `proximity` / `vision/`** (Phase 07).

**Sửa:**

- `backend/app.py`
- `backend/config.py`
- `backend/mavlink/connection.py`
- `backend/mavlink/telemetry.py`
- `backend/mavlink/__init__.py`
- `backend/tests/test_app.py`, `backend/tests/test_telemetry.py`
- `.env.example`
- `pyproject.toml` (gốc)

**Tạo mới:**

- `backend/schemas.py` — model pydantic, hiện thực Hợp đồng WebSocket
- `backend/ws.py` — hub WebSocket (broadcast + dispatch)
- `backend/api.py` — router REST
- `backend/events.py` — bus sự kiện nội bộ (vòng đệm N sự kiện gần nhất + phát ra WS)
- `backend/ws-contract.schema.json` — JSON Schema sinh ra từ `schemas.py`, Phase 08 đọc file này
- `backend/tests/fakes.py` — `FakeMessage` + `FakeMAVLink` dùng chung
- `backend/tests/conftest.py`
- `backend/tests/test_ws_protocol.py`
- `scripts/ws_probe.py`
- `docs/so-tay/05-backend-mavlink-telemetry.md`

**Sinh lúc chạy (thêm vào `.gitignore`):** `logs/backend.log`.

---

## Việc theo thứ tự

### 5.1 Lớp kết nối MAVLink bền

Mở rộng `MavlinkConnection` hiện có. Bốn việc con, làm đúng thứ tự.

**5.1.1 — sysid/compid riêng cho backend.**
`mavutil.mavlink_connection()` mặc định `source_system=255`, đúng quy ước cho GCS. Nhưng khi chạy **hai** GCS cùng lúc (backend + Mission Planner) thì hai bên trùng số 255, và `COMMAND_ACK` của FC không phân biệt được ai hỏi.

Thêm vào `config.py`:

```python
MAVLINK_SOURCE_SYSTEM = _env_int("MAVLINK_SOURCE_SYSTEM", 254)
MAVLINK_SOURCE_COMPONENT = _env_int("MAVLINK_SOURCE_COMPONENT", 190)  # MAV_COMP_ID_MISSIONPLANNER
```

Truyền vào `mavutil.mavlink_connection(..., source_system=..., source_component=...)`. Để 255 cho Mission Planner.

**5.1.2 — reconnect có backoff.**
`TelemetryReader._run()` hiện `connect()` **một lần**; lỗi là `return` luôn → backend sống nhưng vĩnh viễn không có telemetry, và không có gì báo cho người dùng biết.

Đổi thành hai vòng lồng nhau:

```text
while not stop:
    try: connection.connect()
    except: emit_event("link.connect_failed"); sleep(backoff); backoff = min(backoff*2, 10); continue
    backoff = 1.0
    emit_event("link.up")
    while not stop:
        msg = recv_match(timeout=1.0)
        if msg is None and not is_link_alive(state): break      # im lặng quá LINK_TIMEOUT_S
        if msg: update_state(state, msg)
    emit_event("link.lost"); connection.close()
```

Backoff: 1 → 2 → 4 → 8 → 10 s (trần). Mỗi lần đổi trạng thái phát đúng **một** `event` (không spam mỗi vòng lặp).

**5.1.3 — khoá ghi (`threading.Lock`).**
Từ Phase 06 sẽ có **hai** thread cùng ghi vào một socket MAVLink: thread đọc telemetry và vòng dead-man. Hai thread ghi xen kẽ làm byte của hai gói đan vào nhau, FC bỏ gói **trong im lặng** — loại bug khó tìm nhất.

Thêm vào `MavlinkConnection`:

```python
self._send_lock = threading.Lock()

def send(self, fn, *args, **kwargs):
    """Mọi lời gọi self.master.mav.*_send() PHẢI đi qua đây."""
    if self.master is None:
        raise ConnectionError("Chua co link MAVLink")
    with self._send_lock:
        return fn(*args, **kwargs)
```

Phase 06 và 07 **bắt buộc** dùng `conn.send(conn.master.mav.xxx_send, ...)`, không gọi thẳng. Ghi luật này vào docstring của `connection.py` để phase sau đọc thấy.

**5.1.4 — `SET_MESSAGE_INTERVAL`.**
Mặc định ArduPilot gửi một số message rất chậm (ví dụ `ATTITUDE` có thể chỉ 1–4 Hz), HUD sẽ giật. Sau mỗi lần heartbeat thành công, gọi `request_streams()` gửi `MAV_CMD_SET_MESSAGE_INTERVAL` (**id 511**) cho từng message. Tham số: `param1 = message_id`, `param2 = interval_us` (`-1` tắt, `0` về mặc định).

```python
def request_streams(self) -> None:
    for msg_id, hz in STREAM_RATES.items():
        self.send(
            self.master.mav.command_long_send,
            self.target_system, self.target_component,
            511,                 # MAV_CMD_SET_MESSAGE_INTERVAL
            0,                   # confirmation
            msg_id, int(1_000_000 / hz), 0, 0, 0, 0, 0,
        )
        time.sleep(0.02)         # đừng dội 10 lệnh trong 1 ms
```

`STREAM_RATES` đặt trong `connection.py`:

| Message | ID | Hz | Vì sao |
|---|---|---|---|
| `HEARTBEAT` | 0 | 1 | Phát hiện mất link |
| `SYS_STATUS` | 1 | 2 | Cờ sức khoẻ cảm biến, điện áp dự phòng |
| `GPS_RAW_INT` | 24 | 2 | fix type + số vệ tinh (đổi chậm) |
| `ATTITUDE` | 30 | 10 | Chân trời giả phải mượt |
| `GLOBAL_POSITION_INT` | 33 | 5 | Marker bản đồ |
| `VFR_HUD` | 74 | 5 | Tốc độ mặt đất, tốc độ leo |
| `DISTANCE_SENSOR` | 132 | 5 | Khoảng cách vật cản (Phase 07 dùng) |
| `BATTERY_STATUS` | 147 | 1 | Dòng điện + % pin |
| `OBSTACLE_DISTANCE` | 330 | 5 | Mảng 72 cung proximity (Phase 07 dùng) |

**Không** đặt interval cho `STATUSTEXT` (253) và nhóm `MISSION_*`: chúng là message sự kiện, FC tự đẩy khi có việc.

Ngoài ra gửi **một lần** `MAV_CMD_REQUEST_MESSAGE` (id 512) cho `HOME_POSITION` (242) sau heartbeat, và lặp lại mỗi khi `armed` đổi từ `False` sang `True`.

- Lệnh chạy:

  ```powershell
  # Tab 1 — WSL (bash): SITL chẻ ra 2 cổng, backend và Mission Planner mỗi bên một cổng
  wsl -d Ubuntu-24.04 -- bash -lc "cd ~/ardupilot && sim_vehicle.py -v ArduCopter --console --map --out=udp:127.0.0.1:14550 --out=udp:127.0.0.1:14551"
  ```

  ```powershell
  # Tab 2 — Windows
  $env:MAVLINK_ENDPOINT = "udpin:127.0.0.1:14551"
  uv run python -m backend.mavlink.connection
  ```

- Kết quả mong đợi:

  ```text
  === CỔNG PASS 5A ===
  Python connected   : yes
  System ID          : 1
  Component ID       : 1
  Heartbeat received : yes
  ```

  Rồi mở Mission Planner → Connect → UDP → port **14550**: cả hai **cùng** thấy drone. Đây là bằng chứng việc chẻ cổng hoạt động.

- Nếu lỗi:
  - *Treo mãi ở "Đang kết nối"* — nhầm chiều UDP. `--out=udp:127.0.0.1:14551` nghĩa là MAVProxy **gửi tới** cổng đó, nên backend phải **lắng nghe**: dùng `udpin:`. (`udp:` trong pymavlink cũng mặc định là lắng nghe, nhưng ghi rõ `udpin:` để khỏi phải đoán.)
  - *`Address already in use`* — Mission Planner hoặc một tiến trình backend cũ đang giữ 14551. `Get-Process python | Stop-Process` rồi thử lại.
  - *Mission Planner mất kết nối ngay khi backend chạy* — hai bên đang chung một cổng. Quay lại lệnh hai `--out` ở trên, hoặc dùng `mavp2p` như `260921-research-web-gcs-stack.md` §1.3.
  - *Heartbeat OK nhưng `ATTITUDE` vẫn chậm* — `request_streams()` chưa được gọi sau reconnect. Nó phải nằm **trong** vòng lặp reconnect, không phải chỉ ở lần đầu.

---

### 5.2 Model telemetry (pydantic) và các message mới

**5.2.1 — `backend/schemas.py`.**
Chuyển `TelemetryState` từ `@dataclass` sang **pydantic v2**. Lý do không phải thẩm mỹ: pydantic cho phép xuất **JSON Schema**, và Phase 08 sinh type TypeScript từ schema đó thay vì gõ tay — bớt được cả một lớp sai lệch giữa hai bên.

Giữ **đúng tên trường cũ** (`relative_alt`, `ground_speed`, `battery_voltage`, `gps_fix_type`, …). `test_telemetry.py` và `test_app.py` đang khẳng định các tên này; đổi tên là tự tạo việc.

Các model phải có: `Telemetry`, `StatusPayload`, `SafetyStatus`, `LimitsPayload`, `MissionStatus`, `CameraStatus`, `EventPayload`, `DetectionPayload`, `AckPayload`, `ErrorPayload`, `Envelope`, và các model lệnh `CmdMode`, `CmdArm`, `CmdTakeoff`, `CmdVelocity`, `CmdSimple`, `CmdMissionUpload`, `CmdWebControlEnable`, `CmdPing` (Phase 06/07 hiện thực hành vi; Phase 05 chỉ định nghĩa **hình dạng**).

**5.2.2 — parse thêm message.** Thêm nhánh vào `update_state()` (vẫn giữ là hàm thuần, vẫn nhận tham số `now`):

| Message | Trường mới | Ghi chú xử lý |
|---|---|---|
| `BATTERY_STATUS` | `battery_current`, `battery_remaining` | `current_battery` đơn vị **cA** (chia 100 ra ampe); `-1` nghĩa là không đo được → `None`. `battery_remaining` `-1` → `None` |
| `VFR_HUD` | `climb_rate` | trường `climb`, m/s, dương là lên |
| `ATTITUDE` | `yaw` | `math.degrees(msg.yaw)` rồi chuẩn hoá về `0..359` (`% 360`) |
| `GLOBAL_POSITION_INT` | `absolute_alt` | `msg.alt / 1000.0` (AMSL) |
| `HOME_POSITION` | `home_lat`, `home_lon` | chia `1e7` |
| `SYS_STATUS` | `ekf_ok` | suy từ bit `MAV_SYS_STATUS_AHRS` trong `onboard_control_sensors_health` |
| `STATUSTEXT` | *(không vào Telemetry)* | đẩy thẳng thành `event` qua `backend/events.py`; `severity` 0–3 → `error`, 4 → `warn`, còn lại → `info` |

> *chưa xác minh:* tên hằng chính xác của bit AHRS trong pymavlink 2.4.49. **Cách kiểm chứng ở 5.2.5:** in `hex(msg.onboard_control_sensors_health)` trong SITL, đối chiếu với dòng `EKF3 IMU0 is using GPS` trong console MAVProxy, rồi ghi hằng đúng vào một comment trong `telemetry.py`. Cho tới lúc đó để `ekf_ok = None` (nghĩa là "chưa biết"), **không** đoán `True`.

**5.2.3 — `link_age_ms` là giá trị dẫn xuất.** Không lưu vào model; tính lúc serialize: `(time.monotonic() - last_update) * 1000`. Lưu lại là vi phạm SSOT và chắc chắn sẽ lệch (xem `rules/code-conventions.md` § No Derived Fields).

**5.2.4 — `backend/events.py`.** Một bus rất nhỏ:

```python
class EventBus:
    def __init__(self, capacity: int = 200) -> None:
        self._buf: collections.deque[EventPayload] = collections.deque(maxlen=capacity)
        self._subscribers: list[Callable[[EventPayload], None]] = []

    def emit(self, level, source, code, message, detail=None) -> EventPayload: ...
    def recent(self, limit: int = 100) -> list[EventPayload]: ...
    def subscribe(self, fn) -> None: ...
```

`ws.py` đăng ký một subscriber để đẩy ngay ra mọi socket; vòng đệm 200 sự kiện để tab mới mở không thấy bảng log trống (Phase 07 phơi ra `GET /api/events`).

**5.2.5 — nghiệm thu:**

```powershell
uv run uvicorn backend.app:app --host 127.0.0.1 --port 8000
# tab khác
uv run python scripts/ws_probe.py --url ws://127.0.0.1:8000/ws --count 20
```

- Kết quả mong đợi: 20 message `type=telemetry`, cách nhau ≈ 125 ms (`TELEMETRY_HZ=8`); `mode` khớp console MAVProxy; gõ `takeoff 5` trong MAVProxy thì `relative_alt` bò lên ≈ 5.
- Nếu lỗi: *`relative_alt` luôn `null`* → chưa gọi `request_streams()`, hoặc SITL chưa có GPS fix (chờ ~30 s sau khi khởi động). *`battery_current` luôn `null`* → FC chưa gửi `BATTERY_STATUS`; SITL mặc định có, kiểm tra bằng `status BATTERY_STATUS` trong MAVProxy.

---

### 5.3 WebSocket server và broadcast

**5.3.1 — `backend/ws.py`: `WebSocketHub`.**

```python
class WebSocketHub:
    def __init__(self) -> None:
        self._clients: dict[str, WebSocket] = {}      # socket_id -> ws
        self._seq = itertools.count(1)

    async def connect(self, ws) -> str: ...           # accept, sinh socket_id "s-1", gửi status ngay
    async def disconnect(self, socket_id) -> None: ...
    async def broadcast(self, type_: str, data) -> None: ...
    async def send_to(self, socket_id, type_, data) -> None: ...
```

**Một** task nền duy nhất chạy vòng broadcast telemetry cho **tất cả** socket:

```python
async def telemetry_loop(hub, state):
    interval = 1.0 / max(config.TELEMETRY_HZ, 1.0)
    while True:
        await hub.broadcast("telemetry", build_telemetry(state))
        await asyncio.sleep(interval)
```

> Khác biệt so với `app.py` hiện tại (mỗi socket một vòng `while True: send_json; sleep`): với 1 client thì như nhau, nhưng vòng-mỗi-socket làm hai tab lệch pha và nhân đôi chi phí serialize. `send_json` cho socket đã chết phải bị `try/except` và loại socket khỏi `dict`, **không được** làm gãy vòng lặp chung.

**5.3.2 — dispatch chiều lên.** Mỗi socket có một task `receive_loop`:

```text
while True:
    raw = await ws.receive_text()
    parse Envelope
      lỗi parse            -> error code="bad_payload"     (KHÔNG đóng socket)
      v != 1               -> error code="unsupported_version"
      type không biết      -> error code="unknown_type"    (KHÔNG đóng socket)
      quá giới hạn nhịp    -> bỏ message, error code="rate_limited" (tối đa 1 lần/giây)
      hợp lệ               -> COMMAND_HANDLERS[type](socket_id, data)
```

Phase 05 đăng ký handler cho **`ping`** (đáp `pong`) và **`cmd.web_control_enable`** (chỉ bật/tắt cờ trong `SafetyState` + quy tắc một-người-lái ở 5.3.3 — chưa gửi MAVLink gì). Mọi `cmd.*` còn lại trả `error` code `not_implemented` với message tiếng Việt nêu rõ phase nào sẽ làm. Phase 06 và 07 thay dần các handler đó.

**5.3.3 — quy tắc một-người-lái.** Chỉ **một** socket được giữ quyền lái tại một thời điểm. Socket đầu tiên gửi `cmd.web_control_enable {enabled:true}` trở thành `web_control_owner`. Socket thứ hai gửi lệnh đó nhận `error` code `command_denied`, message `"Mot tab khac dang giu quyen lai"`. Chủ quyền mất khi: tự tắt, socket đóng, mode rời `GUIDED`, hoặc mất link. Version 1 **không** có cơ chế cướp quyền.

**5.3.4 — đóng socket.** Giữ nguyên tinh thần code hiện tại:

```python
except WebSocketDisconnect:
    await hub.disconnect(socket_id)
    if SAFETY_owner == socket_id:
        SAFETY.on_web_disconnected()
```

Phase 06 nối thêm hành động "gửi velocity 0 ngay" vào đúng chỗ này.

**5.3.5 — tách `app.py`.** Sau phase này `app.py` chỉ còn: tạo `FastAPI`, `include_router(api.router)`, đăng ký `@app.websocket("/ws")`, lifespan (`READER.start()`, `telemetry_loop` task, dọn dẹp), mount tĩnh **cuối cùng**. Mục tiêu ≤ 80 dòng.
Route `/ws/telemetry` cũ bị **xoá** (frontend vanilla dùng nó đã bị thay ở Phase 01).
`GET /api/health` và `GET /api/status` chuyển nguyên trạng sang `api.py`; **ba khẳng định trong `test_app.py` phải tiếp tục đúng**: `connected is False`, `mode == "UNKNOWN"`, `limits["max_alt"] == 10.0`. Nếu buộc phải đổi cấu trúc, sửa test trong **cùng commit** và ghi lý do vào message commit.

**5.3.6 — mount tĩnh.** Phase 01 đã chuyển frontend sang Vite; kiểm tra `_FRONTEND_DIR` đã là `config.PROJECT_ROOT / "frontend" / "dist"` chưa, chưa thì đổi. Mount **sau cùng** để không che `/api` và `/ws` — thứ tự hiện tại đang đúng, đừng đảo.

- Lệnh chạy:

  ```powershell
  uv run python scripts/ws_probe.py --url ws://127.0.0.1:8000/ws --send '{"v":1,"type":"ping","id":"c-1","data":{}}'
  uv run python scripts/ws_probe.py --url ws://127.0.0.1:8000/ws --send '{"v":1,"type":"khong-ton-tai","id":"c-2","data":{}}'
  ```

- Kết quả mong đợi: lệnh 1 nhận `pong`; lệnh 2 nhận `error` với `code="unknown_type"` và **socket vẫn mở** (probe tiếp tục in telemetry sau đó).
- Nếu lỗi: *socket đóng khi gửi type lạ* → đang `raise` trong `receive_loop`. Bắt lỗi, trả `error`, đi tiếp. Đóng socket vì một message hỏng là làm mất luôn telemetry — hại nhiều hơn lợi.

---

### 5.4 Viết và hiện thực Hợp đồng WebSocket

Nội dung hợp đồng nằm ở mục [Hợp đồng WebSocket](#hợp-đồng-websocket) cuối file này. Bước 5.4 gồm:

1. Đọc kỹ hợp đồng; nếu thấy thiếu trường thì **sửa mục đó trước**, rồi mới viết code.
2. Hiện thực thành pydantic trong `schemas.py` — đủ trường, đúng tên, đúng kiểu, đúng đơn vị.
3. Xuất JSON Schema cho Phase 08:

   ```powershell
   uv run python -c "import json,backend.schemas as s; open('backend/ws-contract.schema.json','w',encoding='utf-8').write(json.dumps(s.contract_json_schema(), indent=2, ensure_ascii=False))"
   ```

4. Viết `backend/tests/test_ws_protocol.py` (xem 5.5).
5. **Commit và push ngay khi 5.4 xong.** Phase 08 chỉ cần hợp đồng, không cần backend chạy đủ — commit sớm là mở khoá cho một nhánh việc song song.

- Kết quả mong đợi: `backend/ws-contract.schema.json` tồn tại, mở ra thấy đủ các `type` trong hai bảng của hợp đồng.
- Nếu lỗi: *pydantic báo `Unable to generate JSON schema`* → `Envelope.data` đang khai `Any`. Dùng union phân biệt theo `type`: `Annotated[Union[...], Field(discriminator="type")]`.

---

### 5.5 Kiểm thử

**5.5.1 — `backend/tests/fakes.py`.** Chuyển class `FakeMessage` **đang có sẵn** trong `test_telemetry.py` sang đây và cho file cũ import lại (SSOT — không nuôi hai bản). Thêm `FakeMAVLink`:

- `wait_heartbeat(timeout)` → trả `FakeMessage("HEARTBEAT", base_mode=..., custom_mode=...)`
- `recv_match(...)` → lấy từ hàng đợi nạp sẵn (test tự bơm kịch bản)
- `.mav` → đối tượng ghi lại **mọi** lời gọi `*_send()` vào `self.sent: list[tuple[str, dict]]`
- `.target_system = 1`, `.target_component = 1`
- tiện ích `last(name)` trả kwargs của gói `name` cuối cùng

`FakeMAVLink` là nền cho toàn bộ test của Phase 06 và 07 — làm cho tử tế ngay từ đây.

**5.5.2 — `test_ws_protocol.py`:**

| Test | Khẳng định |
|---|---|
| `test_moi_type_trong_hop_dong_parse_duoc` | Lặp qua danh sách `type`, dựng payload mẫu, `Envelope` parse không lỗi |
| `test_type_la_tra_error_va_khong_dong_socket` | Gửi `type="abc"` → nhận `error` `unknown_type`, gửi tiếp `ping` vẫn nhận `pong` |
| `test_payload_sai_kieu_tra_bad_payload` | `cmd.takeoff` với `altitude:"cao"` → `code="bad_payload"` |
| `test_version_khac_1_bi_tu_choi` | `v:2` → `unsupported_version` |
| `test_mot_nguoi_lai` | Socket A bật web control OK; socket B bật → `command_denied` |
| `test_json_schema_co_du_type` | Mọi `type` trong hợp đồng đều xuất hiện trong `contract_json_schema()` |

**5.5.3 — chạy:**

```powershell
uv run ruff check .
uv run ruff format --check .
uv run pytest
```

- Kết quả mong đợi: ruff sạch; toàn bộ test xanh (4 file cũ + `test_ws_protocol.py`).
- Nếu lỗi: *`test_app.py` đỏ* → gần như luôn do đổi route WS hoặc đổi hình dạng `/api/status`. Sửa test cho khớp hợp đồng; **đừng** sửa hợp đồng cho vừa test.

---

### 5.6 Nghiệm thu trên SITL

| # | Bài | Cách làm | Đạt khi |
|---|---|---|---|
| 1 | Hai GCS song song | SITL chẻ 14550/14551; backend nối 14551, Mission Planner nối 14550 | Cả hai cùng hiện telemetry, không bên nào rớt trong 5 phút |
| 2 | Telemetry đủ trường | `ws_probe --count 40 --pretty` | `mode`, `armed`, `lat`, `lon`, `relative_alt`, `heading`, `ground_speed`, `satellites`, `battery_voltage`, `roll`, `pitch`, `yaw` đều có giá trị (không `null`) sau khi SITL có GPS fix |
| 3 | Nhịp đúng | `ws_probe --measure-rate` | 7.5–8.5 Hz với `TELEMETRY_HZ=8` |
| 4 | Mất link | Tắt SITL giữa chừng | Trong ≤ `LINK_TIMEOUT_S`+1 s: `connected` về `false`, có `event` `link.lost`; backend **không** crash |
| 5 | Nối lại | Bật SITL lên lại | Trong ≤ 10 s tự nối lại, có `event` `link.up`, telemetry chảy tiếp; `request_streams()` chạy lại (kiểm chứng: `ATTITUDE` lại về 10 Hz) |
| 6 | Sự kiện STATUSTEXT | Trong MAVProxy gõ `arm throttle` khi chưa có fix | `ws_probe` in `event` với `source="mavlink"`, `code="statustext"`, message chứa `PreArm` |

---

### 5.7 Việc trả về — khoá cấu hình Vision (nhận từ AI Phase 1 / Phase 07)

`backend/config.py` đã có sẵn khối Vision (`CAMERA_STREAM_URL`, `YOLO_WEIGHTS`, `DETECTION_CONFIDENCE`, `DETECTION_MIN_FRAMES`, `DETECTION_COOLDOWN_S`). `plans/ai/ai-phase-01-chuan-bi.md` §A1.9 và `plans/phase-07-backend-mission-proximity-safety.md` §7.6/§7.8 cần thêm ba khoá nữa trong **đúng khối đó**, không đổi khoá cũ:

```python
YOLO_DEVICE      = _env_str("YOLO_DEVICE", "0")          # "0" = GPU 0, "cpu" de ep CPU
DETECTION_IMGSZ  = _env_int("DETECTION_IMGSZ", 640)
VISION_ENABLED   = _env_bool("VISION_ENABLED", True)      # tat han khoi vision khi test bay
```

`_env_bool` chưa có trong `config.py` hiện tại (chỉ có `_env_str`/`_env_int`/`_env_float`) — thêm helper này theo đúng khuôn ba hàm kia: đọc chuỗi (không phân biệt hoa/thường), `"1"`/`"true"`/`"yes"` → `True`, `"0"`/`"false"`/`"no"` → `False`, còn lại/không đặt → giá trị mặc định.

---

## Hợp đồng WebSocket

> **SSOT của giao tiếp backend ↔ frontend.**
> Phase 06 và 07 hiện thực các handler `cmd.*`. Phase 08 sinh `frontend/src/lib/protocol.ts` từ mục này (và từ `backend/ws-contract.schema.json`). Phase 09 và 10 **dùng lại**, không định nghĩa thêm.
> Đổi hợp đồng = sửa mục này **trước**, rồi `backend/schemas.py`, rồi `protocol.ts`, trong **cùng một commit**.

### Endpoint

- **`GET /ws`** — một socket duy nhất, hai chiều: telemetry xuống, lệnh lên, box nhận diện xuống.
- Không dùng subprotocol. **Không xác thực** ở Version 1 (chạy LAN, một người dùng) — ghi rõ hạn chế này trong sổ tay, đây là điểm giảng viên có thể hỏi.
- Route cũ `/ws/telemetry` đã bị xoá.

### Phong bì chung

```json
{ "v": 1, "type": "telemetry", "ts": 1758412345.123, "id": "c-17", "data": {} }
```

| Trường | Kiểu | Bắt buộc | Ý nghĩa |
|---|---|---|---|
| `v` | int | có | Phiên bản hợp đồng, luôn `1`. Khác → `error` `unsupported_version` |
| `type` | string | có | Một giá trị trong hai bảng dưới |
| `ts` | float | có | Unix epoch **giây** có phần thập phân (`time.time()`) |
| `id` | string | chỉ chiều lên | Mã client tự sinh (`c-1`, `c-2`…). Server echo lại ở `ack.ref` / `error.ref` |
| `data` | object | có | Không bao giờ `null`; rỗng thì `{}` |

**Tương thích tiến:** bên nhận **bỏ qua trong im lặng** `type` lạ ở chiều **xuống** và trường lạ trong `data`. Chiều **lên** thì phải trả `error` — im lặng nuốt một lệnh là nguy hiểm.

### Chiều XUỐNG (server → client)

| `type` | Nhịp | Khi nào | Phase hiện thực |
|---|---|---|---|
| `telemetry` | `TELEMETRY_HZ` (8 Hz) | Đều đặn | 05 |
| `status` | Khi đổi + 1 lần lúc mở socket | Sự kiện | 05 |
| `event` | Khi có việc | Sự kiện | 05 |
| `detection` | 3–5 Hz | Sự kiện | 07 (nguồn giả) · `plans/ai/` (nguồn thật) |
| `ack` | Đáp mỗi lệnh | Sự kiện | 06 |
| `error` | Đáp lệnh hỏng | Sự kiện | 05 |
| `pong` | Đáp `ping` | Sự kiện | 05 |

#### `telemetry.data`

| Trường | Kiểu | Đơn vị | Ghi chú |
|---|---|---|---|
| `connected` | bool | — | Link **còn sống** (`is_link_alive`), không phải "đã từng nối" |
| `link_age_ms` | int \| null | ms | Từ message MAVLink cuối |
| `mode` | string | — | `GUIDED`, `LOITER`… theo `COPTER_MODES` |
| `armed` | bool | — | |
| `lat`, `lon` | float \| null | độ | Đã chia `1e7` |
| `relative_alt` | float \| null | m | So với home |
| `absolute_alt` | float \| null | m | AMSL |
| `heading` | int \| null | độ | 0–359 |
| `ground_speed` | float \| null | m/s | |
| `climb_rate` | float \| null | m/s | Dương là lên |
| `roll`, `pitch`, `yaw` | float \| null | độ | `yaw` chuẩn hoá 0–359 |
| `gps_fix_type` | int \| null | — | 0 no-gps · 1 no-fix · 2 2D · 3 3D · 4 DGPS · 5 RTK-float · 6 RTK-fixed |
| `satellites` | int \| null | — | |
| `battery_voltage` | float \| null | V | |
| `battery_current` | float \| null | A | `null` khi FC báo `-1` |
| `battery_remaining` | int \| null | % | |
| `home_lat`, `home_lon` | float \| null | độ | |
| `obstacle_distance` | float \| null | m | Hướng trước. `null` = không đọc được (Phase 07) |
| `obstacle_sectors` | array[8] of (float \| null) | m | 8 cung 45°, index 0 = mũi, theo chiều kim đồng hồ (Phase 07) |
| `rangefinder_healthy` | bool | — | Phase 07 |
| `avoid_state` | string | — | `OFF` \| `NEAR` \| `ACTIVE` \| `UNKNOWN` (Phase 07) |
| `ekf_ok` | bool \| null | — | `null` = chưa biết |

> `web_control_enabled` **cố ý không nằm ở đây** — nó thuộc `status`. Một giá trị, một chỗ.
> Các trường của Phase 07 vẫn **có mặt** ngay từ Phase 05, giá trị `null` / `"UNKNOWN"` / `false`. Nhờ vậy Phase 08 dựng UI được trước khi Phase 07 xong.

#### `status.data`

```json
{
  "backend_version": "0.1.0",
  "endpoint": "udpin:127.0.0.1:14551",
  "connected": true,
  "safety": {
    "web_control_enabled": false,
    "web_control_owner": null,
    "current_mode": "GUIDED",
    "rc_available": true,
    "deadman_tripped": false,
    "last_zero_velocity_reason": null
  },
  "limits": {
    "max_alt": 10.0, "min_alt": 2.0, "max_distance_home": 50.0, "max_waypoints": 10,
    "max_velocity": 1.0, "manual_command_timeout_ms": 300, "deadman_tick_ms": 50,
    "avoid_margin_m": 2.0, "avoid_dist_max_m": 5.0, "rangefinder_max_m": 6.0
  },
  "mission": { "count": 0, "uploaded_at": null, "source": "none" },
  "camera": { "available": false, "url": "/api/video/stream", "fake": true }
}
```

`mission.source` ∈ `none` · `readback` (đã đọc lại từ FC — đáng tin) · `local` (chỉ trong bộ nhớ backend, chưa xác nhận).
`safety.web_control_owner` là `socket_id` của socket đang giữ quyền, hoặc `null`.
**UI đọc mọi ngưỡng từ `limits`** — Phase 08/09/10 không được hardcode số nào.

#### `event.data`

```json
{ "level": "warn", "source": "safety", "code": "deadman.zero_velocity",
  "message": "Mat ket noi trinh duyet — da gui velocity 0",
  "detail": { "reason": "web_disconnected" } }
```

`level` ∈ `info` · `warn` · `error`. `source` ∈ `mavlink` · `safety` · `mission` · `vision` · `backend`.
`code` là khoá máy đọc (UI lọc/tô màu theo nó); `message` là tiếng Việt cho người đọc.

#### `detection.data`

```json
{ "frame_id": 1042, "frame_ts": 1758412345.02, "width": 320, "height": 240,
  "boxes": [ { "x1": 40.0, "y1": 55.0, "x2": 92.0, "y2": 150.0, "confidence": 0.81, "label": "person" } ] }
```

Toạ độ là **pixel trong hệ của khung gốc** (`width`×`height`) — không phải tỉ lệ 0–1, không phải pixel màn hình. Frontend tự quy đổi theo kích thước hiển thị thật.
`boxes` **được phép rỗng** — và ở Phase 07 đến 10 thường sẽ rỗng hoặc chỉ có box giả, vì bộ nhận diện thật thuộc `plans/ai/`.

#### `ack.data` / `error.data`

```json
{ "ref": "c-17", "command": "cmd.takeoff", "status": "accepted", "detail": null }
{ "ref": "c-17", "command": "cmd.takeoff", "status": "done", "detail": { "altitude": 5.0 } }
```

`status` ∈ `accepted` (backend nhận, hợp lệ) · `done` (FC đã xác nhận). Lệnh chậm (mode, arm, takeoff, mission) gửi **cả hai**; lệnh nhanh chỉ gửi `done`.
**`cmd.velocity` không sinh `ack`** — nó chạy 5–20 Hz, ack sẽ làm ngập socket. Bị từ chối thì mới có `error`.

```json
{ "ref": "c-17", "command": "cmd.takeoff", "code": "validation_failed",
  "message": "Chua armed. Thu tu dung: GUIDED -> arm -> takeoff", "detail": null }
```

| `code` | Nghĩa |
|---|---|
| `unknown_type` | `type` không có trong hợp đồng |
| `unsupported_version` | `v` ≠ 1 |
| `bad_payload` | `data` sai kiểu / thiếu trường |
| `not_implemented` | Hợp đồng có nhưng phase hiện tại chưa làm (kèm số phase trong `message`) |
| `not_connected` | Chưa có link MAVLink |
| `web_control_disabled` | Chưa bật WEB CONTROL |
| `wrong_mode` | Mode hiện tại không cho phép lệnh này |
| `command_denied` | FC trả `MAV_RESULT` khác accepted · tab khác đang giữ quyền · mode ngoài whitelist |
| `validation_failed` | Không qua kiểm tra của backend (mission sai, chưa armed, alt vượt giới hạn) |
| `rate_limited` | Gửi quá nhanh |
| `timeout` | FC không trả lời kịp |
| `internal` | Lỗi backend — kèm `detail` để báo bug |

### Chiều LÊN (client → server)

| `type` | `data` | Giới hạn nhịp | Phase | Ghi chú |
|---|---|---|---|---|
| `ping` | `{}` | 2/s | 05 | Server đáp `pong` `{"server_ts": ...}` |
| `cmd.web_control_enable` | `{"enabled": true}` | 5/s | 05 (cờ) · 06 (hành vi đầy đủ) | Bật/tắt quyền lái của web |
| `cmd.mode` | `{"mode": "GUIDED"}` | 5/s | 06 | Whitelist: `GUIDED, LOITER, ALT_HOLD, POSHOLD, BRAKE, RTL, LAND, AUTO, STABILIZE` |
| `cmd.arm` | `{"arm": true}` | 2/s | 06 | `false` = disarm. **Cấm** mọi tham số force |
| `cmd.takeoff` | `{"altitude": 5.0}` | 2/s | 06 | Phải trong `[MIN_ALT, MAX_ALT]`; vượt → `error`, **không** im lặng kẹp |
| `cmd.velocity` | `{"vx":1.0,"vy":0.0,"vz":0.0,"yaw_rate":0.0}` | **30/s** | 06 | m/s, body frame. `vz` **dương = XUỐNG**. `yaw_rate` độ/s, mặc định 0 |
| `cmd.hold` | `{}` | 5/s | 06 | Chuyển `LOITER` |
| `cmd.rtl` | `{}` | 5/s | 06 | Chuyển `RTL` |
| `cmd.land` | `{}` | 5/s | 06 | Chuyển `LAND` |
| `cmd.mission.upload` | `{"waypoints":[{"seq":1,"lat":10.76,"lon":106.66,"alt":5.0}],"auto_start":false}` | 1/s | 07 | Backend **không** tự chèn takeoff/RTL còn thiếu — báo `validation_failed` để người sửa |

**Giới hạn nhịp:** vượt thì message bị **bỏ**, server gửi `error` `rate_limited` **tối đa 1 lần mỗi giây** (không spam ngược lại client).

### Ví dụ một phiên

```text
C->S {"v":1,"type":"ping","ts":...,"id":"c-1","data":{}}
S->C {"v":1,"type":"pong","ts":...,"data":{"server_ts":...}}
S->C {"v":1,"type":"status","ts":...,"data":{...}}
S->C {"v":1,"type":"telemetry","ts":...,"data":{...}}      <- lặp 8 Hz từ đây
C->S {"v":1,"type":"cmd.web_control_enable","id":"c-2","data":{"enabled":true}}
S->C {"v":1,"type":"ack","data":{"ref":"c-2","command":"cmd.web_control_enable","status":"done"}}
S->C {"v":1,"type":"status","data":{...web_control_enabled:true...}}
```

---

## Cổng pass

- [ ] `uv run python -m backend.mavlink.connection` in `Heartbeat received: yes`, **đồng thời** Mission Planner vẫn nối được SITL ở cổng khác.
- [ ] `ws_probe --measure-rate` cho 7.5–8.5 Hz; mọi trường trong bảng `telemetry.data` (trừ nhóm Phase 07) có giá trị thật khi SITL đã có GPS fix.
- [ ] Tắt SITL → `connected` về `false` + `event` `link.lost` trong ≤ `LINK_TIMEOUT_S`+1 s, backend không crash. Bật lại → tự nối trong ≤ 10 s và `ATTITUDE` trở lại 10 Hz.
- [ ] Gửi `type` lạ → nhận `error` `unknown_type` và **socket vẫn mở**.
- [ ] Hai socket cùng xin web control → socket thứ hai nhận `command_denied`.
- [ ] `backend/ws-contract.schema.json` tồn tại, chứa đủ mọi `type` trong hợp đồng; đã commit.
- [ ] `uv run ruff check .` + `uv run ruff format --check .` sạch; `uv run pytest` xanh toàn bộ (4 file cũ vẫn xanh).
- [ ] `app.py` ≤ 80 dòng; `grep -n "ws/telemetry" backend/` không còn kết quả.
- [ ] Mọi lời gọi `mav.*_send` trong `backend/` đều đi qua `MavlinkConnection.send()` (kiểm bằng `grep -rn "\.mav\." backend/`).
- [ ] Khối Vision trong `backend/config.py` có đủ `YOLO_DEVICE`, `DETECTION_IMGSZ`, `VISION_ENABLED` (5.7); `_env_bool` tồn tại.
- [ ] `docs/so-tay/05-backend-mavlink-telemetry.md` đã viết.

## Rủi ro

| Rủi ro | Khả năng (1-5) | Ảnh hưởng (1-5) | Điểm | Xử lý |
|---|---|---|---|---|
| Không có khoá ghi socket MAVLink → Phase 06 thêm thread thứ hai làm gói đan byte, FC bỏ gói trong im lặng | 4 | 4 | **16** | **Xử lý ngay ở 5.1.3, không để sang Phase 06.** Kiểm chứng: chạy 2 thread cùng gửi 20 Hz trong 60 s, đếm `BAD_DATA` trong MAVProxy phải = 0 |
| Hợp đồng chốt muộn → Phase 08 bị chặn, mất cơ hội làm song song | 3 | 4 | 12 | 5.4 là **mốc commit riêng**; làm xong 5.4 là push ngay, không chờ 5.5/5.6 |
| Nhầm `udp:` / `udpout:` / trùng cổng với Mission Planner | 4 | 2 | 8 | `.env.example` ghi rõ `udpin:`; lệnh ở 5.1 dùng hai `--out` tách bạch; ghi vào sổ tay |
| Reconnect không gọi lại `request_streams()` → sau khi nối lại HUD giật mà không ai hiểu vì sao | 3 | 3 | 9 | Đặt `request_streams()` **bên trong** vòng reconnect; bài nghiệm thu #5 kiểm đúng điều này |
| Đổi `app.py` làm đỏ 3 test đang xanh trong `test_app.py` | 3 | 2 | 6 | 5.3.5 khoá 3 khẳng định phải giữ; sửa test cùng commit nếu buộc phải đổi |
| Bit sức khoẻ EKF đoán sai → `ekf_ok` báo bừa, Phase 06 chặn arm nhầm | 3 | 3 | 9 | Để `None` cho tới khi kiểm chứng bằng console MAVProxy (5.2.2); **không** đoán `True` |
| Vòng broadcast gãy khi một socket chết | 2 | 3 | 6 | `try/except` quanh từng `send_json`, loại socket khỏi `dict`, không thoát vòng lặp |
| pymavlink là LGPL-3.0 còn repo là MIT | 1 | 2 | 2 | Chỉ import runtime (dynamic linking) → không lây. Ghi chú README; chỉ thành vấn đề nếu sau này đóng gói PyInstaller |

## Timeline

| Việc | Giờ | Ghi chú |
|---|---|---|
| 5.1 Lớp kết nối (sysid, reconnect, lock, stream rate) | 3 | Khoá ghi ở 5.1.3 là điều kiện tiên quyết của Phase 06 |
| 5.2 Model pydantic + message mới + event bus | 2.5 | |
| 5.3 WebSocket hub + dispatch + tách `app.py` | 2 | |
| 5.4 Viết + hiện thực hợp đồng, xuất JSON Schema | 1 | **Mốc mở khoá Phase 08 — commit riêng** |
| 5.5 `fakes.py` + `test_ws_protocol.py` | 1 | `FakeMAVLink` là nền cho Phase 06/07 |
| 5.6 Nghiệm thu 6 bài trên SITL | 0.5 | |
| **Tổng** | **10** | Đường găng: 5.1 → 5.2 → 5.3 → 5.4. Phase 06 và Phase 08 cùng bắt đầu được sau 5.4 |

## Ghi chú cho sổ tay

Viết vào `docs/so-tay/05-backend-mavlink-telemetry.md`, cho người chưa biết gì:

1. **MAVLink là gì** — ngôn ngữ giữa máy bay và máy tính mặt đất: một dòng gói tin nhỏ, mỗi gói có tên (`HEARTBEAT`, `ATTITUDE`) và các ô dữ liệu cố định.
2. **Heartbeat** — nhịp tim 1 Hz. Không nghe thấy nhịp = coi như mất liên lạc. Toàn bộ `is_link_alive()` dựa trên điều này.
3. **sysid / compid** — "số nhà" của từng thiết bị trên mạng MAVLink; vì sao backend và Mission Planner không được trùng số.
4. **`udpin` và `udpout`** — ai ngồi chờ, ai gõ cửa. Vẽ mũi tên. Đây là lỗi số một của người mới.
5. **Stream rate** — vì sao phải *xin* FC gửi nhanh hơn, và vì sao xin lại sau mỗi lần nối lại.
6. **WebSocket khác REST ở chỗ nào** — REST là hỏi-đáp, WebSocket là đường dây mở hai chiều. Vì sao dự án này bắt buộc WebSocket (socket đóng = mất quyền lái, đó chính là cơ chế an toàn).
7. **Hợp đồng là gì và vì sao chỉ được có một bản** — ví dụ hai người dịch cùng một câu theo hai cách thì hỏng ở đâu.
8. **Giá trị dẫn xuất** — vì sao `link_age_ms` không được lưu mà phải tính.
9. **Không có xác thực ở Version 1** — hạn chế đã biết, ghi rõ, nêu cách khắc phục nếu sau này cần (token trong query string + chỉ nghe trên 127.0.0.1).
