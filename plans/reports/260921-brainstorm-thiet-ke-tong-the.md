# Brainstorm: thiết kế tổng thể dự án UAV IoT + Xử lý ảnh (đã duyệt 21/09/2026)

Trạng thái: **đã duyệt** (kiến trúc + frontend Vite/React; cấu trúc phase sửa lần 3 thành 25 phase chính + 4 phase AI theo yêu cầu người dùng). Hai điểm để mở, ghi ở `plans/QUYET-DINH-CHUA-CHOT.md`: chọn camera, chọn đề tài Xử lý ảnh.

Nguồn: 4 báo cáo nghiên cứu cùng ngày trong `plans/reports/260921-research-*.md`. README 3800 dòng cũ là bản nháp tham khảo, không phải kế hoạch bám theo.

## 1. Bài toán và yêu cầu

Xây quadcopter tự chế (khung Holybro S500, SpeedyBee F405 V5, ArduPilot Copter 4.7.1 custom build) có:

- Bay tay bằng RC FlySky, bay tự động theo waypoint, Hold/RTL/Land.
- Tránh / phanh trước vật cản bằng TFmini Plus (AVOID ở Loiter/AltHold, OA path planner ở Auto).
- Website GCS: telemetry, bản đồ + mission editor, điều khiển tay WASD/joystick qua GUIDED có dead-man, video có khung AI, log sự kiện, dashboard IoT.
- Camera nhúng giá rẻ gửi MJPEG qua Wi-Fi về laptop; AI (YOLO) chạy trên laptop.
- Phục vụ hai môn: Xử lý ảnh (đề tài còn mở) và IoT.

Ràng buộc: người làm mới hoàn toàn; phần cứng về sau ~1 tuần; không deadline cứng; máy Ryzen 9 + RTX 4060 8GB + 40GB RAM, Windows 11 + WSL2 Ubuntu 24.04 + Docker; ưu tiên làm hết phần code trên PC trước.

## 2. Các lựa chọn đã đánh giá

| Quyết định | Chọn | Loại | Lý do quyết định |
|---|---|---|---|
| Mô phỏng | WSL2 Ubuntu 24.04 build ArduPilot từ nguồn, mirrored networking | Docker SITL, binary dựng sẵn, Cygwin | Chỉ đường này có `sim_vehicle.py` + map + console; Mission Planner nối qua localhost |
| GCS kiểm chứng | Mission Planner (bắt buộc) + MAVProxy | QGroundControl | MP nạp firmware, Full Parameter List, calib; QGC không thay được |
| Nạp firmware lần đầu | STM32CubeProgrammer + `arducopter_with_bl.hex` (đã có trong tar.gz) | Mission Planner custom firmware, dfu-util+Zadig | Lần đầu phải ghi bootloader qua DFU; MP chỉ cho lần sau (`.apj`) |
| Lớp MAVLink | pymavlink 2.4.49 | MAVSDK-Python, mavlink2rest, DroneKit | ArduPilot chính chủ; MAVSDK PX4-first + đang đổi tên gói; DroneKit chết 2017 |
| Frontend | Vite 8 + React 19 + TS + Tailwind 4 + shadcn/ui | Next.js 16, vanilla JS | Dashboard 1 người trên LAN, không cần SSR; FastAPI đã serve static; một tiến trình |
| Bản đồ | Leaflet + react-leaflet + terra-draw | MapLibre GL + PMTiles | Đã dùng, dễ học; chuyển MapLibre chỉ khi cần offline tiles |
| Realtime | Một WebSocket: telemetry xuống + lệnh lên + box YOLO | SSE + REST | Dead-man dựa trên "socket đóng = mất quyền"; SSE một chiều |
| State | zustand; TanStack Query chỉ cho REST | | Telemetry là push, không phải request/response |
| Video | Backend proxy MJPEG fan-out (không re-encode) + box qua WS + canvas overlay | `<img>` thẳng vào ESP32, re-encode, WebRTC | ESP32 chỉ phục vụ 1 client mà backend đã chiếm; tách FPS video khỏi FPS inference |
| Cầu telemetry | DroneBridge for ESP32 (firmware sẵn, web flasher) trên SERIAL2 | Tự viết sketch, MavESP8266, ELRS backpack, mLRS | ArduPilot document chính thức; có ESP-NOW tầm xa; sketch hiện tại là stub 39 dòng |
| Wi-Fi | Laptop phát hotspot, 2 ESP32 làm STA | Mỗi ESP32 làm AP | Laptop không nối 2 AP cùng lúc |
| Toolchain firmware camera | PlatformIO (VS Code) | Arduino IDE 2, arduino-cli, ESP-IDF | Pin version thư viện, đưa vào CI; Arduino IDE là hạng 2 |
| Model AI | YOLO26n chính (STAL cho vật thể nhỏ) + YOLO11n đối chứng | YOLO11 chỉ, RT-DETR | +1.4 mAP, ít tham số hơn; SAHI bắt buộc vì baseline VisDrone pedestrian ~22% mAP50 |
| Torch | `--index-url .../whl/cu130` (torch 2.14) | cu128 | cu128 dừng ở 2.11 |
| Dataset | VisDrone-person (lấy cả `pedestrian` + `people`) + HERIDAL (CC BY) | UAVDT, TinyPerson, Okutama | UAVDT không có lớp người; TinyPerson cấm đăng ảnh |
| Augment | albumentations ghim 2.0.8 (MIT) + rolling shutter/vignette tự viết | albumentationsx (AGPL) | Gói gốc ngừng bảo trì; tránh AGPL |
| Gán nhãn / data | Label Studio tự host + DVC remote Google Drive | Roboflow, git-LFS | Ảnh người thật không đưa lên cloud; LFS free không đủ |
| Tracking | Markdown trong repo: `plans/phase-NN.md`, `PROGRESS.md`, `docs/so-tay/` | GitHub Projects, Plane | Yêu cầu của người dùng: mọi thứ là file local |

## 3. Kiến trúc chốt

```text
DRONE (S500, F405 V5, ArduCopter 4.7.1 custom: +AVOID_ALTHOLD +OAPATHPLANNER +PROXIMITY +TFMINIPLUS)
├─ iA6B ──iBUS──► SERIAL6 (RC_PROTOCOLS=4)        quyền cao nhất
├─ M10 GPS+IST8310 ─► SERIAL4 (GPS1_TYPE=2) + I2C
├─ OX32 ESC telem ──► SERIAL5 (proto 16)         DShot300 khởi đầu
├─ TFmini Plus ─────► SERIAL3 (proto 9, RNGFND1_TYPE=20, PRX1_TYPE=4, AVOID_ENABLE=3)
├─ ESP32 DevKit + DroneBridge ◄─UART─ SERIAL2 (proto 2, 115200) ─► Wi-Fi UDP 14550
└─ Camera ESP32-S3/ESP32-CAM (chưa chốt) ─► HTTP MJPEG, jpeg_quality đổi lúc chạy, metadata từng khung

LAPTOP (hotspot Wi-Fi)
├─ backend/   FastAPI + pymavlink
│   ├─ mavlink/: connection, telemetry (SET_MESSAGE_INTERVAL), control (GUIDED SET_POSITION_TARGET_LOCAL_NED, type_mask 0x0DC7, lặp ≥1 Hz), mission (COUNT/REQUEST_INT/ITEM_INT/ACK), safety (dead-man 300 ms, web-control-enable, giới hạn), proximity (DISTANCE_SENSOR/OBSTACLE_DISTANCE)
│   ├─ vision/: parser MJPEG thủ công (giữ khung mới nhất), fan-out MJPEG, YOLO 3-5 fps + SAHI, box JSON qua WS
│   ├─ mqtt/: publisher (mosquitto trong Docker)
│   └─ ws: một socket duy nhất, JSON có type
├─ frontend/  Vite + React 19 + TS + Tailwind 4 + shadcn/ui + Leaflet
│   panels: HUD/telemetry, map+mission editor, manual control, mode buttons, obstacle/avoidance, video+overlay, event log, IoT dashboard
├─ ml/        torch cu130, ultralytics, VisDrone-person, degradation pipeline, train/eval (AR-small), SAHI, export ONNX/TensorRT, Label Studio, DVC
└─ Mission Planner (oracle, nạp firmware, calib) · SITL trong WSL2 (drone ảo) · mavp2p khi cần 2 GCS cùng lúc
```

Ba luật cứng (giữ từ `SAFETY.md`): FC là thứ duy nhất ổn định máy bay; web chỉ gửi lệnh mức cao; AI chỉ sinh sự kiện. Backend không có hàm gửi PWM motor.

## 4. Cấu trúc phase (đã duyệt, sửa lần 3: 25 phase chính + 4 phase AI)

Người dùng ưu tiên UAV bay được và đầy đủ tính năng trước, và muốn phase nhỏ, nhiều, chi tiết. Danh sách đánh số là SSOT tại **`plans/_phase-index.md`** (không lặp lại ở đây để tránh lệch). Tóm tắt nhóm:

| Nhóm | Phase | Cần phần cứng? |
|---|---|---|
| Nền tảng PC | 00 cài công cụ · 01 tái cấu trúc repo · 02 WSL2 SITL | Không |
| Drone ảo | 03 học ArduPilot · 04 param + tránh vật cản ảo | Không |
| Backend GCS | 05 MAVLink/telemetry/WS contract · 06 điều khiển + dead-man · 07 mission/proximity/safety | Không |
| Web GCS | 08 khung + HUD · 09 bản đồ + mission · 10 điều khiển/obstacle/video + E2E | Không |
| Firmware + chuẩn bị | 11 ArduPilot param · 12 ESP32/camera/TFmini bench · 13 checklist lắp ráp + mua thêm | Không |
| Hàng về, test trên bàn (không cánh) | 14 nạp firmware · 15 RC/GPS/compass · 16 nguồn/motor/ESC · 17 ESP32/TFmini/camera lên web | Có |
| Lắp ráp + bay | 18 lắp khung · 19 hiệu chỉnh + failsafe · 20 bay RC · 21 bay tự động + web · 22 tránh vật cản thật + tuning | Có |
| IoT + báo cáo | 23 MQTT/sự kiện/dashboard · 24 QoS/hỏng hóc/báo cáo IoT + demo | Có |
| Luồng AI (`plans/ai/`) | ai-01 chuẩn bị · ai-02 huấn luyện/thí nghiệm · ai-03 dữ liệu thật · ai-04 báo cáo XLA | ai-03 cần drone bay |

Luồng AI bắt đầu sau Phase 21 (hoặc song song khi rảnh); không chặn luồng chính. Mỗi phase → một file theo mẫu `plans/_phase-template.md`. Sổ tay `docs/so-tay/` bám cùng số. `plans/PROGRESS.md` là checklist tick.

## 5. Tái cấu trúc repo (đề xuất, thực hiện ở Phase 01)

```text
IOT-CV/
├─ backend/            giữ; thêm proximity, ws protocol, vision parser; pyproject [project] cho uv
├─ frontend/           THAY vanilla JS bằng Vite + React TS (build → frontend/dist, FastAPI serve)
├─ ml/                 giữ; sửa requirements (albumentations==2.0.8, opencv<5), thêm degradation/, experiments/
├─ firmware/           MỚI: gộp esp32/ + params/ + custombuild
│   ├─ ardupilot/      custombuild yaml, hex/apj giải nén (gitignore .hex/.apj/.bin lớn), params/00..07
│   ├─ dronebridge/    ghi chú cấu hình, không code
│   └─ camera/         project PlatformIO cho board camera
├─ docs/
│   ├─ so-tay/         sổ tay từng phase cho người mới
│   ├─ archive/        README 92 giai đoạn cũ, so-tay-lap-f450.html
│   └─ (giữ bao-cao-tong-quan, linh-kien-s500)
├─ plans/              phase-NN.md, PROGRESS.md, QUYET-DINH-CHUA-CHOT.md, reports/
├─ scripts/            run_sitl, run_backend, bench_tfmini.py, github/
├─ docker-compose.yml  mosquitto (backend chạy native trên Windows vì network_mode: host không chạy trên Docker Desktop)
├─ README.md           ngắn: mục tiêu, trạng thái, link plan/sổ tay
└─ .github/workflows   ci: ruff + pytest + pnpm lint/build
```

## 6. Rủi ro chính và cách xử lý

| Rủi ro | Xử lý |
|---|---|
| WSL2 build ArduPilot tốn 6-8 GB, 1 giờ; ổ C còn 29 GB | Ổ WSL đang ở `/dev/sdd` 920 GB trống; bắt đầu build sớm nhất (Phase 0) |
| pymavlink/MAVProxy wheel trễ với Python 3.13 | Dùng Python 3.11 cho backend (`uv python pin 3.11`) |
| `BATT_VOLT_MULT` mâu thuẫn 11.0 vs 11.2 giữa README và hwdef | Đặt theo hwdef rồi hiệu chỉnh bằng đồng hồ vạn năng ở Phase 7 |
| Wi-Fi 2.4 GHz rớt lặt vặt → GCS failsafe kích RTL giữa chừng | `FS_GCS_ENABLE=0` các chuyến đầu; RC là dây cứu sinh |
| ESP32 camera chỉ phục vụ 1 client | Backend là client duy nhất, fan-out cho browser |
| Kỳ vọng mAP lạc quan (VisDrone pedestrian nano ~22% mAP50) | Đặt mục tiêu 30-45% cho lớp person gộp; SAHI bắt buộc; thêm AR-small |
| Chia dataset ngẫu nhiên theo khung → rò rỉ | Chia theo session; test set luôn là ảnh thật chưa augment |
| `git add .` dính 15 GB ảnh | `.gitignore` đã loại `ml/datasets`; DVC từ khi > 1 GB |
| OA BendyRuler lệch sang hướng chưa có dữ liệu với 1 tia TFmini | `OA_TYPE=0` lúc đầu; chỉ bật khi ra bãi rộng có vật cản giả |
| Không có cánh khi test bàn | Luật `NO PROPELLERS` trong SAFETY.md áp cho toàn Phase 7 |

## 7. Tiêu chí thành công

- Phase 00-10 xong: bay SITL hoàn toàn từ website, 3 test dead-man pass, CI xanh.
- Phase 17 xong: drone thật trên bàn hiện telemetry + rangefinder lên web, không cánh.
- Phase 22 xong: 10 bài bay pass có log; tránh vật cản giả hoạt động ở Loiter.
- Phase 23-24: ma trận hỏng hóc pass; báo cáo IoT + demo hoàn chỉnh.
- AI 1-2 xong: Model B đạt mục tiêu; bảng thí nghiệm theo đề tài đã chốt; suy luận ≥ 14 fps (bằng fps camera).
- AI 3-4: kết quả trên ảnh thật; báo cáo Xử lý ảnh hoàn chỉnh.

## 8. Bước tiếp theo

1. `/t1k:plan` viết `plans/phase-00..24` + `plans/ai/ai-phase-01..04` chi tiết (việc, lệnh, cổng pass, rủi ro, file sở hữu).
2. Thực hiện Phase 00-02: cài công cụ, tái cấu trúc repo, WSL2 SITL, sổ tay khung, `PROGRESS.md`.
3. Người dùng chốt 2 quyết định mở ở phiên khác bằng `plans/QUYET-DINH-CHUA-CHOT.md` (trước Phase 13 lên danh sách mua linh kiện và trước AI 2).
