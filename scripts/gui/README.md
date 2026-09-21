# Điều khiển giao diện đồ họa trên Windows (`gui.ps1`)

Công cụ để Claude **nhìn màn hình và bấm hộ** trong các phần mềm chỉ có giao diện đồ họa:
Mission Planner, STM32CubeProgrammer, trình nạp DroneBridge, Arduino IDE. Đây là những
bước mà shell và script không với tới được, và cũng là chỗ người mới hay kẹt lâu nhất.

## Quan hệ với MCP server điều khiển Windows

Từ 21/09/2026 dự án có thêm `cua-driver` đăng ký trong `.mcp.json` (trycua/cua, 25.268 sao,
MIT, có crate Windows riêng, CI kiểm 122/122 thao tác gồm WPF, WinForms, Electron, WebView2).

> ⚠️ **Thứ tự đã chốt ngày 21/09/2026: dùng `cua-driver` TRƯỚC.** `gui.ps1` chỉ chạy khi
> `cua-driver` không dùng được, và phải nói rõ lý do đã lùi. Luật đầy đủ cùng bằng chứng:
> `.claude/rules/computer-use-cua-driver-first.md`. Bảng dưới so sánh năng lực hai công cụ;
> nó **không** có nghĩa là được tuỳ ý chọn cái nào.

Bảng so sánh, hai dòng cuối đo được trong phiên 21/09/2026 trên Mission Planner và trên
wizard STM32CubeProgrammer:

| | `gui.ps1` | `cua-driver` |
|---|---|---|
| Cách gọi | shell, Claude phải tự soạn đúng cú pháp | tool MCP có schema, không soạn sai được |
| Ref phần tử giữa các lần gọi | không giữ, duyệt lại cây mỗi lần | có |
| Trích DOM trình duyệt | không | có |
| Audit được toàn bộ | được, 380 dòng | không |
| Phụ thuộc mạng | không | có (PyPI) |
| Bị cập nhật ngầm | không | có |
| Thấy cửa sổ con / hộp thoại | **không** — chỉ đọc `MainWindowTitle`, một tiến trình ra đúng một dòng | có, mỗi cái một `window_id` |
| Khi thao tác không tới đích | gửi xong, im lặng | báo lỗi có tên và lý do |

`gui.ps1` là **đường lui**. Một MCP server bên ngoài có thể crash hoặc đổi API; khi đó
`gui.ps1` vẫn chạy. Không xoá.

⚠️ **Nhưng UIPI thì lùi về đây cũng vô ích** — xem § "Giới hạn đã biết". Cả hai công cụ đều
chạy ở Medium integrity, nên cửa sổ chạy quyền Administrator chặn cả hai như nhau.

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
pwsh -NoProfile -File scripts/gui/gui.ps1 -Action windows
pwsh -NoProfile -File scripts/gui/gui.ps1 -Action monitors

# nhìn
pwsh -NoProfile -File scripts/gui/gui.ps1 -Action shot -Monitor 0
pwsh -NoProfile -File scripts/gui/gui.ps1 -Action shot -Window "Mission Planner" -Out tmp/mp.png

# đọc cấu trúc trước khi bấm, luôn làm bước này
pwsh -NoProfile -File scripts/gui/gui.ps1 -Action tree -Window "Mission Planner" -Depth 4

# thao tác qua UIAutomation (ưu tiên)
pwsh -NoProfile -File scripts/gui/gui.ps1 -Action invoke   -Window "Mission Planner" -Name "Connect"
pwsh -NoProfile -File scripts/gui/gui.ps1 -Action select   -Window "Mission Planner" -Name "SETUP"
pwsh -NoProfile -File scripts/gui/gui.ps1 -Action setvalue -Window "Mission Planner" -Name "COM Port" -Text "COM5"

# bấm theo toạ độ (khi UIAutomation không thấy control)
pwsh -NoProfile -File scripts/gui/gui.ps1 -Action click -X 1240 -Y 380

# gõ chữ và phím tắt
pwsh -NoProfile -File scripts/gui/gui.ps1 -Action type -Window "Mission Planner" -Text "SERIAL3_PROTOCOL"
pwsh -NoProfile -File scripts/gui/gui.ps1 -Action key  -Window "Mission Planner" -Keys "{ENTER}"
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
- **Ứng dụng chạy quyền Administrator sẽ không nhận thao tác từ tiến trình thường** (ranh
  giới UIPI của Windows). Điều này đúng với **cả `gui.ps1` lẫn `cua-driver`** — cả hai đều ở
  Medium integrity, nên đây không phải lý do để đổi từ công cụ này sang công cụ kia. Khác
  biệt duy nhất là cách báo: `cua-driver` từ chối kèm thông điệp *"the call would return
  success but no input would land"*, còn `gui.ps1` gửi rồi im lặng — tức là nó **thất bại mà
  trông như thành công**, đúng loại lỗi mà `plans/phase-00-cai-cong-cu-pc.md` §00.0 gọi là
  "báo xanh giả". Đường ra là cài/chạy bằng dòng lệnh, hoặc để người vận hành tự bấm bước đó.
  Kiểm chứng 21/09/2026 trên wizard STM32CubeProgrammer 2.23.0.
- **App Java Swing không có cây UIA** (Java Access Bridge mặc định tắt). `-Action tree` và
  `get_window_state` chỉ trả về khung cửa sổ, không thấy nút nào. Phải bấm theo toạ độ đọc
  từ ảnh chụp. Installer của ST thuộc loại này.
- Ảnh chụp tốn khoảng 1.000 đến 1.800 token mỗi tấm. Chụp riêng cửa sổ thay vì cả màn hình
  ảo nhiều màn hình, và giảm `-MaxWidth` khi chỉ cần nhìn bố cục.
- Màn hình ảo của máy này rộng 6720x1620 do có hai màn hình. Luôn chụp theo `-Monitor`
  hoặc theo `-Window`, đừng chụp toàn bộ, chữ sẽ nhỏ tới mức không đọc được.
