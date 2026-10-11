# AGENTS.md — hướng dẫn cho mọi agent làm việc trong IOT-CV

Đọc file này trước khi làm bất cứ việc gì trong repo. Áp dụng cho mọi agent (Claude Code, Codex,
…) và mọi phiên. `CLAUDE.md` chỉ import file này, nên sửa ở **đây**, không sửa ở đó.

Dự án: quadcopter S500 chạy ArduPilot 4.7.1 (bản custom build) trên SpeedyBee F405 V5, điều khiển
qua web GCS tự viết (FastAPI + Vite/React), cầu MAVLink Wi-Fi bằng ESP32 chạy DroneBridge, tránh vật
cản bằng TFmini Plus, camera ESP32-S3 + AI nhận diện người.

## Nguồn sự thật — đọc trước khi hỏi người dùng

| Câu hỏi | File |
|---|---|
| Linh kiện thật đang có | `docs/phan-cung-thuc-te.md` |
| Tham số bay, chia cổng serial, lý do | `firmware/ardupilot/params/*.param` (phần comment đầu file) |
| Feature firmware đã bật | `firmware/ardupilot/custombuild/*.yaml`, `firmware/ardupilot/build-*/NOTES.md` |
| Thứ tự phase, phase nào xong | `plans/_phase-index.md`, `plans/PROGRESS.md` |
| Luật an toàn | `SAFETY.md` |
| Quyết định còn mở | `plans/QUYET-DINH-CHUA-CHOT.md` |
| BOM gốc + lý do chọn | `docs/archive/plan-nhap-92-giai-doan.md` (bản ghi quyết định, không phải tài liệu chết) |

`plans/reports/260921-*` là báo cáo nghiên cứu ngày 21/09/2026, giữ nguyên như bản ghi lịch sử —
phần cứng trong đó có thể đã đổi.

## Luật cứng của người dùng

1. **Tải về và cài thêm vào ổ D**, không để ổ C: file tải về / installer / bản sao lưu →
   `D:\IOT_Tools\downloads\`; app → `D:\IOT_Tools\apps\`; toolchain và cache (uv, pip, npm, pnpm,
   PlatformIO) → `D:\DevCache\`. Thứ bắt buộc nằm ở C (driver store của Windows) thì nói rõ.
2. **Chỉ ghi file.** Không commit, push, mở PR hay sửa `.gitignore` khi người dùng chưa bảo. Khi
   được bảo commit thì dùng dạng pathspec `git commit -m "..." -- <file>`, không `git add -A`.
3. Không publish Artifact lên tài khoản claude.ai; mọi tài liệu là file trong repo.
4. Không đưa dự án lên Plane, không hỏi về Plane.
5. Trong một phiên, làm **đơn luồng**, không spawn sub-agent — kể cả khi rule kit trong
   `.claude/rules/` bảo fan-out. Lệnh dài (SITL, build, test) thì chạy nền.
6. **Tự chạy nghiệm thu**, đừng đẩy cho người dùng: SITL (`scripts/run_sitl.sh`,
   `scripts/sitl/harness.py`, `bash scripts/sitl/run-all.sh`), `scripts/ws_probe.py`, và MCP
   `cua-driver` cho phần mềm có giao diện. Ngoại lệ **duy nhất**: thao tác làm motor THẬT quay (ARM,
   Motor Test trên phần cứng) — người vận hành tự bấm, tay giữ RC.
7. Computer use trên Windows đi qua `cua-driver` (`.claude/rules/computer-use-cua-driver-first.md`);
   `scripts/gui/gui.ps1` chỉ là đường lui khi `cua-driver` hỏng.
8. Tự động hoá (hook, skill, script) phải cấu hình được và có công tắc tắt, không hà khắc.
9. **Ghi nhớ liên tục.** Có sự thật, quyết định hay lời dặn mới → ghi ngay vào memory của agent;
   luật chung cho mọi phiên → ghi thêm vào file này. Người dùng không muốn phải nhắc lại.

## Khi có nhiều phiên chạy song song

Người dùng thường mở nhiều phiên cùng lúc trên một working tree. Hai phiên ghi cùng một file thì
bản sau đè bản trước mà không báo gì.

- Trước khi sửa file dùng chung (`plans/`, `docs/`, `PROGRESS.md`): `git status --short` xem file
  nào đang bị sửa dở; liệt kê các phiên đang sống và nhắn để chia file — mỗi file chỉ một phiên ghi.
- Được nhường một phần file thì giữ nguyên các khối phiên kia đã viết.
- Sửa xong báo lại phiên kia danh sách file. Kết thúc dòng LF (`.gitattributes` đặt `eol=lf`);
  file `.param` giữ ASCII thuần.

## Bẫy đã gặp, đừng lặp lại

- ESC OX32 đánh số motor kiểu Betaflight → `FRAME_TYPE 12`; ghi motor theo **vị trí** (trước-phải,
  sau-trái…), đừng dùng sơ đồ "Quad X chuẩn ArduPilot" trên mạng.
- Pad **9V** của F405 V5 nằm sát T3/R3 và chân 1 cổng "HD Unit Plug" là 9V — TFmini Plus chỉ chịu 5 V.
- Bo ESP32 DroneBridge (CP2102, COM4) chỉ nạp được ở **115200** baud. Các bẫy khác của DroneBridge
  và hotspot (đừng cho laptop nối Wi-Fi không có internet, log boot in lộ mật khẩu Wi-Fi…): đọc
  `firmware/dronebridge/README.md` mục "Bẫy đã gặp" trước khi đụng vào ESP32.
- SITL: mô hình vật lý phải khớp `FRAME_TYPE` (`-f bfx`); cảm biến dòng ảo cố định 17 A/V.
- Mã thoát của một đường ống (`cmd | tail`) là của lệnh cuối — đọc chính kết quả trước khi kết luận PASS.
