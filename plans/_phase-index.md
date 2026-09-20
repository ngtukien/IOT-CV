# Danh sách phase (SSOT đánh số, cập nhật 21/09/2026 lần 3)

Luồng chính `plans/phase-NN-<slug>.md` (UAV bay được + đầy đủ tính năng). Luồng AI `plans/ai/ai-phase-NN-<slug>.md` bắt đầu sau Phase 21 (drone bay tự động ổn), hoặc song song khi rảnh; không chặn luồng chính.

| # | File | Tên | Phụ thuộc | Phần cứng |
|---|---|---|---|---|
| 00 | phase-00-cai-cong-cu-pc.md | Cài công cụ trên Windows: Mission Planner, MAVProxy, STM32CubeProgrammer, VS Code + PlatformIO, Arduino IDE (tuỳ chọn), esptool, uv, pnpm, Docker check | – | Không |
| 01 | phase-01-tai-cau-truc-repo.md | Tái cấu trúc repo: firmware/, docs/archive, docs/so-tay skeleton, pyproject uv, Vite scaffold, docker-compose mosquitto, CI, PROGRESS | 00 | Không |
| 02 | phase-02-wsl2-sitl.md | WSL2 mirrored networking, clone + build ArduPilot Copter-4.7.1, sim_vehicle, Mission Planner nối SITL, MAVProxy cơ bản | 00 | Không |
| 03 | phase-03-hoc-ardupilot-drone-ao.md | Học ArduPilot trên drone ảo: modes, arm/pre-arm, mission bằng Mission Planner, RTL/Land, đọc log UAV Log Viewer, bài tập tay | 02 | Không |
| 04 | phase-04-param-va-tranh-vat-can-ao.md | Nạp thử 01-base/02-avoid param vào SITL, rangefinder + proximity ảo, thấy AVOID/BRAKE và OA hoạt động, ghi lại param SITL từ chối | 03 | Không |
| 05 | phase-05-backend-mavlink-telemetry.md | Backend: lớp kết nối MAVLink, stream rate, model telemetry, WebSocket + HỢP ĐỒNG WS (SSOT cho web) | 01, 02 | Không |
| 06 | phase-06-backend-dieu-khien-deadman.md | Backend: mode/arm/takeoff, GUIDED velocity, dead-man 300 ms, WEB CONTROL ENABLE, 3 test dead-man | 05 | Không |
| 07 | phase-07-backend-mission-proximity-safety.md | Backend: mission validate/upload/readback/AUTO, proximity + AVOID state, safety state machine, REST, coverage ≥80% | 06, 04 | Không |
| 08 | phase-08-web-khung-hud.md | Web: cấu trúc Vite/React, store, ws client, HUD telemetry, connection bar, event log, build serve từ FastAPI | 05, 01 | Không |
| 09 | phase-09-web-ban-do-mission.md | Web: Leaflet map, drone marker, trail, home, geofence, mission editor + upload + readback | 07, 08 | Không |
| 10 | phase-10-web-dieu-khien-obstacle-video.md | Web: WASD/gamepad manual, mode/arm panel, obstacle panel, video panel + overlay (nguồn giả), Playwright E2E dead-man | 09 | Không |
| 11 | phase-11-firmware-ardupilot-param.md | Giải nén custom build, xác nhận feature, params 00..07 quy ước, 01-base.param, 02-avoid-tfmini.param, cách rebuild custom.ardupilot.org | 01 | Không |
| 12 | phase-12-firmware-esp32-camera.md | DroneBridge tải + cấu hình sẵn, project PlatformIO camera (2 env), script bench TFmini, hotspot laptop + firewall | 11 | Không |
| 13 | phase-13-chuan-bi-lap-rap.md | Checklist đấu dây từng connector F405 V5, danh sách mua thêm + câu hỏi shop, sơ đồ bố trí khung S500, in checklist, tập hàn | 11 | Không (trừ 13.6 tập hàn) |
| 14 | phase-14-hang-ve-nap-firmware.md | Kiểm hàng, chụp ảnh, DFU nạp arducopter_with_bl.hex, Mission Planner nhận board, PRX1_TYPE có, 00-after-flash + 01-base | 13 + hàng về | Có |
| 15 | phase-15-ban-rc-gps-compass.md | Bind FS-i6X/iA6B, iBUS R6, radio calib, switch map, RC failsafe; GPS M10 + compass I2C, fix, orient; 02-radio, 03-gps param | 14 | Có |
| 16 | phase-16-ban-nguon-motor-esc.md | Continuity, smoke stopper, cắm pin lần đầu, calib điện áp bằng đồng hồ, motor test không cánh, thứ tự/chiều, DShot300, ESC telemetry | 15 | Có |
| 17 | phase-17-ban-esp32-tfmini-camera.md | ESP32 DevKit + DroneBridge lên SERIAL2, Mission Planner không dây, backend đổi SITL→thật, TFmini bench + R3 + Web obstacle panel, camera stream lên web | 16 + 10 + 12 | Có |
| 18 | phase-18-lap-rap-khung.md | Lắp khung S500, hàn power board, nối dài dây motor 16AWG, bát chống rung, đi dây, GPS mast, TFmini mount, ESP32/camera/UBEC, CG | 17 | Có |
| 19 | phase-19-hieu-chinh-tren-khung-failsafe.md | Power-on trên khung, accel 6 vị trí, compass ngoài trời, radio recheck, motor direction recheck, FS pin/RC/GCS, geofence, pre-arm sạch, gắn cánh đúng chiều | 18 | Có |
| 20 | phase-20-bay-rc-co-ban.md | F1 Stabilize hover, F2 AltHold, F3 Loiter, F4 RTL; đọc log sau mỗi bài (vibe, EKF, compass, pin); 04/05 param | 19 | Có |
| 21 | phase-21-bay-tu-dong-va-web.md | F5 Auto Mission Planner, F6 Guided/Auto từ web, F7 web manual 0.5 m/s, F8 RC override; 06 param | 20 | Có |
| 22 | phase-22-tranh-vat-can-that-va-tuning.md | F9 AVOID với vật cản giả ở Loiter, OA BendyRuler ở bãi rộng, harmonic notch từ ESC RPM, chỉnh AVOID_* / OA_* | 21 | Có |
| 23 | phase-23-iot-mqtt-su-kien-dashboard.md | mosquitto, topic/payload, publisher, detection event pipeline (detector bất kỳ), geo-projection, marker map, IoT panel | 21 | Có |
| 24 | phase-24-iot-qos-hong-hoc-bao-cao.md | QoS loop jpeg_quality + thí nghiệm IoT, 5 bài test hỏng hóc, logging convention, 07-final.param, báo cáo IoT + demo + định nghĩa hoàn thành | 22, 23 | Có |

Luồng AI `plans/ai/`: ai-phase-01-chuan-bi (phụ thuộc 01) · ai-phase-02-huan-luyen-thi-nghiem (ai-01) · ai-phase-03-du-lieu-that (21 + ai-02) · ai-phase-04-bao-cao-xla (ai-03).
