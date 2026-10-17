# Nguồn của hướng dẫn lắp ráp

`docs/huong-dan/lap-rap-phan-cung.html` là bản dựng, một file tự chứa (ảnh, sơ đồ, mô hình 3D đều
nhúng sẵn, mở được không cần mạng). Muốn sửa nội dung thì sửa trong `src/` rồi dựng lại:

```
py -3.13 docs/huong-dan/lap-rap/build.py
```

Cần có: Python 3.13, ImageMagick (`magick` — đọc ảnh HEIC, xuất WebP), Node và
`frontend/node_modules` đã cài (rolldown + three để đóng gói mô hình 3D).

Ảnh gốc lấy từ `picture/` và `assignment/_build/img/official/` (thư mục sau không nằm trong git, chỉ có
trên máy dự án). Thiếu ảnh nào thì build báo tên ảnh và dừng. Ảnh đã chuyển và bản đóng gói 3D được
giữ ở `D:\DevCache\tmp\lap-rap-build` (đổi bằng biến môi trường `LAP_RAP_BUILD_DIR`).

| File | Nội dung |
|---|---|
| `src/data-status.js` | trạng thái dự án, phase, 7 chặng, bảng "tài liệu cũ đã đổi" |
| `src/data-parts.js` | 16 linh kiện + 24 món hộp Deluxe |
| `src/data-cables.js` | họ giắc, cỡ dây, từng mối nối (dây gì, giắc gì, lấy ở đâu) |
| `src/data-steps.js`, `src/data-steps2.js` | 76 bước chặng A → G |
| `src/data-pc.js`, `src/data-tools.js` | phần máy tính, cổng COM, ngưỡng, dụng cụ, luật an toàn |
| `src/diag-*.js` | sơ đồ SVG vẽ bằng mã, màu đổi theo nền sáng / tối |
| `src/scene3d.js` | mô hình 3D (three.js), kích thước theo mm của linh kiện thật |
| `src/app.js`, `src/core.js` | điều hướng, tick bước (lưu trong trình duyệt), tìm kiếm, phóng to |
| `src/images.json` | danh sách ảnh nhúng: nguồn, vùng cắt, cỡ |

Sửa dữ liệu (bước, linh kiện, trạng thái) thì đối chiếu nguồn sự thật trước: `docs/phan-cung-thuc-te.md`,
`firmware/ardupilot/params/*.param`, `plans/PROGRESS.md`.
