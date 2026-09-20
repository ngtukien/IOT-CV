# Phase NN: <tên phase>

| Trạng thái | Phụ thuộc | Ước lượng | Cần phần cứng |
|---|---|---|---|
| chưa bắt đầu | Phase XX | ~N giờ | Không / Có (liệt kê) |

## Mục tiêu
2-4 câu: phase này xong thì hệ thống làm được gì.

## Đầu vào cần có
- File / báo cáo phải đọc trước (đường dẫn).
- Phần mềm / linh kiện phải có sẵn.

## File và thư mục sở hữu
Danh sách đường dẫn phase này được tạo/sửa. Không đụng file ngoài danh sách.

## Việc theo thứ tự
### NN.1 <tên việc>
- Làm gì (mô tả cho người mới, 2-5 câu).
- Lệnh chạy (verbatim, ghi rõ chạy ở PowerShell Windows hay bash trong WSL):
  ```powershell
  ...
  ```
- Kết quả mong đợi (đúng thì thấy gì).
- Nếu lỗi: 2-3 lỗi hay gặp + cách xử lý.

### NN.2 ...

## Cổng pass
- [ ] Điều kiện kiểm chứng được 1 (lệnh + kết quả).
- [ ] ...

## Rủi ro
| Rủi ro | Khả năng (1-5) | Ảnh hưởng (1-5) | Điểm | Xử lý |
|---|---|---|---|---|

## Timeline
| Việc | Giờ | Ghi chú |
|---|---|---|
| Tổng | N | |

## Ghi chú cho sổ tay
Những khái niệm phase này cần giải thích cho người chưa biết gì (để agent viết docs/so-tay/ sau).

## Mục tuỳ chọn thêm

Ngoài tám mục bắt buộc ở trên, một file phase được phép thêm các mục sau khi cần, đặt sau
"Việc theo thứ tự":

- `## Hợp đồng ...` — mục SSOT phụ trợ (ví dụ hợp đồng WebSocket, hợp đồng header) mà các phase
  khác trích dẫn thay vì định nghĩa lại.
- `## Việc trả về backend` / `## Việc trả về luồng chính` — yêu cầu chéo sang track khác (ví dụ
  phase frontend cần backend thêm một trường), ghi rõ ở đây thay vì tự sửa file ngoài ownership.
- `## Hiện trạng từng file (luật prior-art)` — mô tả trạng thái file thật của repo trước khi phase
  này chạy, dùng cho phase cần đọc mã có sẵn trước khi sửa.

## Quy tắc dấu tiếng Việt trong code fence

Khối lệnh/nội dung bên trong code fence **sẽ được ghi ra file trên đĩa hoặc in ra giấy** (script,
param file, checklist in) được phép viết tiếng Việt **không dấu** để an toàn ASCII. Văn xuôi bên
ngoài code fence (mô tả, giải thích, ghi chú) luôn viết **có dấu**.
