# Điều khiển giao diện đồ họa trên Windows (`gui.ps1`)

Công cụ để Claude **nhìn màn hình và bấm hộ** trong các phần mềm chỉ có giao diện đồ họa:
Mission Planner, STM32CubeProgrammer, trình nạp DroneBridge, Arduino IDE. Đây là những
bước mà shell và script không với tới được, và cũng là chỗ người mới hay kẹt lâu nhất.

## Quan hệ với MCP server điều khiển Windows

Từ 21/09/2026 dự án có thêm `windows-mcp` đăng ký trong `.mcp.json`. Hai thứ **bổ sung cho
nhau, không thay thế nhau**:

| | `gui.ps1` | `windows-mcp` |
|---|---|---|
| Cách gọi | shell, Claude phải tự soạn đúng cú pháp | tool MCP có schema, không soạn sai được |
| Ref phần tử giữa các lần gọi | không giữ, duyệt lại cây mỗi lần | có |
| Trích DOM trình duyệt | không | có |
| Audit được toàn bộ | được, 380 dòng | không, 34.700 dòng |
| Phụ thuộc mạng | không | có (PyPI) |
| Bị cập nhật ngầm | không | có |

`gui.ps1` là **đường lui**. Windows-MCP có ba issue crash đang mở (#412, #401, #332), nên khi
nó chết giữa chừng thì `gui.ps1` vẫn chạy. Không xoá file này.

So sánh đầy đủ 21 MCP server và lý do chọn: `plans/reports/260921-research-windows-computer-use-mcp.md`.

## Vì sao có file này thay vì dùng computer use của Claude Code

Kiểm chứng ngày 21/09/2026 trên tài liệu chính thức:

| Sản phẩm | Windows | Cách bật |
|---|---|---|
| Claude Code **CLI** | **không hỗ trợ** | chỉ macOS, qua `/mcp` bật server `computer-use` |
| Claude **Desktop app** | **có hỗ trợ** | Settings > General > mục Desktop app > bật Computer use. Cần gói Pro hoặc Max |
| Computer use của Claude API | cần tự dựng VM | bản mẫu chạy Docker + Xvfb, là môi trường Linux |

Yêu cầu hỗ trợ Windows cho CLI đã nộp ba lần: #39190, #54833, #64381 đều đóng "not planned";
#82300 vẫn mở từ 29/07/2026 nhưng không có phản hồi nào từ Anthropic. Không nên chờ.

Máy này chạy Windows và phiên làm việc là Claude Code CLI, nên tool `computer-use`
không tồn tại. File này cung cấp đúng ba năng lực đó bằng PowerShell:

1. **Nhìn** — chụp màn hình hoặc chụp riêng một cửa sổ, tự thu nhỏ cho dễ đọc.
2. **Đọc cấu trúc** — liệt kê cây control bằng UIAutomation, kèm tên, id và toạ độ.
3. **Thao tác** — gọi Invoke/SetValue qua UIAutomation, hoặc bấm theo toạ độ.

UIAutomation đọc được cả tên nút lẫn trạng thái bật/tắt, nên chính xác hơn nhiều so với
bấm mù theo toạ độ. Mission Planner là WinForms nên hợp với cách này.

## Bốn rào an toàn, đều đã thử cho thất bại

| Rào | Chặn cái gì |
|---|---|
| `-Action type` bắt buộc có `-Window` | không bao giờ gõ vào "cửa sổ đang focus" một cách mù quáng |
| Từ chối cửa sổ có thay đổi chưa lưu (tiêu đề bắt đầu bằng `*`) | không phá tài liệu đang dở của bạn. Ghi đè bằng `-Force` |
| Từ chối gõ phím vào Terminal và IDE | gõ lệnh vào shell sẽ đi vòng qua lớp phê duyệt của Claude Code. Ghi đè bằng `-AllowTerminal` |
| Mặc định dán qua clipboard, không gõ từng phím | bộ gõ tiếng Việt làm hỏng ký tự khi dùng SendKeys |

**Luật cứng của dự án:** không dùng công cụ này cho ARM, Motor Test, hay bất kỳ thao tác
nào làm motor quay. Những nút đó người vận hành tự bấm, tay luôn cầm RC. Xem `SAFETY.md`.

## Sự cố đã sinh ra hai rào đầu

Ngày 21/09/2026, lệnh thử nghiệm đầu tiên chạy `Start-Process notepad` rồi gõ chữ test.
Windows không mở Notepad mới mà gắn vào phiên Notepad **đang mở sẵn**, và 54 ký tự rơi
vào đầu file `pnpm.ps1` đang mở trong tab. Phát hiện bằng ảnh chụp, đếm chênh lệch ký tự
833 so với 887, xoá đúng 54 ký tự từ đầu file, khôi phục nguyên trạng. File chưa từng
được lưu nên không có thiệt hại.

Hai bài học đã thành mã: bắt buộc chỉ định cửa sổ, và từ chối cửa sổ có thay đổi chưa lưu.

Lỗi thứ ba phát hiện cùng lúc: SendKeys đi qua tầng bộ gõ, chữ `test` biến thành `tét`.
Vì vậy mặc định chuyển sang dán clipboard, có lưu và trả lại clipboard cũ của bạn.

## Cách dùng

```powershell
# xem có những cửa sổ nào, màn hình nào
pwsh -File scripts/gui/gui.ps1 -Action windows
pwsh -File scripts/gui/gui.ps1 -Action monitors

# nhìn
pwsh -File scripts/gui/gui.ps1 -Action shot -Monitor 0
pwsh -File scripts/gui/gui.ps1 -Action shot -Window "Mission Planner" -Out tmp/mp.png

# đọc cấu trúc trước khi bấm, luôn làm bước này
pwsh -File scripts/gui/gui.ps1 -Action tree -Window "Mission Planner" -Depth 4

# thao tác qua UIAutomation (ưu tiên)
pwsh -File scripts/gui/gui.ps1 -Action invoke   -Window "Mission Planner" -Name "Connect"
pwsh -File scripts/gui/gui.ps1 -Action select   -Window "Mission Planner" -Name "SETUP"
pwsh -File scripts/gui/gui.ps1 -Action setvalue -Window "Mission Planner" -Name "COM Port" -Text "COM5"

# bấm theo toạ độ (khi UIAutomation không thấy control)
pwsh -File scripts/gui/gui.ps1 -Action click -X 1240 -Y 380

# gõ chữ và phím tắt
pwsh -File scripts/gui/gui.ps1 -Action type -Window "Mission Planner" -Text "SERIAL3_PROTOCOL"
pwsh -File scripts/gui/gui.ps1 -Action key  -Window "Mission Planner" -Keys "{ENTER}"
```

Toạ độ trong ảnh chụp cửa sổ là toạ độ tương đối. Lệnh `shot` in ra **góc màn hình** của
cửa sổ; cộng giá trị đó vào toạ độ đọc từ ảnh để ra toạ độ tuyệt đối cho `-Action click`.

## Quy trình chuẩn khi làm một wizard

1. `shot` để nhìn màn hình hiện tại.
2. `tree` để lấy tên chính xác của nút hoặc ô cần thao tác.
3. `invoke` hoặc `setvalue` theo tên, không bấm theo toạ độ nếu tránh được.
4. `shot` lại để xác nhận kết quả đúng như mong đợi.
5. Bước nào ảnh hưởng tới an toàn bay thì dừng lại, mô tả rõ, để người vận hành tự bấm.

## Giới hạn đã biết

- Arduino IDE 2 là ứng dụng Electron, UIAutomation đọc rất kém. Dùng `shot` cộng bấm toạ độ.
- Ứng dụng chạy quyền Administrator sẽ không nhận thao tác từ tiến trình thường. Chạy
  Claude Code với quyền tương đương, hoặc tự bấm bước đó.
- Ảnh chụp tốn khoảng 1.000 đến 1.800 token mỗi tấm. Chụp riêng cửa sổ thay vì cả màn hình
  ảo nhiều màn hình, và giảm `-MaxWidth` khi chỉ cần nhìn bố cục.
- Màn hình ảo của máy này rộng 6720x1620 do có hai màn hình. Luôn chụp theo `-Monitor`
  hoặc theo `-Window`, đừng chụp toàn bộ, chữ sẽ nhỏ tới mức không đọc được.
