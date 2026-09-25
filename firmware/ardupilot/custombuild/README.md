# Custom build ArduPilot

File `.yaml` trong thư mục này là **đầu vào của custom build server**
(<https://custom.ardupilot.org>), **không phải** file nạp vào bo bay.

| | File | Nạp vào bo bay? |
|---|---|---|
| Công thức | `speedybeef4v5-copter471-tfminiplus.yaml` — danh sách 54 feature | **Không.** Kéo thả vào server để server build ra firmware |
| Firmware | `../build-d450a747/arducopter_with_bl.hex`, `arducopter.apj` | **Có**, ở Phase 14 |
| Parameter | `../params/01-base.param`, `02-avoid-tfmini.param` | **Có**, sau khi đã nạp firmware |

Người mới rất hay nhầm: mở Mission Planner rồi tìm cách "nạp file yaml". Yaml chỉ dùng
một lần, trên trang web, để sinh ra firmware.

Phần chú thích ở đầu file yaml ghi lý do bật/tắt từng nhóm feature. **Đừng xoá phần
đó** khi dựng lại; server bỏ qua dòng `#`.

Bản build hiện tại, cách kiểm chứng nó có đúng feature, và các bước dựng lại:
[`../build-d450a747/NOTES.md`](../build-d450a747/NOTES.md).
