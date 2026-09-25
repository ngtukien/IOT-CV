# Sổ ghi kết quả nghiệm thu

File này được `SAFETY.md` mục 10 tham chiếu: **không demo chức năng chưa pass
standalone test**. Mỗi bài ghi lại ngày, môi trường, số đo THẬT, và ai chạy.

Quy tắc ghi:

- **Ghi số đo, không ghi "OK".** "ground_speed = 0.99 m/s" nói được nhiều hơn
  một dấu tích, và sáu tháng sau vẫn đọc được.
- **Bài không đạt cũng ghi**, kèm lý do và ngày chạy lại. Xoá một lần đỏ đi là
  xoá mất thứ duy nhất giải thích vì sao code hiện tại trông như vậy.
- Bài trên SITL và bài trên drone thật là **hai dòng khác nhau**, không gộp.

---

## Phase 06 — điều khiển và DEAD-MAN

**Môi trường:** ArduCopter SITL 4.7-dev headless (`--no-mavproxy`, `--speedup=1`)
trong WSL2 Ubuntu, mirrored networking · backend FastAPI trên Windows, endpoint
`tcp:127.0.0.1:5760` · `MAX_VELOCITY=1.0`, `MAX_ALT=10`, `MANUAL_COMMAND_TIMEOUT_MS=300`,
`DEADMAN_TICK_MS=50`, `ZERO_VELOCITY_REPEAT=5`.

**Ngày:** 2026-09-22 · **Người chạy:** Claude (phiên `/t1k:cook` Phase 06).

`speedup=1` là cố ý: mấy bài dưới ĐO THỜI GIAN, chạy nhanh giả thì con số vô nghĩa.

### 6.8 — bốn bài nghiệm thu tay

| # | Bài | Cách chạy | Kết quả | Đạt |
|---|---|---|---|---|
| 1 | Takeoff từ web | `ws_probe.py --script plans/samples/takeoff.jsonl` | 4 lệnh đều `ack done`; `relative_alt` 5.00 m, mode GUIDED, armed | ✅ |
| 2 | **W → tiến** | `cmd.velocity {vx:1.0}` 10 Hz trong 5 s | `ground_speed` = **0.993 m/s** (xin 1.0, kẹp `MAX_VELOCITY`) | ✅ |
| 3 | **Thả → dừng** | Ngừng gửi velocity | `ground_speed` 0.993 → 0.094 → **0.018 m/s** trong ~2 s | ✅ |
| 4 | **Đóng trình duyệt → dừng** | `sitl_deadman_check.py` | zero-velocity sau **< 1 ms**; `ground_speed` về 0.19 m/s | ✅ |

Bài 2, 3, 4 **chính là** ba test bắt buộc của `SAFETY.md` §5, chạy trên hệ thống
thật thay vì trên logic.

Bài 5 (RC lấy lại quyền từ web) **chưa chạy** — SITL không có RC thật; thuộc
Phase 21.

### §6.7 — `sitl_deadman_check.py`, lần chạy đạt

```text
[0/6] SITL san sang      OK  (3D fix + EKF)
[1/6] web control ON     OK
[2/6] mode GUIDED        OK
[3/6] armed              OK
[4/6] takeoff 5m         OK  -> alt 5.1 m, on dinh
[5/6] vx=1.0 trong 4.0s  ground_speed = 0.99 m/s
[6/6] socket closed      reason=web_disconnected · zero-velocity sau 0.0 ms
                         -> ground_speed 0.19 m/s
KET QUA: PASS
```

`logs/deadman.jsonl` sau lần chạy — **đúng một dòng cho một lần trip**:

```json
{"ts": 1790044993.9727855, "mono": 4608.6987342, "reason": "web_disconnected",
 "vx": 0.0, "vy": 0.0, "vz": 0.0, "socket_id": "s-2", "repeat": 5, "sent": true}
```

**Vì sao độ trễ dưới 1 ms mà không phải "chưa đo được":** đường đóng-socket chạy
ĐỒNG BỘ ngay trong event loop (`hub.disconnect()` gọi thẳng `deadman.trip()`),
không qua hàng đợi nào. Đây là đường nhanh có chủ đích, khác hẳn đường hết-hạn
(≤ 350 ms). Bảo đảm công bố của hệ thống vẫn là **350 ms**, không phải 0 ms.

### Các cổng pass khác

| Cổng | Kết quả |
|---|---|
| `pytest backend/tests/test_deadman.py` | **17 passed** (3 bài bắt buộc `SAFETY.md` §5 + 3 củng cố + 11 bổ sung) |
| `pytest backend/tests/test_control.py` | **17 passed** (gồm 2 bài canh gác hàm cấm) |
| `pytest backend/tests/test_safety.py` | **9 passed** — vốn cũ của Phase 05, không bài nào bị phá |
| `pytest` toàn bộ | **131 passed** (trước phase: 96) |
| `ruff check .` | sạch |
| `grep -rniE "send_motor_pwm\|rc_channels_override\|21196\|do_motor_test\|actuator_control\|set_attitude_target" backend/` | chỉ ra dòng **ghi chú cấm** và danh sách của chính bài test canh gác; không lời gọi thật nào |
| `grep -n "\.mav\." backend/mavlink/control.py` | 2 kết quả, cả hai là **tham số** của `self.connection.send(...)` |
| Xin `takeoff 50` (vượt `MAX_ALT=10`) trên SITL | `validation_failed: "Do cao 50 m nam ngoai khoang cho phep [2, 10] m"`; `relative_alt` giữ nguyên **5.02 m** — không lệnh 22 nào được gửi |

### Chứng minh test ĐỎ ĐƯỢC (không chỉ xanh)

Một test chưa từng thấy đỏ là một test chưa được chứng minh. Ba lần phá có chủ đích:

| Phá gì | Test | Kết quả |
|---|---|---|
| `DeadmanLoop` → `asyncio.create_task` trên **chính** loop bị chẹn | `test_event_loop_bi_chen_van_gui_zero` | ĐỎ: `vong dead-man khong chay khi event loop bi chen` |
| Đường đóng-socket chỉ tắt cờ, không gửi zero | `test_dong_browser_khi_dang_giu_W_thi_dung` | ĐỎ: `assert 1.0 == 0.0` — drone vẫn đang bay |
| Bỏ điều kiện "chưa có lệnh lái nào" khỏi `tick()` | `test_bat_web_control_xong_ma_chua_lai_thi_khong_tu_trip` | ĐỎ: `gui velocity khi chua ai lai lan nao` |

**Một lần phá KHÔNG làm test đỏ, và đó là thông tin quan trọng nhất trong bảng
này:** bản đầu của test #5 gọi `deadman.start()` TRƯỚC `asyncio.run(...)`, nên một
bản asyncio đặt ở thread riêng vẫn qua được — test khi đó không canh gì cả.
Phải chẹn ĐÚNG cái loop mà bản asyncio sẽ bám vào thì nó mới có răng.

### Ba lỗi chỉ lộ ra khi chạy máy thật

Pytest xanh toàn bộ trong khi cả ba lỗi này đều đang sống. Đây là lý do
`scripts/sitl_deadman_check.py` tồn tại bên cạnh pytest.

| Lỗi | Triệu chứng trên SITL | Vì sao pytest không thấy |
|---|---|---|
| `ack done` của `cmd.arm` nói dối | `cmd.arm` OK rồi `cmd.takeoff` ngay sau đó báo "Chua armed" | Cờ `armed` nằm ở HEARTBEAT (1 Hz); test đặt thẳng `state.armed=True` |
| Dead-man nổ ngay khi bật WEB CONTROL | `web_control.enabled` → `deadman.zero_velocity (deadman_timeout)`; bắn một gói velocity **khi drone còn trên mặt đất**, làm ArduCopter từ chối `NAV_TAKEOFF` với `MAV_RESULT_FAILED` | Test nào cũng gửi một lệnh velocity trước khi bơm thời gian giả |
| Sự kiện đổ tội sai | `"Mode đổi sang GUIDED — web mất quyền lái"` trong khi GUIDED nằm TRONG whitelist | Không test nào đọc `detail.reason` của sự kiện |

Cả ba đã sửa và đều có test hồi quy chạy được **không cần SITL**.

---

## Phase 10 — web điều khiển, vật cản, video, E2E dead-man

**Môi trường:** ArduCopter SITL headless (`sitl-headless.sh`, `--speedup=1`) trong WSL2
Ubuntu · backend FastAPI `tcp:127.0.0.1:5760` phục vụ bản build `frontend/dist` ở
cổng 8000 · Playwright 1.63.0 + Chromium · `MAX_VELOCITY=1.0`, `MAX_ALT=10`,
`MANUAL_COMMAND_TIMEOUT_MS=300`. Bài #9 dùng phiên riêng `run_backend_avoid.py`
(TFmini Plus ảo + lưới cột), backend nghe `tcp:127.0.0.1:5763`.

**Ngày:** 2026-09-25 · **Người chạy:** Claude (phiên `/t1k:cook` Phase 10).
Không bài nào cần bấm tay: mọi thao tác đi qua trình duyệt thật (Playwright), số đo
đọc bằng một socket quan sát chỉ-đọc tới backend.

| # | Bài | Cách chạy | Kết quả | Đạt |
|---|---|---|---|---|
| 1 | Cất cánh từ web | `acceptance.spec.ts` | GUIDED → ARM (gõ `ARM` trong hộp) → TAKEOFF; HUD 5,0 m; marker trên bản đồ | ✓ |
| 2 | Giữ W → tiến theo mũi | `acceptance.spec.ts` | `ground_speed` 1,00 m/s; 3 s dịch 2,1 m hướng 352°, mũi 351° | ✓ |
| 3 | Thả W → dừng | `acceptance.spec.ts` | < 0,2 m/s sau 1306 ms (yêu cầu ≤ 3 s) | ✓ |
| 4 | Đóng tab → dừng | `deadman.spec.ts` (2 lần) | `web_disconnected`, `vx=vy=vz=0`, `sent: true`, sau **6 ms** và **7 ms** (yêu cầu < 300 ms); trang mới thấy < 0,2 m/s | ✓ |
| 5 | Mất tiêu điểm → dừng | `acceptance.spec.ts --headed` | cửa sổ khác giành focus: < 0,2 m/s sau 1062 ms; phím W trên sơ đồ tự nhả | ✓ |
| 6 | Mission từ web | `acceptance.spec.ts` | 3 điểm bấm bản đồ → nạp + đọc lại khớp → AUTO (hộp xác nhận ghi số item) → dòng "KHÔNG tự tránh" hiện → hết mission, hạ cánh, disarm (50 s) | ✓ |
| 7 | HOLD | `acceptance.spec.ts` | giữ W rồi bấm HOLD: LOITER, < 0,2 m/s sau 1304 ms, WEB CONTROL tự tắt | ✓ |
| 8 | Mất camera | `camera-loss.spec.ts` | nguồn giả chạy riêng ở 8081, giết tiến trình giữa chừng: CAMERA OFFLINE sau 2,3 s; link xanh, HUD có số, bản đồ hiện, mode không đổi, không toast đỏ, LOITER vẫn được FC nhận; bật lại nguồn → hình về | ✓ |
| 9 | Vật cản | `avoid.spec.ts` + `run_backend_avoid.py` | LOITER: OFF → NEAR (+75,9 s) → ACTIVE (+77,0 s), sau đó dao động NEAR/ACTIVE theo nhịp phanh; không có dòng cảnh báo. GUIDED: NEAR → OFF, **không lần nào ACTIVE**, dòng "KHÔNG tự tránh" hiện suốt | ✓ |

Box nhận diện (cổng pass "2 kích thước cửa sổ"): đọc điểm ảnh canvas. Cửa sổ
1600×1000 → canvas 430×323, box 19,3% × 25,4%; cửa sổ 1100×900 → canvas 640×480,
box 19,2% × 25,6%. Kỳ vọng từ `fake_stream.py`: 19% × 25,3% (khung 640×480), trong
lề 1/16. Canvas lệch ảnh ≤ 1 px mỗi phía.

### Hai lần đỏ trước khi xanh

- `smoke.spec.ts` lần đầu đỏ vì 20 dòng `ERR_CONNECTION_REFUSED` trong console. Thông
  điệp đó không ghi URL; ghép `location().url` vào thì thấy đều là ảnh nền
  `tile.openstreetmap.org` — máy không tới được máy chủ bản đồ. Không phải lỗi GCS.
- Bài #5 lần đầu đỏ: cửa sổ khác giành focus mà trang không nhận `blur`, phím W vẫn
  "đang giữ". Nguyên nhân là Playwright giả lập focus cho mọi trang. Tắt giả lập bằng
  CDP `Emulation.setFocusEmulationEnabled` + chạy `--headed` thì `blur` là sự kiện
  thật, và bài xanh. Test đỏ được đúng lúc cơ chế không chạy — đó là bằng chứng nó đo
  thật.

