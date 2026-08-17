# SAFETY — luật cứng của dự án

Đây là một UAV thật, có 4 cánh quạt quay ở tốc độ có thể gây thương tích nặng.
Các luật dưới đây không phải khuyến nghị. Vi phạm bất kỳ luật nào là lý do đủ để
huỷ buổi test.

## 1. Kiến trúc — ai được quyền điều khiển máy bay

```text
Flight controller (ArduPilot) là thành phần DUY NHẤT chịu trách nhiệm ổn định máy bay.
```

- Web chỉ gửi lệnh **mức cao**: đổi mode, arm/disarm, takeoff, land, RTL, velocity
  setpoint trong Guided, upload mission.
- **YOLO tuyệt đối không điều khiển ESC / motor / mặt phẳng điều khiển.** AI chỉ
  sinh ra event.
- Backend **không có** hàm `send_motor_pwm()`. Không thêm hàm đó.
- Không tự viết PID, không tự viết firmware điều khiển bay.

## 2. Cánh quạt

```text
NO PROPELLERS
```

Bắt buộc tháo cánh khi:

- Motor test (GIAI ĐOẠN 42)
- Kiểm tra chiều quay motor (GIAI ĐOẠN 43)
- ESC calibration (GIAI ĐOẠN 44)
- Test RC failsafe (GIAI ĐOẠN 46)
- Test GCS failsafe / mất Wi-Fi (GIAI ĐOẠN 47, 81)
- Mọi lần test lệnh từ web khi drone còn trên bàn (GIAI ĐOẠN 61, 62)
- Test camera khi motor chạy (GIAI ĐOẠN 70)

Chỉ gắn cánh sau khi **toàn bộ** checklist GIAI ĐOẠN 49 đã pass.

## 3. Pre-arm check

Không disable hàng loạt pre-arm check để "cho nó arm được". Pre-arm check báo lỗi
nghĩa là có nguyên nhân thật (RC, GPS, compass, baro, battery, EKF). Sửa nguyên
nhân, không tắt cảnh báo.

## 4. RC luôn có quyền cao nhất

- Người vận hành **luôn cầm RC transmitter** trong mọi bài bay có web tham gia.
- Web không được tự giành quyền: operator phải chủ động bật `WEB CONTROL ENABLE`.
- Bài test GIAI ĐOẠN 65 (RC lấy lại quyền từ web) là **bắt buộc** trước khi bay
  web-guided thật.

## 5. Dead-man cho manual control (WASD)

Ba test của GIAI ĐOẠN 11 phải pass trên SITL trước khi thử trên drone thật:

1. Nhấn `W` -> UAV tiến.
2. Thả `W` -> UAV dừng.
3. **Đóng browser khi đang giữ `W` -> UAV phải dừng.**

Backend phải có timeout độc lập (~300 ms) và tự gửi velocity = 0, không phụ thuộc
việc frontend có gửi lệnh dừng hay không.

## 6. Pin LiPo

- Không dùng pin phồng, rách vỏ, dây lỏng, hoặc lệch cell bất thường.
- Kiểm tra điện áp từng cell trước mỗi buổi bay.
- Không sạc pin khi không có người trông.
- Đối chiếu điện áp Mission Planner với multimeter trước khi tin vào ngưỡng
  battery failsafe.

## 7. Nguồn điện

- Đo continuity `BAT+` <-> `GND` bằng multimeter **trước khi** cắm pin lần đầu.
- Nếu nghi ngắn mạch: không cắm pin.
- Dùng smoke stopper ở lần power-on đầu tiên nếu có.

## 8. Địa điểm bay

- Sân rộng, không người ngoài, không xe, không cây gần.
- Bay thấp trước (0.5–1 m), tăng dần.
- Bật geofence trên ArduPilot (giới hạn độ cao + bán kính) trước demo.
  Geofence phần mềm ở website chỉ là lớp phụ; **ArduPilot geofence mới là lớp
  authoritative**.

## 9. Camera và AI không được ảnh hưởng bay

Khi ESP32-CAM ngắt hoặc process YOLO crash:

```text
telemetry vẫn chạy
control vẫn chạy
UAV không đổi mode
```

Nếu mất camera làm UAV đổi hành vi bay, đó là bug nghiêm trọng, phải sửa trước
khi bay tiếp.

## 10. Không demo chức năng chưa pass standalone test

Xem test matrix ở GIAI ĐOẠN 84 và [docs/test-log.md](docs/test-log.md).
