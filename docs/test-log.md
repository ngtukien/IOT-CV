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

## Phase 12 — ESP32 telemetry, camera, hotspot

**Môi trường:** ESP32 DevKit CP2102 (COM4) chạy DroneBridge v2.4.1 · bo ESP32-S3 N16R8 + OV3660
(COM7, cổng USB-UART CH343P) chạy `firmware/camera/` (Arduino core 2.0.17, espressif32 7.1.3) ·
Mobile Hotspot `IOTCV-HOTSPOT` 2,4 GHz trên card MediaTek RZ616, laptop đồng thời nối "The One 2"
5 GHz kênh 128 · chưa đấu FC, chưa có TFmini.

**Ngày:** 2026-10-13 · **Người chạy:** Claude (phiên `/t1k:cook` Phase 12). Không bước nào cần bấm
tay trừ hộp UAC khi tạo rule tường lửa.

| # | Bài | Cách chạy | Kết quả | Đạt |
|---|---|---|---|---|
| 1 | Hotspot 2,4 GHz | `hotspot-on.ps1 -Ssid IOTCV-HOTSPOT` | `On`, `TwoPointFourGigahertz`, laptop `192.168.137.1` | ✓ |
| 2 | Rule tường lửa | `firewall-mavlink.ps1` | đọc lại: `Enabled=True Inbound Allow Profile=Any UDP 14550` | ✓ |
| 3 | DroneBridge vào mạng mới | `dronebridge-nvs.ps1` rồi nghe UDP 14550 6 s | 13 gói từ `192.168.137.60`: HEARTBEAT ×7, RADIO_STATUS ×6 (sys 1 comp 68) | ✓ |
| 4 | Build camera | `pio run -e esp32s3_n16r8` | `SUCCESS`, RAM 14,5 %, flash 11,8 %, không warning | ✓ |
| 5 | Boot camera | `nap_camera.ps1` | `camera init OK pid=0x3660 framesize=VGA`, `psram=8386279`, IP `192.168.137.102`, tên `iotcv-camera.mshome.net` phân giải được | ✓ |
| 6 | `/status`, `/set` | `camera_check.py` bước 1–2 | đủ 5 trường bắt buộc; 6 kiểu tham số sai → 400; 0, 63, 12 → 200 và `/status` báo đúng | ✓ |
| 7 | Hợp đồng MJPEG | `camera_check.py --frames 300` | 300/300 khung đủ 4 header, giải mã sạch, id/timestamp tăng dần, không nhảy cóc | ✓ |
| 8 | Nhãn chất lượng | `camera_check.py` bước 4 | 8→60: khung đầu 6942 B (mức mới 6939, cũ 10017); 60→8: 10038 B (mới 10019, cũ 6940); bỏ 4 khung chuyển tiếp | ✓ |
| 9 | TFmini script | `bench_tfmini.py COM99` | `Khong mo duoc cong COM99: could not open port`, mã 2; parser + 7 lệnh HEX đúng checksum | ✓ |

**Số đo luồng camera** (VGA, `jpeg_quality` 12, RSSI −25 dBm, 300 khung): **7,5 fps**, khung ~8,5 KB,
khoảng chụp trung vị 144 ms (min 71 / max 289). Số cũ "~1,3 fps ở độ phân giải cao" là của
ESP32-CAM/OV2640, không áp dụng.

### XCLK 20 MHz bóp Wi-Fi — đo tách biến

Lần đầu luồng chỉ 2,6–5,3 fps, có một khung hỏng (sọc tím nửa dưới). Tắt Nagle không đổi được gì.
Thêm endpoint thử nghiệm `/blob` (gửi 512 KB từ RAM trong, không đụng camera) vào một bản firmware
ngoài repo, đổi đúng một biến mỗi lần:

| Biến thể | `/blob` | Luồng VGA |
|---|---|---|
| Không khởi động camera | 285 KB/s | — |
| XCLK 20 MHz, `GRAB_LATEST` (như `CameraWebServer` gốc) | 58–67 KB/s | 32–48 KB/s, ~3–4,5 fps |
| XCLK 20 MHz, `GRAB_WHEN_EMPTY` | 18–63 KB/s | ~3,3 fps |
| XCLK 16 MHz | 71–87 KB/s | timeout |
| **XCLK 10 MHz** | **293–297 KB/s** | **105–108 KB/s, ~8,5 fps** |

Kết luận: nhiễu từ XCLK, không phải tranh chấp PSRAM. Firmware dùng 10 MHz.

### Mất sóng khi laptop quét Wi-Fi — đã rõ cơ chế (rủi ro Phase 17)

Lần nghiệm thu cuối có lúc đỏ vì luồng đứng > 5 s. Thêm log vào firmware (vòng nào > 1 s thì in thời
gian lấy khung và gửi), chạy 200 s: 1137 khung, 0 khung hỏng, **31 lần đứng 1,2–2,7 s, một lần 10,5 s
làm đứt kết nối (`0xb006`)**. Mọi lần đều kẹt ở khâu GỬI (`send_ms` 1205–10470), lấy khung chỉ
17–101 ms — camera không kẹt.

`scripts/esp32/wifi_ping_check.py` (ping đồng thời hai bo, 150 s):

| Lần | Camera mất | DroneBridge mất | Giây mất CHUNG |
|---|---|---|---|
| card mặc định | 25/150 | 27/150 | 24 — giây 7–9, 23–24, 38–40, 54–55, 69–70, 84–86, 100–101, 115–117, 131–132, 146–147 |
| `Roaming Aggressiveness = Disabled` | 16/150 | 21/150 | 16 — giây 3, 19, 34, 49–50, 65, 80–81, 95–96, 111, 126–127, 139–142 |

Hai bo khác nhau mất gói **cùng giây, chu kỳ ~15,5 s** → nguồn ở laptop. Tắt roaming không đổi chu kỳ
(đã trả về `Medium-Low`). Hệ quả cho Phase 17/21: telemetry hụt 1–3 s mỗi 15 s, dead-man 300 ms sẽ
dừng drone khi lái tay. Hướng thử tiếp ghi ở `docs/so-tay/12-hotspot-laptop.md` mục 6.

Phụ: card reset làm hotspot khởi động lại và cấp IP mới cho cả hai bo; camera tự nối lại **không
reboot** (`uptime` tiếp tục), DroneBridge đẩy MAVLink lại sau vài giây.

**Kiểm lại sau khi phiên bị ngắt (20:15–20:25)** — không đổi cài đặt gì:

| Bài | Kết quả |
|---|---|
| Ping 90 s, 150 s, 30 s | **0 giây mất** ở cả hai bo; card không quét lần nào |
| Stream camera 150 s cùng lúc ping | 1148 khung, 7,65 fps, 0 khung hỏng, 0 lần đứt; 10 lần khựng 1,2–2,2 s rải rác (TCP gửi lại gói mất) |
| Ép quét `WiFiAdapter.ScanAsync()` ở giây 10 và 25, chạy 2 lần | cả hai bo mất gói cùng giây. Lần chạy 1: giây 27–29 (đúng lần quét thứ hai; lần quét thứ nhất không gây mất). Lần chạy 2: giây 9–14 và 24, 27–29 (trùng hai lần quét), cộng 21–23 không trùng lần quét nào |

Kết luận: mỗi lần laptop quét Wi-Fi, radio rời kênh hotspot 3–6 s. Chu kỳ ~15,5 s lúc trước là do
một chương trình nào đó bắt quét định kỳ, sau đó nó thôi chạy. `wifi_ping_check.py` giờ tự chạy
`wifi_scan_watch.ps1` song song. Kiểm hai chiều: ép quét → in "trùng lúc laptop quét: 10/13" và mã
1; không ép → "quét 0 lần", mã 0. Còn 3/13 giây mất không trùng lần quét nào bộ theo dõi thấy — nó
chỉ thấy các lần quét có kết quả, chưa giải thích được hết.

**Driver CP210x trả dữ liệu ma (COM4):** sau khi phiên bị ngắt, đọc log COM4 không reset ra
1.039.872 byte trong 3 s, toàn chuỗi `ending complete` — gấp ~30 lần mức 115200 baud chở được. Bo vẫn
chạy tốt (MAVLink, web UI). Một lần `esptool flash-id` mở cổng lại là hết. `esp32_log.py` giờ xoá bộ
đệm khi mở cổng và tự dừng (mã 3) nếu tốc độ vượt mức cổng chở nổi: ngưỡng 60.032 B/3 s chặn số liệu
ma, cho qua log khởi động thật (7.725 B/15 s).

### Chứng minh phép kiểm ĐỎ ĐƯỢC

- **Khung hỏng:** bộ phát hiện đầu tiên (bắt stderr bằng `os.dup2` trong cùng tiến trình) trả "sạch"
  cho cả khung đã biết là hỏng — DLL OpenCV có bảng fd riêng. Bỏ, thay bằng giải mã ở tiến trình con:
  chuỗi tốt/hỏng/tốt/hỏng/tốt/cắt-ngắn/tốt cho đúng
  `''`/`premature end of data segment`/`''`/…/`premature end…`/`''`.
- **Nhãn chất lượng:** nạp bản thử `QUALITY_SETTLE_FRAMES = 0` → bước 4 **FAIL** ở chiều 60→8 (khung
  đầu nhãn 8 nặng 6937 B = cỡ của mức 60). Nạp lại firmware thật → PASS.
- **Ngưỡng tỉ lệ cỡ khung 1,4 lần** (bản đầu của bước 4) đỏ vì cảnh trần trơn chỉ chênh 1,3 lần — ngưỡng
  phụ thuộc cảnh là sai thiết kế. Thay bằng "khung đầu gần mức mới hơn mức cũ ít nhất 3 lần" và "hai
  mức chênh ≥ 10 %".

### OTA — nạp firmware camera qua Wi-Fi (mở rộng 13/10/2026, plan §12.9)

Bản có OTA nạp USB một lần: `FIRMWARE sha=c4bf760faf53dddf partition=app0`. `ota_camera.py` tự tính
SHA từ `firmware.bin` ra đúng `c4bf760faf53dddf` (= 16 hex đầu `sha256sum firmware.elf`) → script
dừng ở "chip đã chạy đúng bản này".

**Phép thử đỏ** (script ngoài repo bắn thẳng vào `POST /update`; sau mỗi bài đọc lại `/status`):

| Yêu cầu sai | Chip trả | Khởi động lại | Sau đó |
|---|---|---|---|
| Sai token | `401 sai hoac thieu X-OTA-Token` | không | `c4bf…` / `app0` / camera OK |
| Thiếu `X-OTA-MD5` | `400` | không | như trên |
| MD5 không khớp | `422 MD5 Check Failed` | có | như trên — bản cũ |
| Gửi 200 KB / 793 KB rồi cắt kết nối | (đã cắt) | có | như trên — bản cũ |
| 300 KB dữ liệu rác, MD5 đúng của rác | `500 Wrong Magic Byte` | có | như trên — bản cũ |

**Phép thử xanh:**

| Bài | Kết quả |
|---|---|
| `ota_camera.py --force` (cùng bản) | `200`, gửi 6,6 s, chạy lại sau 8,9 s; khe `app0` → `app1`, SHA khớp, camera OK |
| Nạp một **biến thể** (chỉ đổi dòng log khởi động, SHA `c28cf61fb3720f84`) | chip báo đúng `c28cf61f…`, khe `app1` → `app0` |
| `ota_camera.py` nạp lại bản thật | `c4bf760f…`, khe `app0` → `app1`, PASS |
| OTA **trong lúc đang stream** | PASS (khe `app1` → `app0`); người xem: luồng cắt gọn (`IncompleteRead`), 8 lần nối lại nhận `503` trong lúc nạp, rồi luồng chạy lại; 0 khung hỏng |
| `camera_check.py --frames 120` sau OTA | PASS, 120/120 khung sạch, 8,1 fps |
| `nap_camera.ps1 -Ota` (lệnh gói) | build xong, "chip đã chạy đúng bản này", mã 0 |
| `camera-secrets.ps1` chạy hai lần | token OTA 32 hex, giữ nguyên (cùng dấu băm dòng token) |
