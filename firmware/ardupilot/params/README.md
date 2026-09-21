# Parameter ArduPilot — GIAI ĐOẠN 88

Thư mục này **được commit** (khác với `logs/` và `ml/datasets/`). Đây là lịch sử
cấu hình flight controller, để khi chỉnh sai parameter thì restore được trạng
thái đã chạy tốt thay vì nhớ bằng đầu.

Quy ước tên file, đánh số tăng dần theo mốc:

```text
00-after-flash.param
01-base.param
02-radio.param
03-gps.param
04-first-flight.param
05-loiter-good.param
06-auto-good.param
07-final.param
```

Cách lưu: Mission Planner -> Config/Tuning -> Full Parameter List -> Save to file.

Mỗi lần commit file mới, ghi rõ trong commit message đã thay đổi parameter nào và
vì sao (dùng prefix `param:`).
