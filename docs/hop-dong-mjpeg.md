# Hợp đồng luồng MJPEG — nguồn sự thật duy nhất

Mọi nguồn video của dự án (nguồn giả `backend/vision/fake_stream.py` ở Phase 07,
ESP32-CAM thật ở Phase 17) phát theo đúng hợp đồng này, và `backend/vision/stream.py`
đọc theo đúng hợp đồng này. `plans/phase-12-firmware-esp32-camera.md` và
`plans/ai/ai-phase-01-chuan-bi.md` chỉ **trích dẫn** file này; không nơi nào khác
được định nghĩa lại tên header.

## 1. Vận chuyển

- HTTP `GET`, trả `200` với
  `Content-Type: multipart/x-mixed-replace; boundary=frame`.
- Mỗi khung là một **phần** (part) của multipart. Luồng không bao giờ kết thúc
  chủ động; bên đọc tự đóng kết nối khi không cần nữa.

## 2. Một phần (part)

```text
--frame\r\n
Content-Type: image/jpeg\r\n
X-Frame-Id: <n>\r\n
X-Timestamp-Ms: <ms>\r\n
X-Jpeg-Quality: <q>\r\n
X-Framesize: <tên>\r\n
Content-Length: <N>\r\n
\r\n
<N byte JPEG>\r\n
```

- Header và thân ngăn nhau bằng **một dòng trống** (`\r\n\r\n`). Thiếu dòng này,
  trình duyệt tải mãi không hiện gì.
- `Content-Length` là số byte **thật** của JPEG. Bên đọc đọc **đúng** chừng đó byte,
  không đọc theo dòng: JPEG là nhị phân và có thể chứa byte `\n`.
- Sau thân JPEG là `\r\n` rồi mới tới `--frame` của phần kế.

## 3. Bốn header riêng của dự án

| Header | Kiểu | Ý nghĩa |
|---|---|---|
| `X-Frame-Id` | uint32, tăng dần | Số thứ tự khung, bắt đầu từ 0. Nhảy cóc = có khung bị rớt |
| `X-Timestamp-Ms` | uint32, mili-giây | Mốc thời gian phía **nguồn**, đếm từ lúc thiết bị/tiến trình khởi động. **Không phải** epoch |
| `X-Jpeg-Quality` | int, 0–63 | Chất lượng nén JPEG lúc chụp, theo thang của `esp32-camera` (số NHỎ = nét hơn) |
| `X-Framesize` | string | Tên khung hình kiểu `esp32-camera`: `QVGA` (320×240), `VGA` (640×480), `SVGA` (800×600)… |

Không thêm, không bớt header riêng nào ngoài bốn cái trên. `Content-Type` và
`Content-Length` là header chuẩn của multipart, không tính vào bốn cái này.

## 4. Quy tắc cho bên đọc

- Tên header so khớp **không phân biệt hoa/thường** (`x-frame-id` = `X-Frame-Id`).
- Thiếu một trong bốn header riêng thì vẫn nhận khung, trường đó coi là "không biết"
  (`None`). Thiếu `Content-Length` thì **bỏ** phần đó: không có cách an toàn để
  biết JPEG dài bao nhiêu.
- Chỉ giữ **khung mới nhất**. Không xếp hàng đợi: nguồn nhanh hơn người xem thì
  hàng đợi chỉ làm hình trễ dần.

## 5. Vì sao chọn QVGA làm mốc

`plans/reports/260921-research-web-gcs-stack.md` §4.1: ESP32-CAM đạt khoảng 44 fps ở
QVGA so với 14 fps ở VGA. Nguồn giả vì thế cũng phát QVGA 320×240, để mọi thứ phía
sau (canvas overlay ở Phase 10, toạ độ box) được dựng trên đúng kích thước sẽ gặp
với phần cứng thật.
