# PROGRESS — sổ theo dõi tiến độ

Đây là **nơi duy nhất** ghi tiến độ dự án. Không GitHub Projects, không công cụ ngoài — mọi thứ là file trong repo.

Kế hoạch: `plans/README.md` · Đánh số gốc: `plans/_phase-index.md` · Chi tiết từng phase: `plans/phase-NN-<slug>.md`

## Cách dùng

1. Xong một cổng pass → đổi `- [ ]` thành `- [x]`.
2. Điền `Ngày bắt đầu` khi bắt tay vào phase, `Ngày xong` khi cụm checkbox đã tick hết.
3. Trục trặc → một dòng ngắn vào `Ghi chú`. Chi tiết viết vào `docs/so-tay/NN-*.md`, đừng nhồi vào đây.
4. Commit file này **cùng commit** với công việc tương ứng, prefix `chore(plans):`.
5. **Không tick khi chưa có bằng chứng.** Nếu một cổng phải hoãn, ghi `HOÃN: <lý do>` vào `Ghi chú` thay vì tick bừa. Một cổng pass tick sai đắt hơn nhiều so với một cổng pass còn trống.

## Chú thích ký hiệu

| Ký hiệu | Nghĩa |
|---|---|
| `- [ ]` | Chưa làm hoặc đang làm dở |
| `- [x]` | Đã làm và **đã kiểm chứng** (chạy lệnh, đọc kết quả, hoặc có ảnh chụp) |
| `HOÃN: …` trong Ghi chú | Cổng này chuyển sang phase khác, có lý do ghi rõ |
| `CHƯA XÁC MINH` | Điều đang giả định, chưa ai kiểm trên máy này |
| 🔧 | Phase cần phần cứng thật |
| 🤖 | Phase thuộc luồng AI (luồng phụ, không chặn luồng chính) |

Cổng pass của **mọi** phase (00–24, ai-01…ai-04) là bản đầy đủ, chép nguyên văn từ mục `## Cổng pass` của file phase tương ứng — đường dẫn file ghi ở dòng `Plan:` ngay dưới mỗi tiêu đề.

---

# Luồng chính

## Phase 00 — Cài công cụ trên Windows

Plan: plans/phase-00-cai-cong-cu-pc.md

Ngày bắt đầu: ______ · Ngày xong: ______

- [ ] Sáu biến môi trường User (`UV_CACHE_DIR`, `UV_TOOL_DIR`, `UV_PYTHON_INSTALL_DIR`, `PIP_CACHE_DIR`, `NPM_CONFIG_CACHE`, `PLATFORMIO_CORE_DIR`) đều trỏ vào `D:\DevCache\...` — kiểm bằng `uv cache dir; uv tool dir; uv python dir; npm config get cache`.
- [ ] Cây thư mục `D:\DevCache\{cache\{uv,pip,npm,pnpm-store},tools\{uv-tools,uv-python,platformio}}` và `D:\IOT_Tools\apps` tồn tại.
- [ ] `py --list` hiện `3.13`.
- [ ] `node --version` in v24.x, `pnpm --version` in 11.x, `uv --version` in 0.12.x.
- [ ] `pwsh -File scripts/gui/gui.ps1 -Action windows` liệt kê được cửa sổ đang mở; `-Action shot -Monitor 0` tạo ra file PNG đọc được.
- [ ] `docker info --format "{{.ServerVersion}}"` in ra số phiên bản.
- [ ] `wsl --list --verbose` hiện `Ubuntu` VERSION = `2`; `df -h /` trong WSL còn > 15 GB.
- [ ] Mission Planner cài trong `D:\IOT_Tools\apps\MissionPlanner\` (kiểm bằng `InstallLocation` trong registry Uninstall), mở được, hiện màn hình `FLIGHT DATA`.
- [ ] MAVProxy cài trong `D:\IOT_Tools\apps\MAVProxy\`; `where.exe mavproxy` in đường dẫn `D:\`; `mavproxy.exe --version` chạy được.
- [ ] STM32CubeProgrammer mở được.
- [ ] `code --version` chạy; PlatformIO IDE có trong danh sách extension; `pio system info` in `Core Directory` trỏ `D:\DevCache\tools\platformio`.
- [ ] `esptool version` in `v5.x`; `uv run python -c "import pymavlink; print(pymavlink.__version__)"` (trong `D:\Coding\IOT-CV`) in `2.4.x` và `sys.executable` bắt đầu bằng `D:\`.
- [ ] Đã ghi số phiên bản thực tế vào Ghi chú dưới đây.

Ghi chú: 

## Phase 01 — Tái cấu trúc repo, uv, Vite, mosquitto, CI

Plan: plans/phase-01-tai-cau-truc-repo.md

Ngày bắt đầu: ______ · Ngày xong: ______

- [ ] `uv run pytest` in `N passed`, không `failed`, không `error`.
- [ ] `uv run ruff check .` in `All checks passed!`.
- [ ] `pnpm build` trong `frontend/` sinh `frontend/dist/index.html`; chạy `uv run uvicorn backend.app:app --port 8000` rồi mở `http://127.0.0.1:8000` thấy trang React, không 404.
- [ ] `git check-ignore -v firmware/ardupilot/build-d450a747/build.log` trả exit code **1**, và `git log --stat -1` (hoặc `git log --oneline -- .../build.log`) chứng minh file đã vào commit.
- [ ] `git check-ignore -v firmware/ardupilot/build-d450a747/arducopter_with_bl.hex` trả exit code **0** (đang bị ignore, đúng ý).
- [ ] `git log --follow --oneline firmware/ardupilot/params/README.md` hiện lịch sử có từ trước khi đổi chỗ (chứng minh đã `git mv`).
- [ ] `(Get-ChildItem docs\so-tay\*.md).Count` in `29`.
- [ ] `README.md` mới ≤ 60 dòng; `docs/archive/plan-nhap-92-giai-doan.md` và `docs/archive/so-tay-lap-f450.html` tồn tại.
- [ ] Ba file `requirements*.txt` đã xoá; `pyproject.toml` (gốc) có khối `[project]` **không có** `[project.optional-dependencies] ml`; `ml/pyproject.toml` tồn tại, là dự án `uv` riêng, **không có** `torch`; `.python-version` chứa `3.13`.
- [ ] `docker compose ps` hiện `iotcv-mosquitto` đang `running`.
- [ ] CI trên GitHub xanh cả 3 job (`lint`, `test`, `frontend`).
- [ ] `plans/PROGRESS.md` mục Phase 01 đã tick, ghi số phiên bản npm thực tế, và đã commit.

Ghi chú: 

## Phase 02 — WSL2 + build ArduPilot + SITL

Plan: plans/phase-02-wsl2-sitl.md

Ngày bắt đầu: ______ · Ngày xong: ______

- [ ] `.wslconfig` có `networkingMode=mirrored` (hoặc ghi rõ đã chọn đường NAT).
- [ ] `du -sh ~/ardupilot` ~6–8 GB; nhánh `Copter-4.7.1`.
- [ ] `mavproxy.py --version` trong WSL chạy.
- [ ] `./scripts/run_sitl.sh` mở đủ **ba** cửa sổ (MAVProxy, Console, Map).
- [ ] `mode guided` → `arm throttle` → `takeoff 40` → `mode rtl` chạy trọn, kết thúc `DISARMED`.
- [ ] Mission Planner nối vào SITL: HUD sống, ghi `ArduCopter V4.7.1`, Alt đổi theo lệnh MAVProxy.
- [ ] `scripts/run_sitl.sh` đã sửa và commit; mục `sitl:` trong `Makefile` trỏ đúng.
- [ ] Đã ghi **thời gian build thực tế + dung lượng thực tế** vào Ghi chú.

Ghi chú: 

## Phase 03 — Học ArduPilot trên drone ảo

Plan: plans/phase-03-hoc-ardupilot-drone-ao.md

Ngày bắt đầu: ______ · Ngày xong: ______

- [ ] Bay trọn `GUIDED` → `LOITER` → `ALT_HOLD` → `RTL` → `DISARMED`, không crash.
- [ ] Chạy được mission 5 waypoint (`TAKEOFF` → 3 `WAYPOINT` → `RTL`) ở `AUTO`; `wp list` khớp Mission Planner.
- [ ] Có **3 dòng `PreArm:` khác nhau** chép nguyên văn vào sổ tay, mỗi dòng kèm giải thích tự viết.
- [ ] Mở được log `.BIN` trên UAV Log Viewer; chỉ ra đồ thị độ cao **và** các lần đổi mode.
- [ ] 9 dòng checklist bài tập ở việc 03.6 tick hết.
- [ ] Viết được câu trả lời tự luận "GUIDED khác AUTO ở chỗ nào" **trước khi** đọc đáp án.
- [ ] `logs/sitl/.gitkeep` đã commit; không file `.BIN` nào lọt vào git.

Ghi chú: 

## Phase 04 — Param + tránh vật cản ảo

Plan: plans/phase-04-param-va-tranh-vat-can-ao.md

Ngày bắt đầu: ______ · Ngày xong: ______

- [ ] `firmware/ardupilot/params/sitl/` có đủ 3 snapshot (`00-sitl-default`, `01-sitl-base-loaded`, `02-sitl-avoid`), đã commit.
- [ ] `params/sitl/README.md` có bảng "SITL nhận / từ chối" đủ **9 dòng**, quan sát thật; mục "Param SITL từ chối" liệt kê hoặc ghi rõ "không có".
- [ ] Nạp được bộ param nền; có ảnh chụp cửa sổ so sánh (hoặc log `param load`).
- [ ] `graph RANGEFINDER.distance` (hoặc ô `Sonar Range`) hiện số đổi theo độ cao.
- [ ] **Thấy AVOID phanh máy bay** trước vật cản ảo ở LOITER; có ảnh chụp màn hình. *(Nếu SITL thiếu `PRX_*`: ghi `HOÃN: sang Phase 22` + bằng chứng, đừng tick.)*
- [ ] Ghi được ba giá trị `RNGFND1_TYPE` (`1` / `100` / `20`) và dùng ở đâu.
- [ ] Đã ghi dòng kết luận về `PRX_*` vào Ghi chú (Phase 11 và 14 sẽ đọc).

Ghi chú: 

## Phase 05 — Backend MAVLink + telemetry

Plan: plans/phase-05-backend-mavlink-telemetry.md

Ngày bắt đầu: ______ · Ngày xong: ______

- [ ] `uv run python -m backend.mavlink.connection` in `Heartbeat received: yes`, **đồng thời** Mission Planner vẫn nối được SITL ở cổng khác.
- [ ] `ws_probe --measure-rate` cho 7.5–8.5 Hz; mọi trường trong bảng `telemetry.data` (trừ nhóm Phase 07) có giá trị thật khi SITL đã có GPS fix.
- [ ] Tắt SITL → `connected` về `false` + `event` `link.lost` trong ≤ `LINK_TIMEOUT_S`+1 s, backend không crash. Bật lại → tự nối trong ≤ 10 s và `ATTITUDE` trở lại 10 Hz.
- [ ] Gửi `type` lạ → nhận `error` `unknown_type` và **socket vẫn mở**.
- [ ] Hai socket cùng xin web control → socket thứ hai nhận `command_denied`.
- [ ] `backend/ws-contract.schema.json` tồn tại, chứa đủ mọi `type` trong hợp đồng; đã commit.
- [ ] `uv run ruff check .` + `uv run ruff format --check .` sạch; `uv run pytest` xanh toàn bộ (4 file cũ vẫn xanh).
- [ ] `app.py` ≤ 80 dòng; `grep -n "ws/telemetry" backend/` không còn kết quả.
- [ ] Mọi lời gọi `mav.*_send` trong `backend/` đều đi qua `MavlinkConnection.send()` (kiểm bằng `grep -rn "\.mav\." backend/`).
- [ ] Khối Vision trong `backend/config.py` có đủ `YOLO_DEVICE`, `DETECTION_IMGSZ`, `VISION_ENABLED` (5.7); `_env_bool` tồn tại.
- [ ] `docs/so-tay/05-backend-mavlink-telemetry.md` đã viết.

Ghi chú: 

## Phase 06 — Backend điều khiển + dead-man

Plan: plans/phase-06-backend-dieu-khien-deadman.md

Ngày bắt đầu: ______ · Ngày xong: ______

- [ ] `uv run pytest backend/tests/test_deadman.py -v` → **6 PASSED**, gồm đủ 3 test bắt buộc của `SAFETY.md` §5.
- [ ] `uv run pytest backend/tests/test_control.py -v` → **6 PASSED** (5 hành vi + 1 canh gác hàm cấm).
- [ ] 4 test cũ trong `test_safety.py` **vẫn xanh** (không được phá vốn đang chạy).
- [ ] Chuyển thử `DeadmanLoop` vào asyncio → test #5 phải **đỏ**. (Bằng chứng test có tác dụng; hoàn nguyên sau khi thử.)
- [ ] `scripts/sitl_deadman_check.py` in `KET QUA: PASS`, độ trễ zero-velocity **< 300 ms**.
- [ ] 4 bài nghiệm thu tay ở 6.8 đều đạt; ghi `docs/test-log.md`.
- [ ] `grep -rniE "send_motor_pwm|rc_channels_override|21196|do_motor_test|actuator_control|set_attitude_target" backend/` chỉ ra các dòng **ghi chú cấm**, không có lời gọi thật nào.
- [ ] `grep -rn "\.mav\." backend/mavlink/control.py` — mọi lời gọi đều nằm trong `connection.send(...)`, không gọi thẳng.
- [ ] Xin `takeoff 50` (vượt `MAX_ALT=10`) → nhận `error`, và **không** có lệnh 22 nào được gửi (kiểm bằng log MAVProxy).
- [ ] `uv run ruff check .` sạch; `uv run pytest` xanh toàn bộ.
- [ ] `docs/so-tay/06-backend-dieu-khien-deadman.md` đã viết, có giải thích NED + `type_mask` + ba lớp dead-man.

Ghi chú: 

## Phase 07 — Backend mission + proximity + safety

Plan: plans/phase-07-backend-mission-proximity-safety.md

Ngày bắt đầu: ______ · Ngày xong: ______

- [ ] `uv run pytest` xanh toàn bộ; **6 test cũ** trong `test_mission_validation.py` không phải sửa một dòng nào.
- [ ] `uv run pytest --cov=... --cov-fail-under=80` PASS cho `safety` + `mission` + `deadman` + `proximity`.
- [ ] **Bốn phép thử phá** (7.10.3) đều làm ≥1 test đỏ; kết quả + ngày ghi vào sổ tay; `git diff` sạch sau khi hoàn nguyên.
- [ ] **Mission Planner Read WPs** hiện đúng mission do backend upload — oracle độc lập, không phải backend tự khẳng định về mình.
- [ ] Mission sai (alt 50 m) bị chặn **trước khi** gửi `MISSION_COUNT`.
- [ ] `avoid_state` chạy đủ 4 nhánh trên SITL; **không** lên `ACTIVE` ở GUIDED (đúng thiết kế).
- [ ] Bảng máy trạng thái 7.7 có test cho **cả cột "KHÔNG LÀM"**.
- [ ] Phép quét hàm cấm (7.9) trên toàn `backend/` không ra dòng nào, và đã thành test trong CI.
- [ ] `GET /api/status` trả **đúng** hình dạng `status.data` của hợp đồng Phase 05 (so khớp bằng `ws-contract.schema.json`).
- [ ] `/api/video/stream` hiện hình trong trình duyệt; message `detection` bám đúng hình chữ nhật.
- [ ] `backend/vision/detector.py`, `events.py` **không bị sửa** (`git diff --stat` xác nhận); `backend/vision/stream.py` **có** sửa (điền thân parser + proxy).
- [ ] `docs/hop-dong-mjpeg.md` tồn tại, đủ bốn header (`X-Frame-Id`, `X-Timestamp-Ms`, `X-Jpeg-Quality`, `X-Framesize`); `stream.py` và `fake_stream.py` cùng khớp đúng hợp đồng đó.
- [ ] `docs/so-tay/07-backend-mission-proximity-safety.md` đã viết, có đủ 5 lý do "vì sao backend không tự đổi mode".

Ghi chú: 

## Phase 08 — Web khung + HUD

Plan: plans/phase-08-web-khung-hud.md

Ngày bắt đầu: ______ · Ngày xong: ______

- [ ] `pnpm tsc --noEmit` không lỗi; `pnpm build` thành công; `pnpm vitest run` xanh.
- [ ] Mở `http://127.0.0.1:8000` (bản build) thấy HUD chạy với dữ liệu SITL thật.
- [ ] DevTools → Network → WS: **đúng một** kết nối (không bị `StrictMode` nhân đôi).
- [ ] Tắt SITL → chỉ ô "Backend ↔ Drone" đỏ; tắt backend → chỉ ô "Trình duyệt ↔ Backend" đỏ. Hai ô độc lập.
- [ ] Nối lại tự động trong ≤ 10 s sau khi backend sống lại; EventLog ghi nhận.
- [ ] Gửi message rác → giao diện không sập, có cảnh báo trong EventLog.
- [ ] `protocol.ts` có dòng ghi nguồn sinh, và test chống-trôi so với `ws-contract.schema.json` đang xanh.
- [ ] `grep -rn "127.0.0.1:8000\|localhost:8000" frontend/src` → **không kết quả** (mọi thứ dùng đường dẫn tương đối).
- [ ] Không có ngưỡng an toàn nào hardcode trong `frontend/src` — tất cả đọc từ `status.limits`.
- [ ] `null` hiện `—`, không có ô nào hiện `0` khi chưa có số đo.
- [ ] `docs/so-tay/08-web-khung-hud.md` đã viết.

Ghi chú: 

## Phase 09 — Web bản đồ + mission

Plan: plans/phase-09-web-ban-do-mission.md

Ngày bắt đầu: ______ · Ngày xong: ______

- [ ] `pnpm tsc --noEmit`, `pnpm vitest run`, `pnpm build` đều sạch.
- [ ] Marker drone xoay đúng hướng và **không** bị tháo-gắn lại mỗi khung (kiểm bằng Profiler).
- [ ] Vệt đường không dài thêm khi drone đứng yên; xoá được; giới hạn 2000 điểm.
- [ ] Vòng tròn geofence có nhãn ghi rõ **"chỉ là lớp phụ, geofence thật nằm trên FC"**.
- [ ] Bảng mission luôn có dòng CẤT CÁNH đầu và VỀ NHÀ/HẠ CÁNH cuối, không xoá được; `seq` luôn liên tục sau khi đổi thứ tự/xoá.
- [ ] `missionRules.test.ts` dùng **cùng bộ dữ liệu** với `backend/tests/test_mission_validation.py` và cho cùng kết quả.
- [ ] Nạp mission 4 điểm → **Mission Planner Read WPs hiện đúng** (oracle độc lập).
- [ ] Lớp "bản nháp" và lớp "đã nạp" phân biệt được ngay bằng mắt; chỉ vẽ lớp "đã nạp" khi `source === "readback"`.
- [ ] Mission sai bị khoá nút NẠP kèm lý do; mission sai gửi thẳng qua `ws_probe` bị backend từ chối và UI không vẽ nhầm.
- [ ] `grep -rn "50\b\|max_distance\|min_alt\|max_alt" frontend/src` — không có ngưỡng nào gõ cứng, tất cả từ `status.limits`.
- [ ] `docs/so-tay/09-web-ban-do-mission.md` đã viết.

Ghi chú: 

## Phase 10 — Web điều khiển + obstacle + video

Plan: plans/phase-10-web-dieu-khien-obstacle-video.md

Ngày bắt đầu: ______ · Ngày xong: ______

- [ ] `pnpm tsc --noEmit`, `pnpm vitest run`, `pnpm build` đều sạch.
- [ ] **`deadman.spec.ts` xanh, độ trễ đo được < 300 ms** — ba test của `SAFETY.md` §5 đã chạy trên cả chuỗi trình duyệt→backend→FC.
- [ ] Alt-Tab giữa lúc giữ `W` → drone dừng (bẫy `blur` có test đơn vị + bài nghiệm thu #5).
- [ ] `keydown` **không** gửi lệnh; chỉ `setInterval` gửi, nhịp 10 Hz (≥ 5 Hz theo yêu cầu).
- [ ] Công tắc WEB CONTROL chỉ đổi màu **sau** khi `status` từ backend đổi, không đổi ngay khi bấm.
- [ ] `SafetyBanner` hiện suốt thời gian web giữ quyền, không đóng được.
- [ ] ARM / TAKEOFF / AUTO / DISARM có hộp xác nhận; **RTL / LAND / HOLD không có** (nút thoát hiểm).
- [ ] Panel vật cản hiện **đúng dòng cảnh báo "chế độ này KHÔNG tự tránh vật cản"** khi ở AUTO/GUIDED/RTL.
- [ ] Cung không có dữ liệu vẽ **gạch chéo**, không vẽ xanh.
- [ ] Box nhận diện **trùng khít** hình chữ nhật của nguồn MJPEG giả ở ít nhất 2 kích thước cửa sổ khác nhau (chứng minh quy đổi toạ độ đúng, không gõ cứng 320×240).
- [ ] Tắt nguồn video → telemetry, điều khiển, bản đồ **không bị ảnh hưởng** (`SAFETY.md` mục 9).
- [ ] Bay trọn chuyến SITL từ web: cất cánh → lái tay → mission AUTO → RTL. 9 bài ở 10.8 đều đạt, ghi `docs/test-log.md`.
- [ ] `grep -rn "320\|240" frontend/src/components/VideoPanel` — không có kích thước nào gõ cứng.
- [ ] `docs/so-tay/10-web-dieu-khien-obstacle-video.md` đã viết.

Ghi chú: 

## Phase 11 — Firmware ArduPilot + param

Plan: plans/phase-11-firmware-ardupilot-param.md

Ngày bắt đầu: ______ · Ngày xong: ______

- [ ] `firmware/ardupilot/build-d450a747/` có đủ 7 file, `arducopter_with_bl.hex` khoảng 2,4–2,5 MB.
- [ ] `git status --short` **không** liệt kê file `.hex`, `.apj`, `.bin`, `arducopter`.
- [ ] `Select-String ... -Pattern "PROXIMITY|TFMINI|AVOID|OAPATHPLANNER"` trên `build.log` trả về ≥ 1 dòng cho mỗi từ khoá.
- [ ] `Compare-Object` giữa hai danh sách `selected_features` trả về rỗng (hoặc khác biệt đã được ghi và xử lý trong `NOTES.md`).
- [ ] `NOTES.md` có: bảng 6 feature đã tick, cách rebuild 5 bước, cách kiểm chứng `PRX1_TYPE`.
- [ ] `firmware/ardupilot/params/README.md` mô tả đủ quy ước `00..07` và ba luật.
- [ ] `01-base.param` có đúng 33 dòng tham số; mở bằng Notepad không thấy ký tự lạ.
- [ ] `02-avoid-tfmini.param` có đủ 17 dòng tham số và giữ nguyên phần chú thích gốc; không còn tham chiếu tới đường dẫn cũ.
- [ ] Đã nạp thử cả hai file vào SITL; danh sách tham số bị từ chối đã dán vào `NOTES.md`.
- [ ] `docs/so-tay/11-firmware-va-param.md` tồn tại và giải thích đủ 7 khái niệm ở 11.8.

Ghi chú: 

## Phase 12 — Firmware ESP32 + camera

Plan: plans/phase-12-firmware-esp32-camera.md

Ngày bắt đầu: ______ · Ngày xong: ______

- [ ] `firmware/dronebridge/bin/` có file `.bin`; `git status` **không** liệt kê nó.
- [ ] `firmware/dronebridge/README.md` có đủ 5 mục; bảng cấu hình điền hết trừ 3 ô *chưa xác minh*.
- [ ] `pio run -e esp32cam` → `SUCCESS`.
- [ ] `pio run -e xiao_esp32s3` → `SUCCESS`, **hoặc** board id đã được sửa theo `pio boards` và ghi chú "chưa xác minh" đã được cập nhật kèm ngày.
- [ ] `git status` **không** hiện `firmware/camera/include/secrets.h` và **không** hiện `.pio/`.
- [ ] `firmware/camera/README.md` có nghi thức nạp ESP32-CAM (`IO0 → GND`) và cảnh báo nguồn.
- [ ] `py -3.13 scripts/bench_tfmini.py COM99` báo lỗi **mở cổng**, không phải lỗi cú pháp.
- [ ] Hotspot laptop bật được ở 2,4 GHz; SSID/mật khẩu đã vào `secrets.h`; IP laptop đã ghi vào `docs/so-tay/12-hotspot-laptop.md`.
- [ ] `Get-NetFirewallRule -DisplayName "IOTCV*"` trả về rule UDP 14550.
- [ ] `docs/so-tay/12-esp32-cho-nguoi-moi.md` giải thích đủ 8 khái niệm ở 12.8.

Ghi chú: 

## Phase 13 — Chuẩn bị lắp ráp

Plan: plans/phase-13-chuan-bi-lap-rap.md

Ngày bắt đầu: ______ · Ngày xong: ______

- [ ] `docs/so-tay/13-mua-sam.md` có đủ 11 dòng món kèm cột "chặn phase nào"; **đơn hàng đã đặt**.
- [ ] Camera đã chốt nhánh (A/B/C) **hoặc** đã đặt 10 món còn lại và ghi rõ camera đặt sau.
- [ ] `docs/so-tay/13-dau-day.md` có: bảng tra 10 cổng, mục GPS với 3 lỗi kinh điển, mục TFmini với màu dây, mục phân bổ nguồn 5V, hai điều cấm, danh sách 12 mối hàn có ô tick.
- [ ] `docs/so-tay/13-bo-tri-khung.md` có sơ đồ nhìn từ trên và bảng 6 quyết định vị trí kèm lý do.
- [ ] Ba tờ checklist đã **in ra giấy** và đang nằm cạnh bàn; mỗi tờ có dòng "KHÔNG CÁNH QUẠT" ở đầu trang.
- [ ] Chỗ làm đã chuẩn bị: bàn phẳng, túi LiPo, quạt hút/cửa sổ mở, dụng cụ bổ sung đã mua.
- [ ] **Đã hàn được 5 mối liên tiếp đạt tiêu chí** ở bài 2; ảnh mối đạt và mối nguội đã dán vào sổ tay.
- [ ] Mọi giá trong danh sách mua đều được đánh dấu *chưa xác minh*.

Ghi chú: 

## 🔧 Phase 14 — Hàng về + nạp firmware

Plan: plans/phase-14-hang-ve-nap-firmware.md

Ngày bắt đầu: ______ · Ngày xong: ______

- [ ] Tờ 1 (mở thùng) đã tick hết; ảnh đã lưu vào `logs/kiem-hang/`.
- [ ] Motor: đủ **2 ren thuận + 2 ren nghịch** (đã tự vặn tay kiểm, không tin nhãn hộp).
- [ ] Pin: 4 cell đều trong khoảng 3,80–3,85 V, lệch < 0,05 V.
- [ ] Device Manager hiện `STM32 BOOTLOADER` khi vào DFU (không có dấu chấm than).
- [ ] STM32CubeProgrammer báo Download thành công với `arducopter_with_bl.hex`.
- [ ] Mission Planner CONNECT được; banner ghi `ArduCopter V4.7.1` + `SpeedyBeeF405V5`.
- [ ] **Tìm thấy `PRX1_TYPE`, `RNGFND1_TYPE`, `AVOID_ENABLE` trong Full Parameter List.**
- [ ] `firmware/ardupilot/params/00-after-flash.param` đã lưu **và đã commit**.
- [ ] `01-base.param` đã Write + reboot; 8 tham số then chốt đọc lại đúng giá trị.
- [ ] Danh sách tham số bị từ chối đã ghi vào `docs/so-tay/14-nap-firmware.md` và ngắn hơn danh sách của SITL (Phase 11.7).
- [ ] **Chưa cắm pin lần nào trong phase này.**

Ghi chú: 

## 🔧 Phase 15 — Bàn: RC + GPS + compass

Plan: plans/phase-15-ban-rc-gps-compass.md

Ngày bắt đầu: ______ · Ngày xong: ______

- [ ] Đèn iA6B sáng liên khi bật cả hai; tay phát đã ở Output mode `i-BUS`.
- [ ] Radio Calibration: 4 cần có dải ~1000–2000, cần ở giữa ~1500; không cần nào bị kẹt một đầu.
- [ ] Gạt SwC qua 3 vị trí → tên chế độ đổi đúng **Stabilize → AltHold → Loiter**.
- [ ] Gạt SwD → chế độ đổi thành **RTL**; gạt về thì trở lại chế độ cũ.
- [ ] `RC7_OPTION = 0` và `RC8_OPTION = 0` (chưa gán Auto).
- [ ] **RC failsafe đã test thật**: tắt tay phát → Mission Planner báo `Radio Failsafe`; bật lại → hết báo. Đã cấu hình **cả hai lớp** (failsafe trên FS-i6X + `FS_THR_ENABLE` trên bo bay).
- [ ] GPS ngoài trời: `3D Fix`, `HDOP < 1.5`, số vệ tinh ≥ 9.
- [ ] `COMPASS_DEV_ID` khác 0 (la bàn được nhận diện).
- [ ] HUD phản ứng đúng chiều khi nghiêng bo bay.
- [ ] `02-radio.param` và `03-gps.param` đã lưu **và đã commit**.
- [ ] **Chưa cắm pin lần nào.** **Chưa hiệu chỉnh la bàn và gia tốc kế** (để Phase 19).

Ghi chú: 

## 🔧 Phase 16 — Bàn: nguồn + motor + ESC

Plan: plans/phase-16-ban-nguon-motor-esc.md

Ngày bắt đầu: ______ · Ngày xong: ______

- [ ] Tụ 1000 µF đã hàn đúng cực vào pad BAT của ESC; hai tầng đã chồng có ốc nylon + đệm silicone.
- [ ] **4 phép đo continuity đều không beep** — làm **trước** khi cắm pin.
- [ ] Cắm pin lần đầu: không khói, không mùi khét, không linh kiện nóng bất thường, đèn sáng bình thường.
- [ ] Đường 5V của stack trong 4,8–5,2 V; chân 4V5 của cổng GPS ≥ 4,7 V (hoặc đã hàn dây bù).
- [ ] HUD và đồng hồ vạn năng khớp nhau trong **0,05 V**; `BATT_VOLT_MULT` mới đã ghi vào `01-base.param` và **đã commit**.
- [ ] `BATT_ARM_VOLT` đã đặt 14.8 trên bo bay.
- [ ] Motor Test: nút A/B/C/D quay đúng 4 motor theo thứ tự chiều kim đồng hồ; `FRAME_TYPE` cuối cùng đã xác định (X hoặc X Betaflight) **bằng thực nghiệm, không phải bằng phỏng đoán**.
- [ ] Chiều quay 4 motor đúng bảng CCW/CCW/CW/CW; bảng "motor nào phải đổi dây" đã ghi.
- [ ] 4 motor khởi động mượt và gần như cùng lúc ở 5–10% với DShot300.
- [ ] ESC telemetry: có RPM, **hoặc** đã ghi nhận "chưa có" và quyết định thử lại ở Phase 22.
- [ ] Thông điệp pre-arm đã ghi nguyên văn vào sổ tay; **`ARMING_CHECK` không bị đụng tới**.
- [ ] Pin đã rút và cất trong túi chống cháy; mối nối tạm đã tháo và bọc lại.
- [ ] **Không có cánh quạt nào được gắn trong toàn bộ phase.**

Ghi chú: 

## 🔧 Phase 17 — Bàn: ESP32 + TFmini + camera

Plan: plans/phase-17-ban-esp32-tfmini-camera.md

Ngày bắt đầu: ______ · Ngày xong: ______

**Cổng pass chính của cả nhóm phase test trên bàn:**

- [ ] **Web GCS hiện telemetry SỐNG của drone THẬT đang nằm trên bàn** — góc nghiêng, hướng, GPS, điện áp pin, chế độ bay, trạng thái armed — và **tất cả đi qua Wi-Fi với cáp USB đã rút**.
- [ ] **Panel obstacle trên web hiện số thật của TFmini Plus** và đổi theo khi đưa tay lại gần.

Các cổng phụ:

- [ ] ESP32 bridge ở chế độ STA, nối được vào hotspot laptop.
- [ ] Mission Planner nối được qua UDP 14550 không dây (đã rút USB).
- [ ] `MAVLINK_ENDPOINT=udpin:0.0.0.0:14550` trong `.env`; log backend hiện heartbeat của bo bay thật.
- [ ] `rangefinder1` hiện trong Mission Planner tab Status và phản ứng đúng.
- [ ] `PRX1_TYPE`, `RNGFND1_TYPE`, `AVOID_ENABLE`, `FENCE_ENABLE`, `OA_TYPE=0` đọc lại đúng giá trị sau khi nạp `02-avoid-tfmini.param`.
- [ ] Camera nối hotspot; `/stream` và `/set?quality=` chạy được khi truy cập trực tiếp; panel video trên web hiện ảnh thật kèm lớp phủ **giả**.
- [ ] Bài kiểm tổng 10 phút: telemetry không đứt; mọi lần đứt (kể cả video) đã ghi lại.
- [ ] fps camera thật đã đo và ghi vào sổ tay (thay cho con số *chưa xác minh* chép trên mạng).
- [ ] **Không có cánh quạt nào trong toàn bộ phase; tay phát luôn bật và trong tầm tay khi bấm nút trên web; `FS_GCS_ENABLE` vẫn bằng 0.**

Ghi chú: 

## 🔧 Phase 18 — Lắp ráp khung

Plan: plans/phase-18-lap-rap-khung.md

Ngày bắt đầu: ______ · Ngày xong: ______

- [ ] Khung lắp xong; đặt trên mặt bàn phẳng, 4 đầu cần cùng mặt phẳng, khung không bập bênh, không cần nào cong hay rơ.
- [ ] **Không có lỗ khoan mới nào trên tấm đế S500.**
- [ ] 4 motor bắt chắc, quay trơn bằng tay, cần đã dán nhãn `M1` `M2` `M3` `M4` đúng quy ước Quad X của ArduPilot (M1 trước-phải CCW, M2 sau-trái CCW, M3 trước-trái CW, M4 sau-phải CW).
- [ ] 4 motor đã phân loại theo chiều ren và đặt đúng vị trí (2 ren cho vị trí CCW ở M1/M2, 2 ren cho vị trí CW ở M3/M4); cánh vặn vào bằng tay được, không phải dùng lực.
- [ ] 12 mối hàn nối dài dây motor đã bọc gen; với **cả 4 motor**: thông mạch từng pha OK, 3 điện trở giữa các pha bằng nhau, **không pha nào chạm vỏ motor hay chạm ốc khung**.
- [ ] Đo continuity `BAT+` ↔ `BAT−`: **không kêu bíp liên tục**. Đo `BAT+` ↔ ốc khung: **không kêu**.
- [ ] Tụ 1000 µF đã hàn sát pad `BAT+`/`BAT−` của ESC, **đúng cực** (đã đối chiếu vạch dấu trên thân tụ, có ảnh `04-tu-dien.jpg`).
- [ ] Stack nằm trên bát chống rung 30,5×30,5; **không có ốc nào xuyên qua bát xuống thẳng khung**; mũi tên FC hướng về mũi drone (hoặc đã ghi lại góc xoay để đặt `AHRS_ORIENTATION` ở Phase 19).
- [ ] Cáp 10 chân cắm chắc hai đầu, không kẹt giữa hai tầng; đã bọc vỏ silicone; không có kim loại nào chạm giữa hai tầng.
- [ ] Hai anten iA6B vuông góc 90°, phần đầu nhạy duỗi thẳng, cách dây nguồn motor ≥ 5 cm.
- [ ] GPS M10 trên cột ở phía đuôi, mũi tên GPS cùng hướng mũi tên FC (hoặc đã ghi lại độ lệch cho `COMPASS_ORIENT`).
- [ ] TFmini Plus chĩa thẳng trước; nhìn dọc theo hướng ống kính **không thấy bất kỳ phần nào của drone**; nguồn lấy từ BEC của stack (không dùng chung UBEC với ESP32).
- [ ] ESP32 bridge + board camera + UBEC 5V 3A cố định chắc; tụ 470–1000 µF đã hàn sát chân nguồn board camera; bát camera lắp được cho cả ESP32-S3 lẫn ESP32-CAM.
- [ ] Pin gắn bằng velcro **và** dây đai; xách drone lên bằng pin thì pin không xê dịch; vị trí pin đã đánh dấu bút dạ.
- [ ] Treo drone (đã có pin, chưa có cánh) trên hai đầu ngón tay tại hai điểm đối xứng qua tâm → nằm ngang trong ±5°.
- [ ] `docs/do-dac/18-can-khoi-luong.md` đã điền đủ số cân thật; tỉ số `4800 g / AUW` ≥ 2 : 1.
- [ ] Đủ 13 ảnh trong `docs/so-tay/anh/18/`.
- [ ] `docs/so-tay/18-lap-rap-khung.md` đã viết xong.
- [ ] **Cánh T1045 vẫn còn nguyên trong hộp, chưa từng gắn lên drone.**

Ghi chú: 

## 🔧 Phase 19 — Hiệu chỉnh trên khung + failsafe

Plan: plans/phase-19-hieu-chinh-tren-khung-failsafe.md

Ngày bắt đầu: ______ · Ngày xong: ______

- [ ] 4 nhóm phép đo continuity trên khung đã lắp cho kết quả **giống hệt** Phase 18.
- [ ] Cấp điện qua smoke stopper: đèn nháy rồi tắt, không board nào nóng, mọi đèn sáng, Mission Planner nhận bo bay.
- [ ] `Accel Calibration` 6 vị trí báo `Calibration Successful`; `Calibrate Level` đã chạy trên mặt phẳng ngang; HUD nằm ngang khi drone đậu trên mặt phẳng ngang.
- [ ] `Onboard Mag Calibration` chạy **ngoài trời**, thanh tiến trình tới 100% không tụt lùi; offset tổng nhỏ; chĩa mũi drone về Bắc thật thì biểu tượng trên bản đồ Mission Planner cũng chỉ Bắc (lệch ≤ 15°); không còn cảnh báo compass.
- [ ] Radio: 4 cần đúng dải 1000/1500/2000; CH5 ra đủ `Stabilize`/`AltHold`/`Loiter`, CH6 ra `RTL`, CH7 (`WEB CONTROL ENABLE`) đổi giá trị `rcin` khi gạt, CH8 vẫn để trống; ở 50 m vẫn đổi được mode.
- [ ] Motor Test: 4 nút A/B/C/D ra đúng 4 motor (đã đối chiếu với **sơ đồ khung hiển thị trong Mission Planner**, không dựa vào trí nhớ).
- [ ] 4 chiều quay đúng: M1 CCW, M2 CCW, M3 CW, M4 CW.
- [ ] Test desync: đẩy ga 10→20→30→50 % trên cả 4 motor, **không** có tiếng khục / giật / tự dừng; tăng ga đột ngột cũng không; 4 motor khởi động mượt và gần như cùng lúc ở 5–10 %.
- [ ] `esc1..4_rpm` có số trên tab `Status` khi chạy Motor Test (nếu không có: đã ghi lại, không chặn Phase 20, phải xử lý trước Phase 22).
- [ ] Test RC failsafe: tắt tay FS-i6X → cảnh báo hiện trong ≤ 3 giây **và** giá trị kênh ga tụt xuống dưới `FS_THR_VALUE`; bật lại → cảnh báo tự hết.
- [ ] Điện áp Mission Planner khớp đồng hồ vạn năng trong **0,05 V**; `BATT_LOW_VOLT,14.0` / `BATT_CRT_VOLT,13.2` / `BATT_FS_LOW_ACT,2` / `BATT_FS_CRT_ACT,1` / `BATT_LOW_TIMER,10` / `BATT_CAPACITY,5300` đã đặt; `BATT_ARM_VOLT` đã bật lại.
- [ ] `FS_GCS_ENABLE` = **0**.
- [ ] `FENCE_ENABLE,1` + `FENCE_TYPE,3` + `FENCE_ALT_MAX,30` + `FENCE_RADIUS,50` + `FENCE_ACTION,1` + `FENCE_MARGIN,2`; hàng rào hiện đúng trên bản đồ Mission Planner; giá trị 30/50 đã được đối chiếu với kích thước bãi bay thật.
- [ ] **Không còn cảnh báo pre-arm nào**, và **không một pre-arm check nào bị disable** (`ARMING_CHECK` giữ nguyên giá trị mặc định đầy đủ).
- [ ] Arm/disarm không cánh 3/3 lần thành công; cả 4 motor idle đều, không motor nào đứng im.
- [ ] 4 cánh gắn đúng: CCW trên M1/M2, CW trên M3/M4; vặn vào **không cần lực**; xoay theo chiều quay thì **siết chặt thêm**; không rơ; không cánh nào nứt.
- [ ] Đo lực đẩy thật trên cân ở 25/50/75/100 %; tỉ số `(lực đẩy 100% × 4) / AUW` ≥ **2 : 1**; đã ghi vào `docs/do-dac/19-do-luc-day.md`.
- [ ] `docs/checklist-truoc-bay.md` đã viết và **đã in ra giấy**.
- [ ] Pin 4S: 4 cell đều 4,20 V ±0,03 V, không phồng, không rách.
- [ ] `firmware/ardupilot/params/04-pre-first-flight.param` đã lưu và commit với prefix `param:`.
- [ ] `docs/so-tay/19-hieu-chinh-failsafe.md` đã viết xong.

Ghi chú: 

## 🔧 Phase 20 — Bay RC cơ bản

Plan: plans/phase-20-bay-rc-co-ban.md

Ngày bắt đầu: ______ · Ngày xong: ______

- [ ] **F1 Stabilize PASS:** cất cánh thẳng, hover 0,5–1 m trong 30 giây, hạ cánh có kiểm soát, không phải ABORT.
- [ ] **F2 AltHold PASS:** ở cần ga giữa, độ cao dao động ≤ ±0,3 m trong 30 giây; không nảy theo chu kỳ.
- [ ] **F3 Loiter PASS:** buông hết cần 60 giây, trôi trong bán kính ≤ 1,5 m, **không toilet bowl**, phanh dứt khoát theo cả 4 hướng.
- [ ] **F4 RTL PASS:** từ 20 m ngang / 10 m cao, gạt RTL → tự leo, tự bay về, tự hạ cánh trong bán kính ≤ 3 m quanh điểm cất cánh, không can thiệp.
- [ ] Đủ **4 thư mục** `logs/flight_YYYYMMDD_HHMM/`, mỗi thư mục có `flight.bin` **và** `notes.md` đã điền đủ 8 dòng.
- [ ] Với **cả 4** bộ log, 7 mục checklist ở 20.2 đã kiểm và ghi số vào `docs/do-dac/20-ket-qua-bay.md`.
- [ ] Với **cả 4** bộ log: `VIBE` X/Y/Z < 30 m/s²; `Clip0` = `Clip1` = `Clip2` = **0**; EKF variance < 0.5; compass innovation dao động quanh 0 và độ lớn từ trường **không đổi theo ga**; `BAT.Volt` lúc treo **không** tụt dưới 14,0 V; 4 đường `RCOU` chụm.
- [ ] `MOT_THST_HOVER` học được đã ghi lại; nếu > 0,65 thì đã xử lý (giảm payload) trước khi sang Phase 21.
- [ ] `BATT_AMP_PERVLT` đã hiệu chỉnh ít nhất một vòng theo mAh sạc lại.
- [ ] `RTL_ALT` đã đặt cao hơn mọi vật cản trong bãi và thấp hơn `FENCE_ALT_MAX`.
- [ ] `firmware/ardupilot/params/05-loiter-good.param` đã lưu và commit với prefix `param:`.
- [ ] `docs/test-log.md` có đủ 4 dòng F1–F4.
- [ ] `docs/so-tay/20-bay-rc-co-ban.md` đã viết xong.
- [ ] Sau mỗi chuyến, sờ 4 motor và ESC: **không cái nào nóng tới mức không giữ tay được**.
- [ ] `CH7` (`WEB CONTROL ENABLE`) ở vị trí **TẮT** trong cả 4 bài; `CH8` vẫn chưa gán.

Ghi chú: 

## 🔧 Phase 21 — Bay tự động + từ web

Plan: plans/phase-21-bay-tu-dong-va-web.md

Ngày bắt đầu: ______ · Ngày xong: ______

- [ ] **Diễn tập trên bàn (không cánh) đã chạy cho CẢ BỐN bài** F5, F6, F7, F8, và mọi thao tác đều ra đúng kết quả **xác nhận trên Mission Planner**.
- [ ] **4 bài dead-man trên phần cứng thật đều pass**: giữ `W` → tiến; thả `W` → dừng; **đóng tab browser khi đang giữ `W` → dừng**; **tắt Wi-Fi laptop khi đang giữ `W` → dừng**.
- [ ] **F5 PASS:** mission 3 waypoint tạo bằng Mission Planner chạy đủ rồi RTL, không can thiệp; `Read WPs` khớp với mission đã upload; đã lưu `missions/21-f5-3wp.waypoints`.
- [ ] **F6 PASS:** 2 lệnh `GOTO` từ web tới đúng điểm và dừng; mission upload từ web chạy đủ rồi RTL; readback khớp trên **cả web lẫn Mission Planner**; đã lưu `missions/21-f6-web.waypoints`.
- [ ] **F7 PASS:** 6 hướng WASD/RF đúng và dừng được ở **0,5 m/s** và ở **1,0 m/s**; test dead-man trên không (thả tay khỏi bàn phím) → drone dừng.
- [ ] **F8 PASS:** web đang giữ `W` + RC gạt mode → **drone dừng ngay**, mode đổi đúng trên cả hai màn hình; biến thể A (`RTL`) đúng; biến thể B (`Auto` tạm dừng rồi tiếp tục) đúng; sau khi tắt `WEB CONTROL ENABLE` thì lái tay ở `Stabilize` bình thường.
- [ ] **RC nằm trong tay người vận hành trong cả 4 bài**, kể cả F5.
- [ ] `CH7` (`WEB CONTROL ENABLE`) **mặc định TẮT**; backend đọc kênh RC này, không đọc nút trên trình duyệt; web chỉ **hiển thị** trạng thái, không đặt được.
- [ ] `RC8_OPTION` đã gán `Auto` và đã kiểm trên bàn không cánh (gạt `CH8` → Mission Planner hiện `AUTO`; gạt xuống → về mode của `CH5`).
- [ ] Endpoint backend `udpin:0.0.0.0:14550` nhận được telemetry sau khi backend gửi gói đầu tiên.
- [ ] Đủ **4 thư mục** `logs/flight_YYYYMMDD_HHMM/` cho F5–F8, mỗi thư mục có `flight.bin`, `notes.md`, và `events.json` (với F6, F7, F8).
- [ ] 7 mục đọc log của Phase 20 mục 20.2 **cộng** 4 mục 8–11 ở mục 21.7 đã kiểm và ghi vào `docs/do-dac/21-ket-qua-bay-web.md`.
- [ ] Trong log, **mọi lần đổi mode đều truy ngược được** về một thao tác đã ghi trong `events.json` hoặc `notes.md` — không có lần đổi mode nào không giải thích được.
- [ ] Trong mọi đoạn `Guided`, drone **dừng trong ≤ 1 giây** sau lệnh cuối; không đoạn nào bay tiếp.
- [ ] `FS_GCS_ENABLE` **vẫn = 0**.
- [ ] Đã ghi lại khoảng cách xa nhất mà link Wi-Fi còn ổn (số liệu thực địa đầu tiên cho tầm 2,4 GHz).
- [ ] `firmware/ardupilot/params/06-auto-good.param` đã lưu và commit với prefix `param:`.
- [ ] `docs/test-log.md` có đủ 4 dòng F5–F8, ghi rõ ngày F8 pass.
- [ ] `docs/so-tay/21-bay-tu-dong-va-web.md` đã viết xong.

Ghi chú: 

## 🔧 Phase 22 — Tránh vật cản thật + tuning

Plan: plans/phase-22-tranh-vat-can-that-va-tuning.md

Ngày bắt đầu: ______ · Ngày xong: ______

- [ ] Bảng hiệu chuẩn TFmini ở **5 khoảng cách** (0,5 / 1 / 2 / 3 / 5 m) có sai lệch < 5 % so với thước dây; khi không có vật cản thì số đọc **không kẹt** ở một giá trị nhỏ.
- [ ] 14 tham số `AVOID_*` / `RNGFND1_*` / `PRX1_TYPE` / `OA_TYPE` đã xác nhận đúng trong Full Parameter List trước khi bay.
- [ ] Vật cản giả là **vật mềm, sáng màu, ≥ 1×1 m, cao ≥ 1,5 m**; **không** dùng tường/cây/xe/người.
- [ ] **F9 vòng 1 PASS:** drone tự dừng ở **2 m ± 0,5 m** trước vật cản dù người lái vẫn đẩy cần tới.
- [ ] **F9 vòng 2 PASS:** drone tự lùi ra khi vật cản tiến lại, giữ khoảng cách.
- [ ] **F9 vòng 3 PASS:** đẩy cần mạnh hơn vẫn không vượt qua mốc `AVOID_MARGIN`; không rung lắc mạnh quanh mốc.
- [ ] Log F9 cho thấy `RFND` và `POS` khớp nhau tại thời điểm drone dừng.
- [ ] Đã thử và ghi kết quả cho **ít nhất 3** tham số trong `AVOID_DIST_MAX` / `AVOID_ANG_MAX` / `AVOID_BACKUP_SPD` / `AVOID_ACCEL_MAX`, mỗi lần **chỉ đổi một** tham số.
- [ ] **F10 đã bay** với `OA_TYPE,1` ở bãi bán kính trống ≥ 60 m, đúng một vật cản giả, hai bên trống ≥ 20 m; kết quả đã **phân loại là A, B hoặc C**; không ABORT vì lý do an toàn.
- [ ] `OA_TYPE` đã được đặt về **giá trị cuối cùng** (0 nếu kết quả B/C) trong **cả bo bay lẫn file param**.
- [ ] `SERVO_BLH_POLES` đã **kiểm tra theo datasheet motor** (hoặc đếm nam châm), không còn là giá trị tạm.
- [ ] Đã đo FFT **baseline trước** khi bật notch: tần số đỉnh, biên độ, VIBE X/Y/Z đã ghi.
- [ ] Harmonic notch đã bật theo RPM của ESC (`SERVO_BLH_TRATE` nâng lên 100); đã bay lại **đúng bài baseline** và đo FFT **sau**; đỉnh ở tần số cánh **nhỏ đi rõ rệt** và VIBE trung bình **giảm**; `Clip` vẫn = 0. (Nếu không đạt hoặc xấu đi: đã tắt notch và ghi lại kết luận — đây cũng là kết quả hợp lệ.)
- [ ] AUTOTUNE: **hoặc** đã chạy ít nhất một trục với đủ 7 luật an toàn và hệ số mới đã bay thử trước khi lưu, **hoặc** đã ghi rõ quyết định không chạy kèm lý do.
- [ ] `firmware/ardupilot/params/02-avoid-tfmini.param` đã cập nhật, **giữ nguyên khối chú thích đầu file**, và có khối "ĐÃ KIỂM CHỨNG BẰNG BAY THẬT" ở cuối với ngày tháng và số liệu thật.
- [ ] `docs/do-dac/22-tuning-va-avoid.md` có đủ 5 mục của bảng ở 22.8.
- [ ] `docs/test-log.md` có dòng F9, F10 và dòng kết quả notch.
- [ ] Mỗi chuyến bay của phase này có `logs/flight_YYYYMMDD_HHMM/` với `flight.bin` + `notes.md`.
- [ ] `docs/so-tay/22-tranh-vat-can-tuning.md` đã viết xong.
- [ ] **`07-final.param` CHƯA được tạo** — đó là việc của Phase 24.

Ghi chú: 

## 🔧 Phase 23 — IoT MQTT + sự kiện + dashboard

Plan: plans/phase-23-iot-mqtt-su-kien-dashboard.md

Ngày bắt đầu: ______ · Ngày xong: ______

- [ ] `docker compose ps` hiện `uav-mosquitto` ở trạng thái `Up`; `Test-NetConnection 127.0.0.1 -Port 1883` trả `True`.
- [ ] `uv run pytest backend/tests/ -v` xanh toàn bộ, trong đó `test_events_throttle.py` có đủ 6 ca và `test_geo_projection.py` có đủ 4 ca.
- [ ] `mosquitto_sub -t "uav/#" -v` thấy đủ **4 topic** có tin đi qua (`uav/telemetry`, `uav/events/detection`, `uav/health`, `uav/qos`).
- [ ] **Test Last Will:** kill cứng backend → trong ≤ 10 s có tin `uav/health` với `"mqtt":"offline","reason":"last_will"`.
- [ ] `scripts/mqtt_probe.py` chạy 120 s in được bảng tổng kết có số tin, tỉ lệ mất gói, độ trễ p50/p95 cho từng topic.
- [ ] Test `FakeDetector` với kịch bản "10 giây có người": sinh **2–3 sự kiện**, không phải hàng chục.
- [ ] Mỗi sự kiện có đủ ba sản phẩm: dòng trong `detections.csv`, dòng trong `events.jsonl` **khớp nguyên văn** với payload MQTT, và một file snapshot đọc được có vẽ khung bao.
- [ ] Bảng sai số phép chiếu toạ độ có đủ 3 độ cao × 5 khoảng cách (75 sự kiện), báo cáo trung bình ± độ lệch chuẩn, có đoạn phân tích nguồn sai số.
- [ ] Bản đồ Web GCS ghim đúng vị trí mục tiêu kèm vòng tròn sai số bằng mét; bấm vào popup hiện được ảnh snapshot.
- [ ] Sự kiện có `target.valid=false` không ghim lên bản đồ nhưng vẫn xuất hiện trong event log.
- [ ] Panel IoT hiện đủ 7 khối; tắt broker → `mqtt: offline` trong ≤ 10 s; bật lại → tự về `ok` không cần tải lại trang.
- [ ] **Bài kiểm tra tổng:** bay treo 8 m, một người đi vào khung hình → dashboard hiện đúng một ghim + `mqtt_probe.py` ở cửa sổ khác nhận đúng sự kiện đó, hai bên khớp `seq`.

Ghi chú: 

## 🔧 Phase 24 — IoT QoS + hỏng hóc + báo cáo

Plan: plans/phase-24-iot-qos-hong-hoc-bao-cao.md

Ngày bắt đầu: ______ · Ngày xong: ______

- [ ] `uv run pytest backend/tests/test_qos_controller.py backend/tests/test_link_metrics.py -v` xanh, đủ 5 ca cho controller.
- [ ] Trên bàn: ép băng thông vượt ngưỡng → `mqtt_probe.py` thấy tin `uav/qos` với `reason:"link_degraded"` và `jpeg_quality` tăng đúng `QOS_STEP`.
- [ ] `frames.jsonl` của một phiên bay có **một dòng cho mỗi khung**, mỗi dòng có `jpeg_quality`; số dòng ≈ `fps × thời gian bay` (chênh < 10%).
- [ ] `jpeg_quality` không đổi quá 1 lần / `QOS_MIN_INTERVAL_S` giây (kiểm bằng cách đọc khoảng cách `ts` giữa các lần đổi trong `frames.jsonl`).
- [ ] **Bảng 1** đủ 6 mức `q`, có bytes/khung, bytes/s, fps.
- [ ] **Bảng 2** đủ 4 khoảng cách × 3 loại độ trễ, mỗi ô có p50 và p95, mỗi mốc 3 lần lặp.
- [ ] **Bảng 3** đủ 4 khoảng cách, có loss_pct và số khung rơi (RSSI có thể trống nếu đã ghi rõ lý do không đo được).
- [ ] `docs/test-matrix-hong-hoc.md` có đủ **6 dòng** (F1, F2, F3, F4a, F4b, F5), mỗi dòng ghi PASS + đường dẫn tới cả ba loại bằng chứng + dòng "trả lại gốc".
- [ ] **F3 đã chạy khi bay** (không chỉ bench) và có `.bin` ghi mode → LOITER.
- [ ] Mỗi thư mục `logs/YYYYMMDD-sessionN/` có đủ `flight.bin`, `frames.jsonl`, `events.jsonl`, `detections.csv`, `snapshots/`, `notes.md` đã điền tay.
- [ ] `firmware/ardupilot/params/07-final.param` tồn tại; diff với `06-auto-good.param` giải thích được từng dòng; `FS_GCS_ENABLE = 0`.
- [ ] `git tag -l v1.0` có kết quả; `git status --short` rỗng tại thời điểm tag; `ruff`, `pytest`, `pnpm build` đều xanh ở commit đó.
- [ ] `docs/bao-cao-iot/` có đủ 9 chương; chương 07 liệt kê ≥ 5 hạn chế cụ thể; mọi bảng số ghi kèm điều kiện đo và commit `v1.0`.
- [ ] Bảng đối chiếu 7 thí nghiệm của tổng quan §7.4 điền đủ cột trạng thái, **không xoá dòng nào**.
- [ ] `docs/demo-script.md` có đủ 9 mốc thời gian, mỗi mốc có cột dự phòng; checklist T-1 ngày / T-1 giờ / T-5 phút đã in ra giấy.
- [ ] Video dự phòng đã quay cho hai mốc rủi ro nhất (camera/nhận diện và bài F3).
- [ ] `docs/slides-iot-outline.md` có 14 slide; 4 slide kết quả có số thật.
- [ ] Bốn điểm đính chính ở 24.10 đã sửa xong trong `docs/bao-cao-tong-quan-du-an.md`; `README.md` đã viết lại ngắn.
- [ ] Checklist "dự án đã hoàn thành" (24.11) tick đủ phần A (18 bước) và phần B (8 mục); phần C trỏ sang luồng AI.
- [ ] `plans/archive/` chứa toàn bộ file phase; `plans/_phase-index.md` có dòng ghi ngày lưu trữ; `docs/lessons-learned.md` có đủ 6 mục.

Ghi chú: 

---

# 🤖 Luồng AI

Luồng phụ. Không chặn luồng chính; luồng chính không chờ nó. Về kỹ thuật `ai-01` chỉ cần Phase 01, nhưng **thứ tự ưu tiên**: chỉ bắt tay khi luồng chính đã tới khoảng Phase 19, hoặc khi có thời gian rảnh xen kẽ. `ai-03` bắt buộc chờ Phase 21.

## 🤖 ai-01 — Chuẩn bị AI

Plan: plans/ai/ai-phase-01-chuan-bi.md

Ngày bắt đầu: ______ · Ngày xong: ______

- [ ] `python ml\scripts\check_gpu.py` thoát mã 0, in `2.14.0+cu130` và `NVIDIA GeForce RTX 4060 Laptop GPU`, và phép nhân ma trận trên GPU chạy xong.
- [ ] `ml/pyproject.toml` ghim `albumentations==2.0.8` và `opencv-python>=4.10,<5`; `ml/.venv` là Python **3.13**, tách khỏi `.venv` của backend (cùng phiên bản, khác dự án `uv`).
- [ ] `ml/results/dataset_stats.json` tồn tại, `instances_person > 0` cho cả ba split, và **20 ảnh trong `ml/results/convert_check/` có hộp trùm lên người** (kiểm bằng mắt, ghi lại trong `smoke_report.md`).
- [ ] `ml/data/README.md` nằm trong git và ghi đủ giấy phép của VisDrone (không có LICENSE), HERIDAL (CC BY), albumentations (MIT, lý do ghim).
- [ ] `python -m pytest ml\tests -v` toàn bộ pass, **trong đó có test bao trùm bbox của rolling shutter**, và bộ test này **không import torch**.
- [ ] `ml/results/degrade_preview/` có ≥ 30 cặp ảnh trước–sau, nhìn thấy rõ ảnh sau giống ảnh camera rẻ.
- [ ] `split_dataset.py --dry-run` chạy được và `test_split_no_leak.py` chứng minh trùng session thì **raise**.
- [ ] Một epoch huấn luyện chạy xong cho cả `yolo26n` và `yolo11n`; `epoch_times.json` có số thật; `smoke_report.md` đã điền bảng ngoại suy.
- [ ] `metrics.json` của run smoke có khoá `coco.AR_small`, `buckets_by_height_px` và `latency_ms.fps` với giá trị số.
- [ ] Label Studio mở được ở `localhost:8080`, nhập 30 ảnh có tiền-gán-nhãn, sửa được, xuất ra YOLO đúng định dạng; `prelabel_bias.json` tồn tại.
- [ ] `dvc status` in `up to date`; `ml/datasets/visdrone_person.dvc` **commit được** (`git check-ignore -v` không in gì); đã thử xoá thư mục và `dvc pull` lấy lại thành công.
- [ ] `ml/tools/mjpeg_client.py --limit 20` (chạy sau khi `phase-07` dựng xong `GET /api/video/stream`) lưu đúng 20 `.jpg` + `manifest.jsonl` 20 dòng, `frame_id` tăng dần không trùng.

Ghi chú: 

## 🤖 ai-02 — Huấn luyện + thí nghiệm

Plan: plans/ai/ai-phase-02-huan-luyen-thi-nghiem.md

Ngày bắt đầu: ______ · Ngày xong: ______

- [ ] `plans/QUYET-DINH-CHUA-CHOT.md` có mục "Đã chốt" (hoặc `REPORT.md` ghi rõ đang chờ và A2.5 để trống có chủ đích).
- [ ] `r01` và `r02` train xong 100 epoch; bốn file `metrics.json` (2 model × val/test) đều có `coco.AR_small` khác `-1`.
- [ ] **`r02` đạt mAP50 ≥ 30% trên `visdrone_person/val`.** Nếu không đạt, chạy hết checklist chẩn đoán dưới đây **trước khi** ghi kết quả là cuối cùng:
  - nhãn đúng chưa (mở lại `ml/results/convert_check/`)
  - `dataset_stats.json` có `instances_person` hợp lý không
  - train có thật sự chạy GPU không (`epoch_times.json`)
  - thử thêm HERIDAL vào tập train
  - thử `imgsz` 960 nếu VRAM cho phép (giảm batch)
  - nếu vẫn thấp: **báo cáo trung thực con số thật** kèm phân tích, không nâng khống
- [ ] `r03` train xong; bảng 2×2 đã điền đủ 4 ô.
- [ ] `sahi_sweep.json` có ≥ 6 cấu hình, kèm ms/khung cho từng cấu hình.
- [ ] `.engine` build được; `bench_backends.json` có 4 backend; **mAP50 của `.engine` trong ±0.5 điểm so với `.pt`**.
- [ ] Backend khởi động được với `YOLO_WEIGHTS` trỏ vào `.engine`; khi engine hỏng thì quay về `.pt` **kèm cảnh báo rõ**, không im lặng.
- [ ] `restore_bench.json` có ≥ 5 bộ khôi phục, **bắt buộc có cả `none` và `bicubic`**, kèm phân tầng theo rổ kích thước.
- [ ] `ml/experiments/ma-tran-thi-nghiem.md` và `protocol-thu-du-lieu.md` tồn tại; mỗi TN ghi rõ đã chạy hay chờ dữ liệu bay.
- [ ] `ml/results/REPORT.md` có 6 bảng; **mọi bảng có cột AR-small**; mục "Kỳ vọng trung thực" và "Giới hạn" đã viết.
- [ ] `ml/scripts/evaluate.py` chỉ **thêm** cờ, schema `metrics.json` của A1.6 không bị đổi tên/xoá khoá nào.

Ghi chú: 

## 🤖 ai-03 — Dữ liệu bay thật

Plan: plans/ai/ai-phase-03-du-lieu-that.md

Ngày bắt đầu: ______ · Ngày xong: ______

- [ ] Có văn bản cho phép bay (hoặc chứng minh bay trong khu vực được phép); `nhat-ky-thu-du-lieu.md` ghi sự đồng ý của người xuất hiện trong ảnh.
- [ ] ≥ 6 session bay, phủ **ba dải độ cao**, mỗi dải ≥ 100 khung có người, thu ở ≥ 2 ngày khác nhau.
- [ ] **Mọi dòng trong `frames.csv` có `jpeg_quality` khác rỗng.** Đây là cổng cứng — thiếu là mất một trục thí nghiệm không lấy lại được.
- [ ] Một session `qsweep` phủ ≥ 8 mức `q`; có bảng byte/khung theo `q` và bảng tra `q_esp` ↔ `q_cv2`.
- [ ] ≥ 300 cặp ảnh qua được bộ lọc inlier của `align_pairs.py`; `align_report.json` cho tỉ lệ giữ ≥ 60%; xem mắt 20 cặp thấy chồng khít.
- [ ] `test_align_pairs.py` pass (homography biết trước, sai số reprojection < 2 px).
- [ ] `split_manifest.json` chứng minh **không session nào nằm ở hai split**; tập test là ảnh thật chưa augment và chứa ít nhất một dải độ cao không có trong train.
- [ ] `dvc push` xong cho `own_camera` và `paired`; `dvc status` sạch; đã thử `dvc pull` lấy lại một session.
- [ ] `prelabel_bias.json` có số thật và **đã áp luật quyết định** ở A3.9 bước 3.
- [ ] ≥ 1.500 ảnh có nhãn; `classes.txt` đúng một dòng `person`.
- [ ] `r05_yolo26n_own` train xong; (nhánh A) `r04_yolo26n_degraded_measured` train xong với `degrade_esp32_measured.yaml` có `measured: true`.
- [ ] Ba bảng ở A3.10 điền đủ, **mọi bảng có cột AR-small**; E và F đã đánh giá; G đã làm hoặc **đã ghi rõ là bỏ, kèm lý do**.
- [ ] `REPORT.md` có mục "Dữ liệu tự thu" với số cụ thể; `ma-tran-thi-nghiem.md` cập nhật trạng thái TN A và TN D.

Ghi chú: 

## 🤖 ai-04 — Báo cáo môn Xử lý ảnh

Plan: plans/ai/ai-phase-04-bao-cao-xla.md

Ngày bắt đầu: ______ · Ngày xong: ______

- [ ] `docs/bao-cao-xla/README.md` ghi đề tài đã chốt, câu hỏi nghiên cứu **một câu**, và yêu cầu của giảng viên.
- [ ] Đủ 12 file chương; §07 (đe doạ tính hợp lệ) có ≥ 8 mục; §09 (những gì không làm) có ≥ 6 mục kèm lý do.
- [ ] `python ml\scripts\make_figures.py` sinh **toàn bộ** hình trong một lần chạy; không hình nào vẽ tay hay chụp màn hình.
- [ ] Mọi bảng kết quả có cột **AR-small**; không chỗ nào có con số kiểu "độ chính xác 95%".
- [ ] Mục "kỳ vọng trung thực" nằm ở đầu §05 với baseline 21.9% / 11.7% và mục tiêu 30–45%.
- [ ] Mỗi con số truy ngược được về file trong `ml/results/` (soát ngẫu nhiên 10 con số để kiểm).
- [ ] `ml/scripts/reproduce.ps1` chạy thật được `-Stage figures` và `-Stage eval`; `reproduce_log.txt` có bằng chứng; phụ lục ghi rõ chặng nào chưa kiểm được.
- [ ] Mục giấy phép ghi đủ VisDrone (không LICENSE), HERIDAL (CC BY), Zero-DCE (CC BY-NC), albumentations (MIT + lý do ghim).
- [ ] Mọi URL trong §10 đã tự mở, có `[truy cập ngày ...]`; không dùng nguồn nào còn nằm ở danh sách "chưa kiểm chứng".
- [ ] Ảnh minh hoạ có người đã che mặt; `nhat-ky-thu-du-lieu.md` có ghi sự đồng ý.
- [ ] Xuất được ra định dạng giảng viên yêu cầu; kịch bản demo và bản ghi màn hình dự phòng đã sẵn sàng.

Ghi chú: 
