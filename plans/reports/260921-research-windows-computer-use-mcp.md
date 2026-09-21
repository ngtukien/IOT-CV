# Nghiên cứu: MCP server điều khiển desktop Windows cho agent LLM

**Ngày:** 2026-09-21 · **Lane:** 1 (MCP servers only) · **Người thực hiện:** t1k-researcher

Mọi số sao / ngày commit dưới đây đều lấy trực tiếp từ `gh api repos/OWNER/NAME` và
`gh api repos/OWNER/NAME/commits?per_page=1` ngày 2026-09-21. Không có số nào lấy từ trí nhớ.
Thứ gì không kiểm chứng được nằm ở mục "Chưa xác minh" cuối bài.

## Tóm tắt điều hành

Có một hệ sinh thái thật sự, không phải chỉ 1-2 repo đồ chơi. **21 MCP server** điều khiển
desktop Windows đã được xác minh, trong đó **8 repo dùng UIAutomation / accessibility tree** chứ
không chỉ pixel. Trục quan trọng nhất (UIA vs pixel) chia rõ thị trường làm hai: nhóm PyAutoGUI
(click theo toạ độ, mù trước layout) và nhóm UIA (click theo tên control, sống sót qua đổi DPI,
resize, đổi vị trí cửa sổ).

Vì `anthropics/claude-code#64381` đã **CLOSED as not planned**, Claude Code CLI trên Windows sẽ
không bao giờ có computer-use gốc. MCP server là con đường duy nhất. Dự án đã có `scripts/gui/gui.ps1`
(380 dòng, UIAutomation + screenshot theo monitor + clipboard typing), nên câu hỏi không còn là
"có UIA không" mà là "MCP server nào bù được khoảng trống mà gui.ps1 còn thiếu".

**Khuyến nghị: `CursorTouch/Windows-MCP` (hạng 1) + `shanselman/FlaUI-MCP` (hạng 2, chạy song song).**

---

## Bảng ứng viên đã xác minh

Sắp theo số sao giảm dần. `last commit` = commit mới nhất trên nhánh mặc định.

| # | Repo | ★ | Last commit | License | Ngôn ngữ / runtime | Cài đặt | **UIA hay pixel?** | Multi-monitor | Key/cloud? | ~LOC |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | [CursorTouch/Windows-MCP](https://github.com/CursorTouch/Windows-MCP) | 7059 | 2026-09-12 | MIT | Python (comtypes + pywin32 + dxcam) | `uvx windows-mcp serve` | **UIA** — "The accessibility tree is built on demand for every tool call"; deps `comtypes`, credit `Python-UIAutomation-for-Windows` | **Có** — tool `DisplayInventory`; `display=[0,1]`; `region=[l,t,r,b]` theo *virtual-desktop pixel coordinates* | Không cần key. **CÓ telemetry PostHog bật mặc định** (`ANONYMIZED_TELEMETRY=true`) | ~34.7K |
| 2 | [screenpipe/screenpipe](https://github.com/screenpipe/screenpipe) | 21644 | 2026-09-21 | NOASSERTION | Rust | — | Ghi màn hình liên tục + OCR, **không phải server điều khiển** (không có mouse/keyboard tool) → ngoài phạm vi | n/a | YC-backed, có cloud tier | rất lớn |
| 3 | [mediar-ai/terminator](https://github.com/mediar-ai/terminator) | 1640 | **2026-06-02** (cũ 3.5 tháng) | MIT | Rust (windows-rs) | `npx -y terminator-mcp-agent` | **UIA** — "Works across all dimensions - pixels, DOM, and Accessibility tree"; `crates/terminator/src/platforms/windows/engine.rs` 175KB | "Monitor Management … Multi-display support"; issue #473 multi-monitor click đã đóng | Không cần key | ~138K |
| 4 | [AmrDab/clawdcursor](https://github.com/AmrDab/clawdcursor) | 403 | 2026-09-20 | MIT | TypeScript (+PowerShell trên Win) | `npm i -g clawdcursor` / `npx -y clawdcursor` | **UIA-first, pixel là bậc cuối** — "acts on elements by id — not pixel coordinates. Coordinates appear only in the last-resort screenshot/vision tier" | `window.list_displays`, `screen_size`; "Retina/HiDPI handled in-adapter" | Không key bắt buộc. **"No telemetry by default. Nothing phones home."** | ~73K |
| 5 | [mrpulor-gh/nuphus-mcp](https://github.com/mrpulor-gh/nuphus-mcp) | 308 | 2026-09-17 | MIT | Rust | chưa xác minh | chưa xác minh | chưa xác minh | chưa xác minh | ? |
| 6 | [shuyu-labs/Windows-MCP.Net](https://github.com/shuyu-labs/Windows-MCP.Net) | 229 | **2025-11-27** (cũ ~10 tháng) | MIT | C# / .NET | chưa xác minh | chưa xác minh | chưa xác minh | chưa xác minh | ? |
| 7 | [dddabtc/winremote-mcp](https://github.com/dddabtc/winremote-mcp) | 196 | 2026-07-18 | MIT | Python (FastMCP) | chưa xác minh | chưa xác minh | chưa xác minh | chưa xác minh | ? |
| 8 | [AB498/computer-control-mcp](https://github.com/AB498/computer-control-mcp) | 168 | 2026-07-25 | MIT | Python (PyAutoGUI + RapidOCR + ONNX) | `uvx computer-control-mcp@latest` | **PIXEL ONLY** — "using PyAutoGUI, RapidOCR, ONNXRuntime"; zero khớp `UIAutomation`/`pywinauto` trong README | **Yếu** — issue #8 OPEN: "Multi-monitor support: DPI scaling and full-screen screenshot issues" | Không cần key | ~2.1K |
| 9 | [YV17labs/GhostDesk](https://github.com/YV17labs/GhostDesk) | 152 | 2026-09-11 | NOASSERTION | Rust | Docker | chưa xác minh | chưa xác minh | chưa xác minh | ? |
| 10 | [mario-andreschak/mcp-windows-desktop-automation](https://github.com/mario-andreschak/mcp-windows-desktop-automation) | 118 | **2025-03-24** (cũ 18 tháng) | MIT | TypeScript (AutoIt) | chưa xác minh | AutoIt — điều khiển theo control handle, không phải UIA hiện đại | chưa xác minh | chưa xác minh | ? |
| 11 | [shanselman/FlaUI-MCP](https://github.com/shanselman/FlaUI-MCP) | 100 | 2026-07-08 | MIT | C# / .NET 8 (FlaUI) | ZIP release (self-contained) hoặc `git clone` + `dotnet run` | **UIA THUẦN** — "No screenshot parsing. No coordinate guessing. Just semantic element references."; `windows_snapshot → Accessibility tree with refs like w1e5` | Có `windows_screenshot`; issue #3 (đã đóng) "Screenshots are offset/cropped on scaled displays (DPI > 100%)" | Không key, không thấy telemetry | **~4.3K** |
| 12 | [zavora-ai/computer-use-mcp](https://github.com/zavora-ai/computer-use-mcp) | 63 | 2026-09-12 | MIT | JS + Rust NAPI | chưa xác minh | chưa xác minh | chưa xác minh | chưa xác minh | ? |
| 13 | [mukul975/mcp-windows-automation](https://github.com/mukul975/mcp-windows-automation) | 54 | 2026-03-15 | MIT | Python | chưa xác minh | chưa xác minh | chưa xác minh | chưa xác minh | ? |
| 14 | [hetaoBackend/mcp-pyautogui-server](https://github.com/hetaoBackend/mcp-pyautogui-server) | 46 | **2025-04-02** (cũ 17 tháng) | MIT | Python (PyAutoGUI) | chưa xác minh | **PIXEL ONLY** (theo tên + mô tả repo) | chưa xác minh | chưa xác minh | ? |
| 15 | [sandraschi/windows-computer-use-mcp](https://github.com/sandraschi/windows-computer-use-mcp) | 38 | 2026-09-15 | MIT | Python | chưa xác minh | Mô tả repo nêu "UI inspection" + OCR → nhiều khả năng hybrid, chưa xác minh | chưa xác minh | chưa xác minh | ? |
| 16 | [Harusame64/desktop-touch-mcp](https://github.com/Harusame64/desktop-touch-mcp) | 22 | **2026-09-21** (hôm nay) | MIT | TypeScript + Rust native (`napi-rs`+`windows-rs`) | `npx -y @harusame64/desktop-touch-mcp` | **UIA + lease semantics** — "semantic discover-then-act targeting that avoids pixel-coordinate guessing"; "UIA focus queries in 2 ms"; SoM/OCR chỉ là fallback khi UIA mù | **TỐT NHẤT** — "capture any monitor, including one placed left of or above the primary — those have negative desktop coordinates, and you pass them exactly as `screenshot(detail='meta')` reports them" | Không key, không thấy telemetry | ~360K + **12 binary .exe/.dll commit thẳng vào repo** |
| 17 | [civyk-official/civyk-winwright](https://github.com/civyk-official/civyk-winwright) | 19 | 2026-07-31 | NOASSERTION | PowerShell | chưa xác minh | Mô tả: "52 tools for WPF, WinForms, Win32" → hàm ý UIA, chưa xác minh | chưa xác minh | chưa xác minh | ? |
| 18 | [ricfanin/netwright](https://github.com/ricfanin/netwright) | 15 | 2026-09-13 | MIT | C# | chưa xác minh | Mô tả: "see, operate and test WPF, WinForms and WinUI" → hàm ý UIA, chưa xác minh | chưa xác minh | chưa xác minh | ? |
| 19 | [manushi4/Screenhand](https://github.com/manushi4/Screenhand) | 15 | 2026-04-02 | **AGPL-3.0** | TypeScript | chưa xác minh | chưa xác minh | chưa xác minh | chưa xác minh | ? |
| 20 | [usamaejaz/peekwin](https://github.com/usamaejaz/peekwin) | 4 | 2026-04-15 | MIT | C# | chưa xác minh | Mô tả nêu "UI inspection", chưa xác minh | chưa xác minh | chưa xác minh | ? |
| 21 | [carbongotfound/winmcp](https://github.com/carbongotfound/winmcp) | 1 | 2026-08-01 | MIT | Rust | chưa xác minh | Mô tả nêu "UI Automation", chưa xác minh | chưa xác minh | chưa xác minh | ? |

### Kết quả âm (negative result) — có phạm vi rõ ràng

- **Không có MCP server UIAutomation/accessibility nào do Microsoft xuất bản.** Đã tìm
  `org:microsoft mcp accessibility` và `org:microsoft uiautomation`: kết quả duy nhất là
  `microsoft/Microsoft-UI-UIAutomation` (124★, C++, **last commit 2022-06-03**) — đó là thư viện
  tiện ích tiêu thụ API UIAutomation, **không phải MCP server**. `shanselman/FlaUI-MCP` là repo
  **cá nhân** của một nhân viên Microsoft, không phải sản phẩm Microsoft.
- **Không tìm thấy MCP server nào dựa trên nut.js.** Tìm `nut-js desktop automation mcp server`
  và `nutjs OR nut-js mcp` trên GitHub repository-search API: **không có kết quả khớp**. Đáng chú ý là
  `desktop-touch-mcp` nhắc nut.js như thứ nó *tránh*: "Uses Win32 `GetWindowTextW` for window
  titles, **avoiding nut-js garbling**". Phạm vi tìm: GitHub repository-search API, **không phải npm registry**.
- **ScreenPipe không phải ứng viên.** Repo đã chuyển sang org `screenpipe/screenpipe` (21644★).
  Nó ghi màn hình liên tục + OCR để cấp *ngữ cảnh*, không cung cấp tool chuột/bàn phím.

---

## Xếp hạng khuyến nghị

Bối cảnh mới: **"tự động hoá tối đa, mọi bước trừ bước làm motor quay"** → ưu tiên độ tin cậy và
targeting cấp phần tử, chấp nhận độ phức tạp cao hơn.

### Hạng 1 — `CursorTouch/Windows-MCP` (bộ chủ lực)

**Vì sao:** 7059★ và 850 fork là mẫu số kiểm thử lớn nhất trong toàn bộ danh sách; với 850 fork,
mỗi lỗi biên trên Windows đã có người gặp trước. Cài bằng một dòng `uvx windows-mcp serve`, không
cần toolchain build. Nền tảng là UIA thật (`comtypes` + `Python-UIAutomation-for-Windows`), không
phải pixel. Có `DisplayInventory` trả về layout màn hình + DPI hiệu dụng + scale metadata, và
`region` nhận **toạ độ virtual-desktop** — đúng thứ máy này cần cho màn hình phụ ở offset `3840,0`.

**Nhược điểm phải xử lý (đã xác minh, không suy đoán):**

- **Telemetry PostHog BẬT MẶC ĐỊNH.** `ANONYMIZED_TELEMETRY=true`, gửi về `https://us.i.posthog.com`.
  README khẳng định không thu thập tham số/đầu ra tool, nhưng đây vẫn là phone-home. **Phải tắt.**
- **Chuỗi lỗi crash do đua comtypes còn mở:** #412 (OPEN, "Startup crash when Claude Desktop launches
  several instances at once: comtypes.gen race"), #401 (OPEN), #332 (OPEN, "WatchDog UIA focus
  listener crashes the whole MCP server after long uptime"). Giảm thiểu: giữ `WINDOWS_MCP_WATCHDOG`
  ở mặc định `false`, chỉ chạy **một** instance.
- **#416 OPEN: "Display-filtered screenshots return the wrong monitor (or crash with IndexError) on
  hybrid-GPU systems."** Đây là rủi ro trực tiếp cho cấu hình 2 màn hình của máy này. Giảm thiểu:
  đặt `WINDOWS_MCP_SCREENSHOT_BACKEND=mss` thay vì `dxcam` mặc định.

### Hạng 2 — `shanselman/FlaUI-MCP` (chạy song song, cho app WinForms/WPF)

**Vì sao:** mô hình sạch nhất trong cả danh sách — *"No screenshot parsing. No coordinate guessing.
Just semantic element references."* Snapshot trả về cây accessibility với ref dạng `w1e5`, agent
click theo ref chứ không theo toạ độ. **~4.3K LOC** là repo nhỏ nhất có thể audit thực sự trong
một buổi chiều. Chỉ có 2 issue trong toàn bộ lịch sử, cả hai đã đóng. Không telemetry, không API key.

FlaUI là thư viện UIA chuẩn mực của hệ .NET và xử lý WinForms/WPF native tốt hơn binding Python —
đáng kể vì **Mission Planner là ứng dụng WinForms**. Đây là lý do nó nên chạy *song song* với hạng 1,
không phải thay thế.

**Nhược điểm:** không có `npx`/`uvx` — phải tải ZIP release hoặc `dotnet run`. Chỉ 100★ nên mẫu
kiểm thử nhỏ. Issue #3 (đã đóng) từng lệch screenshot khi DPI > 100%.

### Hạng 3 — `Harusame64/desktop-touch-mcp` (mạnh nhất kỹ thuật, rủi ro nhất về tổ chức)

Trên đúng hai trục làm đau máy này, đây là ứng viên tốt nhất tuyệt đối:

- **Multi-monitor offset âm/dương:** repo duy nhất ghi rõ bằng văn bản rằng nó xử lý màn hình đặt
  bên trái hoặc phía trên màn hình chính với toạ độ âm, và nêu rõ mã lỗi phân biệt ba nguyên nhân
  (`RegionOutsideCapturableBounds`, `coordinate_outside_reachable_bounds`, `cursor_placement_blocked`).
- **IME / gõ phi-ASCII:** *"Full CJK support — Uses Win32 `GetWindowTextW` for window titles,
  avoiding nut-js garbling. IME bypass input supported for Japanese/Chinese/Korean environments"*,
  tool `keyboard` có "IME-safe clipboard bypass". **Quan trọng cho tiếng Việt** — cùng lớp vấn đề.
  Repo còn ghi thẳng cạm bẫy: em-dash và smart quotes bị Chrome/Edge bắt làm phím tắt, phải dùng
  `use_clipboard=true`.

**Nhưng:** 22★, 3 fork, một tác giả duy nhất → bus factor 1. Và **12 file binary (.exe/.dll) commit
thẳng vào repo**, mỗi file ~24MB (`key-locker.exe`, `bridge-host.exe`, `win-ocr.exe`,
`key-askpass.exe`). Không thể audit binary. Với dự án cần tin cậy, đây là rủi ro chuỗi cung ứng
không chấp nhận được ở vị trí chủ lực — nhưng **đáng đọc mã nguồn để học cách nó xử lý offset âm
và IME**, rồi port ý tưởng vào `gui.ps1`.

### Không khuyến nghị

- **`AB498/computer-control-mcp`** — PyAutoGUI thuần, không có UIA. Click theo toạ độ mù. Issue #8
  về multi-monitor DPI vẫn OPEN. Đây chính xác là thứ `gui.ps1` đã vượt qua.
- **`mediar-ai/terminator`** — chất lượng kỹ thuật cao (1640★, engine UIA Rust 175KB), nhưng commit
  cuối **2026-06-02**, đứng yên 3.5 tháng. Với một hệ mà Windows API đổi liên tục, đó là rủi ro.
- **`mario-andreschak/...`** (2025-03-24), **`hetaoBackend/...`** (2025-04-02),
  **`shuyu-labs/Windows-MCP.Net`** (2025-11-27) — bỏ hoang.
- **`manushi4/Screenhand`** — **AGPL-3.0**. Giấy phép lây nhiễm, cân nhắc kỹ trước khi đưa vào đồ án.

---

## Đánh giá an ninh — hai ứng viên đầu

Mọi MCP server ở đây đều cho LLM **toàn quyền chuột + bàn phím** trên máy. Không có sandbox. Đây là
lớp rủi ro cao hơn hẳn một MCP server chỉ đọc file.

### `CursorTouch/Windows-MCP`

| Trục | Đánh giá |
|---|---|
| Phone home | **CÓ — PostHog bật mặc định.** Phải đặt `ANONYMIZED_TELEMETRY=false`. README nói không gửi tham số/đầu ra tool; không tự kiểm chứng được điều đó ở mức mã nguồn trong phạm vi lane này. |
| API key | Không bắt buộc. Có chế độ HTTP/SSE dùng API key tĩnh hoặc OAuth — **chỉ dùng transport `stdio`**, đừng mở cổng. |
| Bề mặt mã | ~34.7K LOC Python. Quá lớn để audit toàn bộ; phần lớn nằm ở `src/windows_mcp/uia/` (wrapper UIA sinh tự động, ít rủi ro logic). |
| Prompt injection | **Rủi ro cao chưa được giảm thiểu.** Cây UIA chứa text từ mọi cửa sổ đang mở. Một cửa sổ độc hại có thể đặt tên control thành chỉ thị. Không tìm thấy cơ chế chống trong README. |
| Chạy tool tuỳ ý | Có tool `PowerShell` → thực thi shell tuỳ ý. Dùng `--tools` để **whitelist** đúng những tool cần. |
| UAC | Không leo thang được. Issue #236 (OPEN) xin "optional service mode to see and handle UAC prompts" → xác nhận **hiện không xử lý được prompt UAC**. #213 xác nhận `schtasks /RU SYSTEM` thất bại "Access is denied". **Đây thực ra là tính năng an toàn cho dự án này.** |

### `shanselman/FlaUI-MCP`

| Trục | Đánh giá |
|---|---|
| Phone home | **Không tìm thấy** dấu hiệu telemetry/analytics/API key. |
| API key | Không. |
| Bề mặt mã | **~4.3K LOC C#** — nhỏ nhất, audit được thật. Đây là lợi thế an ninh lớn nhất của nó. |
| Prompt injection | Cùng rủi ro lớp (cây a11y chứa text bên ngoài), không có giảm thiểu riêng. |
| Chạy tool tuỳ ý | **Không có tool shell** — bề mặt tấn công hẹp hơn hẳn hạng 1. |
| UAC | Không có tài liệu nêu. Theo nguyên lý Windows UIPI, tiến trình integrity thường không drive được cửa sổ elevated — **chưa xác minh** với repo này. |
| Phân phối | ZIP từ GitHub Releases. Nên kiểm tra checksum; không thấy signing được nêu trong README. |

**Khuyến nghị an ninh chung:** chạy `stdio` (không mở cổng HTTP), whitelist tool, tắt telemetry,
và **không chạy MCP server dưới quyền admin** — chính giới hạn UAC là thứ ngăn agent chạm vào
những thứ làm motor quay.

---

## Lệnh cài đặt và đấu nối — ứng viên hạng 1

```powershell
# 1. Yêu cầu: uv (Astral). Nếu chưa có:
powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"

# 2. Thử chạy trước khi đấu nối (lần đầu tải dependency, mất 1-2 phút):
uvx windows-mcp serve --help
```

Đấu nối vào Claude Code (`stdio`, telemetry tắt, backend screenshot an toàn cho 2 màn hình,
whitelist tool — **không có PowerShell tool**):

```powershell
claude mcp add windows-mcp `
  --env ANONYMIZED_TELEMETRY=false `
  --env POSTHOG_API_KEY= `
  --env WINDOWS_MCP_SCREENSHOT_BACKEND=mss `
  --env WINDOWS_MCP_WATCHDOG=false `
  --env WINDOWS_MCP_SCREENSHOT_SCALE=0.5 `
  --env WINDOWS_MCP_TOOLS="Snapshot,Screenshot,DisplayInventory,Click,Type,Shortcut,Scroll,Clipboard,Drag,Move" `
  -- uvx windows-mcp serve
```

Giải thích từng cờ:

- `ANONYMIZED_TELEMETRY=false` + `POSTHOG_API_KEY=` (rỗng) — chặn phone-home ở cả hai đường.
- `WINDOWS_MCP_SCREENSHOT_BACKEND=mss` — né `dxcam` mặc định, là backend dính issue #416 (sai monitor
  trên máy hybrid-GPU).
- `WINDOWS_MCP_WATCHDOG=false` — mặc định đã là false; ghi rõ để không ai bật nhầm (issue #332 crash).
- `WINDOWS_MCP_SCREENSHOT_SCALE=0.5` — màn 2880x1620 vượt giới hạn 1MB kết quả tool nếu không scale.
- `WINDOWS_MCP_TOOLS=...` — **cố ý bỏ tool `PowerShell` và `App`**. Agent không cần shell tuỳ ý.

Kiểm chứng ngay sau khi cài (đừng tin là nó chạy):

```powershell
claude mcp list                      # phải thấy windows-mcp ✓ connected
# rồi trong phiên Claude, gọi DisplayInventory và đối chiếu:
#   màn 1 = 2560x1600 @ (0,0)
#   màn 2 = 2880x1620 @ (3840,0)
# Nếu DisplayInventory không trả đúng offset 3840 → dừng, chuyển sang hạng 2.
```

Ứng viên hạng 2 (chạy song song, khi cần độ chính xác WinForms cho Mission Planner):

```powershell
# Tải FlaUI-MCP-win-x64-<ver>-self-contained.zip từ Releases, giải nén ra C:\tools\flaui-mcp\
claude mcp add flaui-mcp -- C:\tools\flaui-mcp\FlaUI-MCP.exe
```

---

## Phân tích khoảng trống so với `scripts/gui/gui.ps1`

`gui.ps1` hiện có **380 dòng** và đã làm được: screenshot theo monitor/window, cây control
UIAutomation, Invoke/SetValue/Select theo tên control, click thô, gõ qua clipboard.

| Năng lực | `gui.ps1` | Windows-MCP | FlaUI-MCP | Ai thắng |
|---|---|---|---|---|
| Cây UIAutomation | **Có** | Có | Có | hoà |
| Invoke/SetValue/Select theo tên | **Có** | Có | Có (qua ref `w1e5`) | hoà |
| Screenshot theo monitor | **Có** | Có + `DisplayInventory` (DPI + scale metadata) | Có | Windows-MCP |
| Gõ qua clipboard (an toàn IME) | **Có** | Có tool `Clipboard`; `Type` dùng đường nào thì **chưa xác minh** | `SendKeysTool` (11KB) | gui.ps1 ngang bằng |
| **Bề mặt tool MCP gốc** | **KHÔNG** — phải shell-out từng lần, LLM tự nhớ cú pháp | **Có** | **Có** | **← khoảng trống #1** |
| **Ref phần tử ổn định giữa các lần gọi** | **KHÔNG** — mỗi lần gọi phải duyệt lại cây | Có (`Snapshot` trả element id) | **Có** (`w1e5`, mô hình sạch nhất) | **← khoảng trống #2** |
| **Xác minh hành động sau khi thực hiện** | **KHÔNG** | Một phần | Một phần (`desktop-touch-mcp` mạnh nhất) | **← khoảng trống #3** |
| Trích DOM trình duyệt (Chrome/Edge/Firefox) | KHÔNG | **Có** (`use_dom=True`) | Không | **← khoảng trống #4** |
| Vùng cuộn / scrollable regions | chưa xác minh | Có | Có | Windows-MCP |
| Xử lý offset âm / màn hình trái-trên | chưa xác minh | Một phần (issue #416 mở) | chưa xác minh | `desktop-touch-mcp` (hạng 3) |
| Audit được toàn bộ | **Có (380 dòng)** | Không (34.7K) | Gần được (4.3K) | gui.ps1 |
| Không phụ thuộc bên ngoài | **Có** | Không (PyPI + PostHog) | Không (ZIP release) | gui.ps1 |

**Bốn khoảng trống thật, xếp theo giá trị:**

1. **Bề mặt tool MCP gốc.** Đây là khoảng trống lớn nhất và là lý do duy nhất đủ mạnh để thêm MCP
   server. Với `gui.ps1`, mỗi hành động là một lần shell-out mà LLM phải tự soạn đúng cú pháp —
   sai cú pháp là mất một lượt. Tool MCP có schema, LLM không soạn sai được.
2. **Ref phần tử ổn định.** `gui.ps1` duyệt lại cây mỗi lần gọi; giữa hai lần gọi, cây có thể đổi mà
   không ai biết. Mô hình ref của FlaUI-MCP (`w1e5`) và lease của `desktop-touch-mcp` giải quyết đúng
   chỗ này — quan trọng với "tự động hoá tối đa" vì chuỗi hành động dài thì sai lệch tích luỹ.
3. **Xác minh sau hành động.** Không có gì trong `gui.ps1` kiểm tra rằng click vừa rồi *đã làm đúng
   thứ nó nói*. Với "mọi bước trừ bước làm motor quay", một click gõ nhầm cửa sổ là lỗi im lặng.
4. **Trích DOM trình duyệt.** Nếu quy trình có bước web (tải firmware, đọc tài liệu ArduPilot),
   `use_dom=True` của Windows-MCP là thứ `gui.ps1` không có.

**Điều `gui.ps1` vẫn thắng và nên giữ:** nó audit được toàn bộ trong một lần đọc, không phụ thuộc
mạng, không telemetry, và **không thể bị cập nhật ngầm**. Khuyến nghị là **giữ `gui.ps1` làm đường
lui**, không xoá — khi MCP server crash (và issue #412/#332 cho thấy nó sẽ crash), `gui.ps1` là thứ
vẫn chạy.

**Việc nên làm ngay, không cần chờ quyết định MCP:** port hai kỹ thuật từ `desktop-touch-mcp` vào
`gui.ps1` — (a) xử lý offset âm/dương tường minh khi chụp màn hình, (b) cảnh báo em-dash/smart-quote
bị Chrome/Edge bắt làm phím tắt, luôn dùng đường clipboard cho text phi-ASCII. Cả hai là tri thức
miễn phí, không cần cài gì.

---

## Chưa xác minh

Phải nêu rõ, không đoán:

- **14 repo chưa đọc README/mã nguồn** (hạng 5,6,7,9,10,12,13,14,15,17,18,19,20,21):
  `nuphus-mcp`, `Windows-MCP.Net`, `winremote-mcp`, `GhostDesk`, `mcp-windows-desktop-automation`,
  `zavora-ai/computer-use-mcp`, `mcp-windows-automation`, `mcp-pyautogui-server`,
  `sandraschi/windows-computer-use-mcp`, `civyk-winwright`, `netwright`, `Screenhand`, `peekwin`,
  `winmcp`. **Metadata (sao, license, ngày commit, ngôn ngữ) của tất cả đã xác minh bằng `gh api`**;
  chỉ có các trục UIA-vs-pixel / multi-monitor / telemetry / LOC là chưa. Hai sub-agent đang đọc
  chúng nhưng chưa trả kết quả trước khi có lệnh dừng.
- **Windows-MCP: tool `Type` gõ bằng đường nào** (SendInput Unicode hay clipboard) — chưa đọc mã.
  Ảnh hưởng trực tiếp tới gõ tiếng Việt có dấu.
- **Windows-MCP có thật sự chạy đúng với màn hình ở offset `3840,0`** — chưa test trên máy này.
  Issue #416 (OPEN) là rủi ro đã biết. Bước kiểm chứng `DisplayInventory` ở trên chính là để đóng
  khoảng trống này.
- **FlaUI-MCP và giới hạn UAC / integrity level** — không có tài liệu, chưa test.
- **Nội dung telemetry thật sự của Windows-MCP** — chỉ đọc README, chưa audit mã PostHog.
- **12 binary commit trong `desktop-touch-mcp`** — không audit được, đó chính là lý do hạ hạng.
- **LOC của `desktop-touch-mcp` (~360K)** — đã trừ binary nhưng vẫn có thể lẫn test fixture;
  coi là ước lượng trên, không phải số chính xác.
- **Giấy phép `NOASSERTION`** ở `GhostDesk`, `civyk-winwright`, `screenpipe` — GitHub không nhận
  diện được; phải đọc file LICENSE thủ công trước khi dùng.

## Nguồn

Toàn bộ metadata từ GitHub REST API ngày 2026-09-21 qua `gh` đã xác thực:
`gh api repos/OWNER/NAME --jq '{stars,license,pushed,lang,archived}'` ·
`gh api repos/OWNER/NAME/commits?per_page=1` ·
`gh api repos/OWNER/NAME/readme` · `gh api repos/OWNER/NAME/git/trees/BRANCH?recursive=1` ·
`gh issue list --repo OWNER/NAME --state all`.
Dữ liệu thô nằm trong scratchpad của phiên: `lane1-mcp-servers.md`, `meta.txt`, `rm_*.md`.

---

# BỔ SUNG 21/09/2026 — đọc sâu 8 repo trước đó chưa xác minh

Phần trên xếp `CursorTouch/Windows-MCP` hạng 1 chủ yếu vì số sao và dễ cài, khi 14 repo
đuôi bảng mới chỉ có metadata. Sau khi đọc mã nguồn 8 trong số đó, **thứ hạng kỹ thuật đổi**.
Phần này không thay thế phần trên, nó sửa chỗ phần trên thừa nhận là chưa biết.

## Sự thật mới quan trọng nhất: máy này có GPU lai

CPU là **AMD Ryzen 9 7945HX with Radeon Graphics** cộng **NVIDIA RTX 4060 Laptop**. Đó đúng
là cấu hình mà issue **#416 của Windows-MCP (đang MỞ)** mô tả: *"Display-filtered screenshots
return the wrong monitor (or crash with IndexError) on hybrid-GPU systems."* Rủi ro này không
còn là giả định, nó khớp trực tiếp với phần cứng. Đã đặt `WINDOWS_MCP_SCREENSHOT_BACKEND=mss`
để né, nhưng **chưa kiểm chứng trên máy**.

## Bảng so sánh sau khi đọc mã

| | Cây UIA | Đa màn hình ở offset 3840,0 | Gõ an toàn IME | UAC | LOC | Số tool | Cài |
|---|---|---|---|---|---|---|---|
| **carbongotfound/winmcp** | IUIAutomation (Rust) | **Tốt nhất**: có unit test riêng cho offset âm; `MOUSEEVENTF_VIRTUALDESK`; PerMonitorV2 | `KEYEVENTF_UNICODE` cho text, `VkKeyScanW` cho phím tắt, có lý giải trong mã | **Phát hiện lúc chạy**, báo cửa sổ nào elevated | **7,1K, 5 file** | **3** (~1500 token schema) | clone + cargo |
| ricfanin/netwright | UIA thuần, thao tác qua pattern chứ không qua chuột | ngầm (bounds tuyệt đối + PerMonitorV2), không có mã riêng | `ValuePattern.SetValue`, đường an toàn IME nhất | **Có tài liệu, 2 chỗ** | 7,3K | 15 | `dotnet tool` |
| usamaejaz/peekwin | CUIAutomation + ref `--ref e12` | **Tường minh**: lệnh `screens`, cờ `--screen n`, PerMonitorV2 | Unicode + có tool clipboard | không | 8,3K | nhiều | **winget** |
| CursorTouch/Windows-MCP | UIA (comtypes) | có `DisplayInventory` nhưng **#416 mở, dính GPU lai** | `Type` đi đường nào: chưa xác minh | không | 34,7K | 11 | `uvx` |
| zavora-ai/computer-use-mcp | IUIAutomation (Rust) | có, nhưng đường GDI dự phòng chỉ lấy màn chính | Unicode gộp batch | yếu | 27K | **70** | `npx` |
| manushi4/Screenhand | System.Windows.Automation | chụp được virtual screen, **không thấy DPI theo màn** | Unicode + ValuePattern | không | **51K** | **111** | `npx`, AGPL, quét bảo mật 50/100 |
| sandraschi/windows-computer-use-mcp | pywinauto UIA | tường minh, có `display_utils.py` | **đi qua pyautogui, rủi ro** | không | 16K | 22 | clone + uv |
| hetaoBackend/mcp-pyautogui-server | **không có** | **chỉ màn chính** | `typewrite`, hỏng với phi-ASCII | không | 0,16K | 12 | pip |
| civyk-official/civyk-winwright | tuyên bố UIA3 | không có bằng chứng | không có bằng chứng | không | **không có mã nguồn** | 52 | zip, freeware |

## Xếp hạng lại cho đúng máy này

1. **`carbongotfound/winmcp`** nếu ưu tiên đúng kỹ thuật. Nó là repo duy nhất có unit test
   cho chính bài toán offset âm/dương của màn hình phụ, có lý giải bằng văn bản vì sao tách
   `KEYEVENTF_UNICODE` khỏi `VkKeyScanW`, và phát hiện cửa sổ elevated lúc chạy thay vì im
   lặng nuốt thao tác. **3 tool, dưới 1500 token schema** là con số quan trọng: mỗi MCP server
   nạp toàn bộ mô tả tool vào mọi phiên, và Windows-MCP với 11 tool tốn nhiều hơn hẳn.
   **Nhược điểm thật:** 1 sao, một tác giả, phải build bằng `cargo`, exe tự build hay bị
   antivirus báo nhầm.
2. **`usamaejaz/peekwin`** nếu muốn cân bằng. Cài bằng `winget install UsamaEjaz.PeekWin`,
   có lệnh `screens` và cờ `--screen n` tường minh, có tool clipboard, MIT, không telemetry.
3. **`ricfanin/netwright`** nếu chỉ nhắm Mission Planner. Nó là UIA thuần cho WPF/WinForms,
   thao tác qua `ValuePattern` nên không synthesize phím, đường an toàn IME nhất trong cả bảng.
   Tài liệu UAC rõ ràng nhất. Nhưng repo tự ghi là **không hỗ trợ** Win32/Qt/Electron, nên
   STM32CubeProgrammer (Qt) và Arduino IDE (Electron) nằm ngoài phạm vi.
4. **`CursorTouch/Windows-MCP`** vẫn là lựa chọn an toàn về mặt cộng đồng (7059 sao, 850 fork)
   và đã đấu nối xong. Giữ làm mặc định cho tới khi kiểm chứng `DisplayInventory` thất bại.

## Quyết định thực thi

Đã đăng ký `windows-mcp` vào `.mcp.json` với telemetry tắt, backend `mss`, watchdog tắt, bỏ
tool `PowerShell` và `App`. **Bước kiểm chứng bắt buộc sau khi khởi động lại Claude Code:**
gọi `DisplayInventory` và đối chiếu màn 1 = 2560x1600 @ (0,0), màn 2 = 2880x1620 @ (3840,0).
Sai offset hoặc chụp nhầm màn → đổi sang `peekwin` (dễ cài nhất trong nhóm kỹ thuật tốt).

`scripts/gui/gui.ps1` giữ nguyên làm đường lui, không xoá.

## Vẫn chưa xác minh

- Windows-MCP có chạy đúng trên GPU lai của máy này hay không. Đây là câu hỏi mở số một.
- Tool `Type` của Windows-MCP gõ bằng SendInput Unicode hay clipboard, ảnh hưởng tiếng Việt.
- Không repo nào trong 8 repo đọc sâu có issue nào nhắc IME, CJK hay tiếng Việt. **Bốn repo
  có 0 issue tổng cộng**, nên không có báo cáo không đồng nghĩa với chạy đúng.
