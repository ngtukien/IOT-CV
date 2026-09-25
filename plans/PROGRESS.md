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

Ngày bắt đầu: 21/09/2026 · Ngày xong: 21/09/2026

- [x] Sáu biến môi trường User (`UV_CACHE_DIR`, `UV_TOOL_DIR`, `UV_PYTHON_INSTALL_DIR`, `PIP_CACHE_DIR`, `NPM_CONFIG_CACHE`, `PLATFORMIO_CORE_DIR`) đều trỏ vào `D:\DevCache\...` — kiểm bằng `uv cache dir; uv tool dir; uv python dir; npm config get cache`.
- [x] Cây thư mục `D:\DevCache\{cache\{uv,pip,npm,pnpm-store},tools\{uv-tools,uv-python,platformio}}` và `D:\IOT_Tools\apps` tồn tại.
- [x] `py --list` hiện `3.13`.
- [x] `node --version` in v24.x, `pnpm --version` in 11.x, `uv --version` in 0.12.x.
- [x] `pwsh -NoProfile -File scripts/gui/gui.ps1 -Action windows` liệt kê được cửa sổ đang mở; `-Action shot -Monitor 0` tạo ra file PNG đọc được.
- [x] `docker info --format "{{.ServerVersion}}"` in ra số phiên bản.
- [x] `wsl --list --verbose` hiện `Ubuntu` VERSION = `2`; `df -h /` trong WSL còn > 15 GB.
- [x] Mission Planner cài trong `D:\IOT_Tools\apps\MissionPlanner\` (kiểm bằng `Test-Path` cộng với **vắng mặt** ở `C:\Program Files (x86)\Mission Planner` — MSI này **không** ghi `InstallLocation`, xem Ghi chú), mở được, hiện màn hình `FLIGHT DATA`.
- [x] MAVProxy cài trong `D:\IOT_Tools\apps\MAVProxy\`; `where.exe mavproxy` in đường dẫn `D:\`; `mavproxy.exe --version` chạy được.
- [x] STM32CubeProgrammer mở được.
- [x] `code --version` chạy; PlatformIO IDE có trong danh sách extension; `pio system info` in `Core Directory` trỏ `D:\DevCache\tools\platformio`.
- [x] `esptool version` in `v5.x`; `uv run python -c "import pymavlink; print(pymavlink.__version__)"` (trong `D:\Coding\IOT-CV`) in `2.4.x` và `sys.executable` bắt đầu bằng `D:\`.
- [x] Đã ghi số phiên bản thực tế vào Ghi chú dưới đây.

Ghi chú:

**Phiên bản thực tế đo ngày 21/09/2026.** Python 3.13.7 · Node v24.13.0 · pnpm 11.10.0 · uv 0.12.12 · Docker Engine 29.6.2 · WSL Ubuntu 24.04.4 LTS (VERSION 2, còn 920 GB trống, RAM 19 GiB) · Mission Planner 1.3.83 build 1.3.9384.38258 (295,8 MB, 1319 file) · MAVProxy 1.8.74 (352,5 MB, 1675 file) · VS Code 1.138.0 + `platformio.platformio-ide` · PlatformIO Core 6.2.0 · esptool v5.4.0 · pymavlink 2.4.49 · STM32CubeProgrammer 2.23.0 (1590 MB, 1436 file).

**Làm thêm ngoài cổng pass:** `%USERPROFILE%\.wslconfig` đã trỏ `swapFile=D:\\WSL\\swap.vhdx`; sau `wsl --shutdown` đã kiểm chứng `D:\WSL\swap.vhdx` tồn tại, WSL thấy 5 GB swap ở `/dev/sdc`, và `%TEMP%\swap.vhdx` trên C: **không còn**.

**⚠️ STM32CubeProgrammer — đọc trước khi vào Phase 14.** Wizard của nó chạy quyền Administrator nên không công cụ computer-use nào bấm được (ranh giới UIPI). Cách đã dùng là ép `__COMPAT_LAYER=RunAsInvoker` để hạ xuống Medium integrity; **đánh đổi là installer báo `Error writing to registry`** (`com.izforge.izpack.event.RegistryInstallerListener.performValueSetting`) rồi chết ở cuối bước 7/9, nên nó không chạy tới bước 8/9 — bước sinh shortcut và `uninstaller.jar`.

**Không mất tính năng nào, đã kiểm chứng từng thứ:** `STM32_Programmer_CLI.exe --version` in `2.23.0`; GUI mở, có ô chọn `ST-LINK` và nút `Connect`, log in `STM32CubeProgrammer API v2.23.0 | Windows-64Bits`; `Drivers\DFU_Driver\` đủ `.inf`, `.cat`, `installer_x64.exe`, `STM32Bootloader.bat`, cùng `Drivers\stsw-link009_v3\`.

**Phase 14 không bị ảnh hưởng.** Driver DFU cài bằng `pnputil -i -a Driver\STM32Bootloader.inf` (chạy `STM32Bootloader.bat` với quyền admin), hoàn toàn độc lập với registry mà installer đã không ghi được.

**Bốn thứ thiếu đã vá thủ công ngày 21/09/2026, kiểm chứng xong:**

| Thiếu | Đã vá bằng |
|---|---|
| Entry Add/Remove Programs | Ghi `HKLM\…\Uninstall\STM32CubeProgrammer` (Settings liệt kê đúng: 2.23.0, 1590 MB) |
| `uninstaller.jar` | `Uninstaller\go-cai-dat.ps1` — xoá thư mục cài + entry + shortcut |
| Shortcut Start Menu | `Start Menu\Programs\STMicroelectronics\` — 2 shortcut, trỏ đúng file có thật |
| Không ai biết chuyện này | `Uninstaller\DOC-TRUOC-KHI-GO.txt` |

`go-cai-dat.ps1` từ chối chạy nếu không thấy ba file dấu vân tay của bản cài thật — **đã thử cho nó thất bại**: chạy ở thư mục giả thì nó `exit 1` và không xoá gì, kể cả khi truyền `-Force` (`-Force` chỉ bỏ câu hỏi xác nhận, không bỏ rào an toàn). File gốc `unscript.bat` và `unins_clear.vbs` của ST giữ nguyên, không sửa — nhưng **đừng chạy chúng**, chúng gọi `uninstaller.jar` chưa bao giờ được tạo.

Muốn bản cài chuẩn 100% của ST thì gỡ bằng script trên rồi cài lại có UAC và **tự bấm 9 bước** — bảng chín bước ở `plans/phase-00-cai-cong-cu-pc.md` §00.4.

**Ổ đĩa sau khi xong:** C: còn 30,44 GB, D: còn 127,68 GB. Trên C: còn ~550 MB rác tự giải nén của installer ở `%TEMP%\7zS8555FEEE` và `%TEMP%\7zS869F7A49` — xoá được, chưa xoá.

## Phase 01 — Tái cấu trúc repo, uv, Vite, mosquitto, CI

Plan: plans/phase-01-tai-cau-truc-repo.md

Ngày bắt đầu: 21/09/2026 · Ngày xong: 21/09/2026

- [x] `uv run pytest` in `35 passed`, không `failed`, không `error`.
- [x] `uv run ruff check .` in `All checks passed!`.
- [x] `pnpm build` trong `frontend/` sinh `frontend/dist/index.html`; chạy `uv run uvicorn backend.app:app --port 8000` rồi `curl http://127.0.0.1:8000/` trả HTTP 200 kèm bundle React (`/assets/index-*.js`), không 404.
- [x] `git check-ignore -q firmware/ardupilot/build-d450a747/build.log` trả exit code **1** (**`-q`, không phải `-v`** — xem Ghi chú), và `git log --stat -1` chứng minh file đã vào commit.
- [x] `git check-ignore -q firmware/ardupilot/build-d450a747/arducopter_with_bl.hex` trả exit code **0** (đang bị ignore, đúng ý).
- [x] `git log --follow --oneline firmware/ardupilot/params/README.md` hiện lịch sử có từ trước khi đổi chỗ (chứng minh đã `git mv`).
- [x] `(Get-ChildItem docs\so-tay\*.md).Count` in `29`.
- [x] `README.md` mới ≤ 60 dòng; `docs/archive/plan-nhap-92-giai-doan.md` và `docs/archive/so-tay-lap-f450.html` tồn tại.
- [x] Ba file `requirements*.txt` đã xoá; `pyproject.toml` (gốc) có khối `[project]` **không có** `[project.optional-dependencies] ml`; `ml/pyproject.toml` tồn tại, là dự án `uv` riêng, **không có** `torch`; `.python-version` chứa `3.13`.
- [x] `docker compose ps` hiện `iotcv-mosquitto` đang `running`.
- [x] CI trên GitHub xanh cả 3 job (`lint`, `test`, `frontend`) — PR #26, run 35583397426. SonarCloud cũng xanh (quality gate `OK`, `new_security_rating` = 1).
- [x] `plans/PROGRESS.md` mục Phase 01 đã tick, ghi số phiên bản npm thực tế, và đã commit.

Ghi chú:

**Phiên bản npm THỰC TẾ cài ngày 21/09/2026** (từ `pnpm list --depth 0`, không phải số khai báo trong `package.json`): react 19.3.0 · react-dom 19.3.0 · vite 8.3.0 · typescript **6.0.3** · tailwindcss 4.3.3 · @tailwindcss/vite 4.3.3 · @vitejs/plugin-react 6.1.1 · zustand 5.0.15 · leaflet 1.9.4 · react-leaflet 5.0.0 · oxlint 1.83.0 · shadcn 4.21.0 (preset `radix-nova`, baseColor `neutral`).

Plan §01.7(b) gắn cờ "chưa xác minh" cho hai số `vite 8.3.0` và `typescript 5.103.1`. Kết quả: **`vite 8.3.0` đúng**, **`typescript 5.103.1` sai** — bản thật là 6.0.3. Cờ đặt đúng chỗ, chỉ là một trong hai số trúng.

**Bài học thứ sáu về báo xanh giả — `git check-ignore -v` không phân biệt được hai kết quả ngược nhau.** Cổng pass số 4 và 5 ban đầu viết đo bằng `-v`. `-v` trả exit **0** khi khớp *bất kỳ* luật nào, **kể cả luật phủ định `!`** — nên `build.log` (đúng ý là KHÔNG bị ignore) cũng trả 0, in ra `.gitignore:105:!firmware/ardupilot/**/build.log`, trông y hệt `arducopter_with_bl.hex` (đúng ý là BỊ ignore, cũng trả 0). Một cổng cho cùng exit code ở cả hai đầu thì không canh được gì. Đã sửa cả plan lẫn hai dòng trên sang `-q`, và xác nhận bằng bằng chứng mạnh hơn: `git add firmware/ardupilot/build-d450a747/` chỉ stage đúng 3 file nhẹ (`build.log`, `custombuild.yaml`, `extra_hwdef.dat`), 4 file nhị phân bị chặn.

**Sàn phiên bản Python lấy bản CAO giữa hai nguồn, không chép số trong plan.** Plan §01.6 ghi `numpy>=1.26` / `websockets>=13.0` / `pytest>=8.3` / `ruff>=0.7`, nhưng `requirements*.txt` đã được dependabot (PR #21) nâng lên `2.5.3` / `17.1` / `9.1.1` / `0.16.8`. Chép nguyên plan sẽ hạ sàn xuống dưới bản CI từng kiểm — đó là hồi quy, không phải dọn dẹp. `ml/pyproject.toml` xử lý tương tự (`opencv-python>=4.14.0.94,<5`, `pandas>=3.0.6`, `matplotlib>=3.11.2`).

**Plan nói `uv run pytest` in `4 passed` — sai.** `backend/tests/` có **4 file** nhưng **35 test**. Đã sửa trong plan. Khi `frontend/dist` chưa build thì ra `34 passed, 1 skipped`, cũng là xanh (đã kiểm chứng bằng cách tạm đổi tên `dist` rồi chạy lại, chứ không chỉ tin vào `skipif`).

**Template Vite đã đổi eslint → oxlint.** `pnpm create vite --template react-ts` sinh sẵn `"lint": "oxlint"` và `.oxlintrc.json`, không có `eslint.config.js`. Fallback #2 trong plan §01.9 (bảo thêm `"lint": "eslint ."`) không cần dùng. `pnpm lint` thoát 0, còn một warning `react(only-export-components)` trong `src/components/ui/button.tsx` do shadcn sinh ra, không phải code của mình.

**shadcn init cần cờ khác plan.** `-b` trong bản hiện tại là *base library* (`radix`/`base`/`aria`), không phải base-color; và nó bắt buộc có `-p <preset>`. Lệnh chạy được: `pnpm dlx shadcn@latest init -y -b radix -t vite -p nova --no-monorepo --css-variables`.

**TypeScript 6 bỏ `baseUrl`.** Hướng dẫn shadcn cho Vite bảo thêm `baseUrl` + `paths` vào `tsconfig`, nhưng TS 6.0.3 báo `error TS5101: Option 'baseUrl' is deprecated` và `tsc -b` chết. Với `moduleResolution: bundler`, `paths` tự giải tương đối theo file tsconfig — bỏ hẳn `baseUrl` là đủ, alias `@/*` vẫn chạy (đã build xanh).

**Đã vá một lỗi tiềm ẩn ngoài phạm vi plan:** `docs/huong-dan-bat-dau-tu-con-so-0.md` §5 bảo người đọc chạy backend trong WSL bằng venv riêng tên `.venv-linux`. Chuyển sang `uv sync` mà không đổi gì thì `uv` dùng đúng thư mục `.venv` — tức là **đè lên venv Windows đang nằm cùng chỗ** (`/mnt/d/` và `D:\` là một thư mục). Đã thêm `export UV_PROJECT_ENVIRONMENT=.venv-linux` vào khối lệnh đó, và thêm luật `.venv-*/` vào `.gitignore` (trước đây `.venv-linux` không hề bị ignore, dù guide bảo tạo nó).

**Hai chỗ còn trỏ đường dẫn cũ, CỐ Ý không sửa** vì nằm trong danh sách "Không đụng" của plan §"File và thư mục sở hữu": `CONTRIBUTING.md` (dòng 30 và 71 nhắc `params/`, nay là `firmware/ardupilot/params/`) và `scripts/github/bootstrap_github.py` (dòng 50, mô tả nhãn `type/param` nhắc `params/`). Cả hai chỉ là chữ mô tả, không phải đường dẫn code chạy được. `docs/bao-cao-tong-quan-du-an.md` (dòng ~369) cũng còn cây thư mục cũ với `esp32/` — đó là văn bản báo cáo chụp lại thiết kế cũ, trong đó nhiều file còn chưa tồn tại, nên không sửa. Ai làm phase sau dọn thì dọn một lượt.

**Plan §01.9 khẳng định sai về phiên bản action — vòng CI đầu đỏ cả 3 job.** Plan ghi bốn action đã "kiểm chứng ngày 21/09/2026", nhưng `astral-sh/setup-uv@v10` **không phân giải được**: repo đó *có* release `v10.1.0`, nhưng **chỉ duy trì tag trôi tới `v7`** (`refs/tags/v1`…`v7`), nên `@v10` là một ref không tồn tại. Đã ghim `@v10.1.0` (tag release chính xác). Ba action còn lại — `actions/checkout@v7`, `actions/setup-node@v7`, `pnpm/action-setup@v4` — đều có thật, đã xác nhận từng cái bằng `gh api repos/<repo>/git/ref/tags/<tag>` **trước khi** đẩy lại.

**Plan thiếu một tham số bắt buộc của `pnpm/action-setup`.** Action này không tự đoán được bản pnpm; nó đọc khoá `packageManager` trong `package.json`, mà mặc định tìm file đó ở **gốc repo** — ở đây `package.json` nằm trong `frontend/`. Đã thêm `"packageManager": "pnpm@11.10.0"` vào `frontend/package.json` và `package_json_file: frontend/package.json` vào bước setup. Kiểm lại tại chỗ bằng đúng lệnh CI sẽ chạy (`pnpm install --frozen-lockfile` → exit 0, lockfile không bị `packageManager` làm lệch).

**SonarCloud đỏ ở vòng hai dù 3 job CI đã xanh — việc ngoài phạm vi plan, đã xử.** Plan không nhắc tới SonarCloud, và nó cũng không chặn merge (`mergeable=MERGEABLE`), nhưng nó xanh ở cả bốn PR trước (#10, #21, #24, #25) và đỏ ở PR này, nên đúng là Phase 01 gây ra. Chỉ một điều kiện hỏng: `new_security_rating` = 3, ngưỡng 1. Trong 13 issue thì 11 cái MAJOR nằm ở chính `ci.yml` vừa viết (action ghim bằng tag chứ không phải SHA; `uv sync` thiếu `--locked`/`--no-build`), 2 cái MINOR nằm ở `docs/archive/frontend-vanilla/index.html` — file JS cũ không sửa một dòng nào, chỉ vì `git mv` đổi đường dẫn nên Sonar tính là "code mới" của PR.

Mất 4 vòng CI mới xanh, và đường đi đáng ghi vì hai chỗ dễ đoán sai:

| Vòng | Vulnerabilities | Đã làm |
|---|---|---|
| 2 | 13 | — |
| 3 | 8 | ghim full commit SHA · `uv sync --locked --no-build` |
| 4 | 2 | `uv run --no-sync` · thêm `.sonarcloud.properties` |
| 5 | **0** | `uv run --no-build` |

**Tên file cấu hình Sonar: `.sonarcloud.properties`, KHÔNG phải `sonar-project.properties`.** Vòng 3 đã có `sonar-project.properties` với đúng khối `sonar.exclusions` mà hai issue trong `docs/archive/frontend-vanilla/index.html` **vẫn còn nguyên**. Vòng 4 thêm `.sonarcloud.properties` cùng nội dung thì chúng biến mất. Automatic Analysis (không có job Sonar trong `ci.yml`) đọc tên thứ hai. Giữ cả hai file để ai chuyển sang CI-based analysis sau này không phải mò lại.

**`uv run` cũng giải phụ thuộc, không chỉ `uv sync`.** Đặt `--locked --no-build` ở mỗi `uv sync` là bịt nửa cửa: bước `uv run ruff check .` ngay sau đó vẫn tự giải lại. Phải là `uv run --no-sync --no-build`. `--no-sync` dọn `S8544` (khoá phiên bản) nhưng **không** dọn `S8541` (`--no-build`) — hai rule độc lập, phải thêm cả hai cờ.

Đáng ghi lại: **sửa riêng 11 cái MAJOR sẽ không đủ.** Security rating lấy theo issue nặng nhất, nên bỏ hết MAJOR thì 2 cái MINOR vẫn kéo rating xuống 2 — vẫn trên ngưỡng 1, vẫn đỏ. Phải làm cả hai vế. Cách đã dùng: ghim cả bốn action theo full commit SHA (lấy bằng `gh api repos/<repo>/git/ref/tags/<tag>`, không đoán), thêm `--locked --no-build` vào `uv sync`, và tạo `sonar-project.properties` loại `docs/archive/**` + `legacy-sketch/**` + `build-d450a747/**` khỏi phân tích. `--locked` không phải để chiều linter: nó bắt `uv.lock` lệch `pyproject.toml` và fail, là một cổng thật mà trước đó không có.

**Ước lượng 6,0 giờ của plan là cho người làm tay.** Phiên này chạy tự động hết khoảng 25 phút, phần lớn thời gian nằm ở `pnpm dlx shadcn init` (tải 310 gói) và ba vòng thử cờ shadcn.

## Phase 02 — WSL2 + build ArduPilot + SITL

Plan: plans/phase-02-wsl2-sitl.md

Ngày bắt đầu: 21/09/2026 · Ngày xong: 21/09/2026

- [x] `.wslconfig` có `networkingMode=mirrored` (hoặc ghi rõ đã chọn đường NAT).
- [x] `du -sh ~/ardupilot` **2,0 GB** (cổng cũ ghi 6–8 GB là **sai**, xem Ghi chú); HEAD tại tag `Copter-4.7.1`.
- [x] `mavproxy.py --version` trong WSL chạy.
- [x] `./scripts/run_sitl.sh` mở đủ **ba** cửa sổ (MAVProxy, Console, Map).
- [x] `mode guided` → `arm throttle` → `takeoff 40` → `mode rtl` chạy trọn, kết thúc DISARM.
- [x] Mission Planner nối vào SITL: HUD sống, ghi `ArduCopter V4.7.1`, Alt đổi theo lệnh MAVProxy.
- [x] `scripts/run_sitl.sh` đã sửa và commit; mục `sitl:` trong `Makefile` trỏ đúng.
- [x] Đã ghi **thời gian build thực tế + dung lượng thực tế** vào Ghi chú.

Ghi chú:

**Số đo thật trên máy này (21/09/2026), thay cho ước lượng ở đầu plan.**

| Hạng mục | Đo được | Plan ước lượng |
|---|---|---|
| Clone (thẳng tại tag, kèm submodule) | **241 s** · 1,9 GB | 10–20 phút · 2,5–3,5 GB |
| `install-prereqs-ubuntu.sh -y` | **~12 phút** · **3,08 GB** | 20–40 phút · 2,5–3,5 GB |
| Build SITL (`waf`, 32 core) | **158 s** · **+110 MB** | 10–25 phút · 1–1,5 GB |
| **Tổng thời gian máy** | **≈ 18,6 phút** | 40–85 phút |
| **Tổng đĩa** | **≈ 5,2 GB** | 6–8 GB |
| `du -sh ~/ardupilot` cuối | **2,0 GB** | — |

Máy: Ubuntu 24.04.4, 32 core, 19 GB RAM, ổ WSL `/dev/sdd` còn 915 GB.

**Cổng pass số 2 của plan sai, đã sửa trong plan.** Nó đòi `du -sh ~/ardupilot` ra 6–8 GB, nhưng 6–8 GB là *tổng chi phí đĩa*, mà toolchain ARM đi vào `/opt` và venv đi vào `~/venv-ardupilot` — không cái nào nằm trong `~/ardupilot`. Chỉ `build/sitl` rơi vào đó, và nó chỉ 110 MB. Cổng cũ **đỏ kể cả khi cài hoàn toàn đúng**: cùng loại "báo đỏ giả" với năm cái đã sửa ở Phase 00. Nay tách làm hai số đo riêng.

**Đã chọn đường mirrored** (không phải NAT), nên `WSL_MIRRORED=1` và `run_sitl.sh` luôn thêm `--no-wsl2-network`. Kiểm chứng không bằng mắt mà bằng giao tập IP: trong WSL thấy `192.168.1.10` và `26.18.240.157` — đúng IP của Windows, không phải `172.x` của NAT.

**Bốn chuyện đã sập, ghi lại để Phase sau khỏi mất giờ.**

1. **`install-prereqs` tạo venv bằng `python3` đứng đầu PATH — trên máy này là `miniforge3`/Python 3.13.12, không phải Python 3.12.3 của Ubuntu.** Gói `python3-pexpect` cài qua apt nằm trong `dist-packages` của 3.12 nên venv 3.13 không thấy, và `./waf copter` chết ở bước embed với đúng một dòng `you need to install pexpect`. Sửa: `~/venv-ardupilot/bin/pip install pexpect`. Các gói khác (`wx`, `matplotlib`, `numpy`, `cv2`, `lxml`) vẫn import được vì miniforge có sẵn — chỉ thiếu đúng một gói, đừng suy rộng ra.
2. **`localhost:5760` KHÔNG nối được, `127.0.0.1:5760` thì được.** Trên Windows `localhost` phân giải ra `::1` (IPv6) trước, mà SITL chỉ bind IPv4. Trong Mission Planner phải gõ `127.0.0.1`. Gõ nhầm thì triệu chứng giống hệt bị firewall chặn.
3. **`sudo` trong WSL hỏi mật khẩu, timestamp mặc định 15 phút mà script chạy ~12–40 phút** → nó hỏi lại giữa chừng và **đứng chờ im lặng**. Chạy `sudo -v` rồi một vòng `while true; do sudo -n true; sleep 60; done &` giữ phiên, kill sau khi xong.
4. **Gọi lệnh bash phức tạp qua `wsl.exe -- bash -lc '...'` từ Git Bash bị nuốt ký tự** (`$4`, `$?`, `[`, `$p` của sed). Ghi lệnh ra file script rồi `bash /tmp/x.sh` thì hết. Thêm `MSYS_NO_PATHCONV=1` để Git Bash không đổi `/tmp/x.sh` thành đường dẫn Windows.

**Việc 02.4 của plan gần như thừa, đã sửa trong plan.** `PYTHON_PKGS` dòng 197 của `install-prereqs-ubuntu.sh` đã gồm `MAVProxy` + `pymavlink`; `SITL_PKGS` đã gồm `python3-wxgtk4.0`, `matplotlib`, `opencv`, `yaml` và bộ SDL cho pygame. Chạy thêm `pip install mavproxy --user` như plan cũ ghi sẽ đặt **bản thứ hai ngoài venv** rồi hai bản tranh PATH. Đo được: `mavproxy.py --version` = **1.8.74**, `pymavlink` 2.4.49.

**Bằng chứng cho từng cổng, không phải nhìn bằng mắt.**

- Ba cửa sổ: `cua-driver list_windows` thấy `Map (Ubuntu)` 852×749, `Console (Ubuntu)` 800×300, `ArduCopter (Ubuntu)` 880×581 — cả ba `is_on_screen: true`.
- Chuyến bay 40 m: dấu nhắc MAVProxy đi `STABILIZE>` → `GUIDED>` → `RTL>`; STATUSTEXT có `Arming motors` rồi `Disarming`; `relative_alt` lớn nhất trong `GLOBAL_POSITION_INT` = **40 000 mm đúng bằng 40,0 m**, nhỏ nhất −14 mm (chạm đất); HEARTBEAT cuối `base_mode: 81` — **thiếu bit 128 `SAFETY_ARMED`** — `system_status: 3` (STANDBY), `custom_mode: 6` (RTL). Ba nguồn độc lập cùng nói đã disarm.
- Mission Planner: tiêu đề cửa sổ ghi `ArduCopter V4.7.1 (dbe79216)` — `dbe79216` đúng tiền tố SHA của tag `Copter-4.7.1`, chuỗi này chỉ có được qua trao đổi MAVLink thật. Link hiện `UDP14550-1-QUADROTOR`, nút là `DISCONNECT`. Gõ `takeoff 20` trong MAVProxy: `Altitude (m)` trên Mission Planner đi từ `0.00` → **`20.00`**, chữ giữa HUD từ `DISARMED` → `Guided`, pin từ `0.0 A` → `28.1 A`.
- **Không cần đụng firewall.** Mission Planner tự nối UDP `14550` ngay lần chạy đầu, Windows Defender không hỏi gì. Rủi ro số 1 của plan (điểm 12) **không xảy ra** trên máy này — nhưng vẫn giữ cảnh báo trong plan vì nó phụ thuộc cấu hình từng máy.

**ArduCopter 4.7.1 phát STATUSTEXT là `Arming motors` / `Disarming`, không phải `ARMED` / `DISARMED`.** Cổng pass cũ bắt đúng chữ `DISARMED` nên grep theo nó sẽ trượt; đã sửa trong plan.

**Việc chưa làm, cố ý:** `docs/so-tay/02-wsl2-sitl.md` vẫn là placeholder. Plan ghi ở mục "File và thư mục sở hữu" là *"để agent viết sổ tay điền sau"*, và nó không nằm trong danh sách cổng pass.

## Phase 03 — Học ArduPilot trên drone ảo

Plan: plans/phase-03-hoc-ardupilot-drone-ao.md

Ngày bắt đầu: 21/09/2026 · Ngày xong: ______ *(còn 3 cổng của người học)*

- [x] Bay trọn `GUIDED` → `LOITER` → `ALT_HOLD` → `RTL` → `DISARMED`, không crash.
      *(`run_mode_chain.py`: 7/7 mode, hai chuyến, không crash, RTL về home 0,0 m. Từ 25/09/2026
      runner còn **bay tay thật** ở LOITER — hình vuông 4 chặng 15,2–15,4 m bằng RC override — và
      giữ ALT_HOLD với ga ở giữa, lệch 0,3 m. Trước đó phần bay tay chưa từng chạy, xem Ghi chú.)*
- [x] Chạy được mission 5 waypoint (`TAKEOFF` → 3 `WAYPOINT` → `RTL`) ở `AUTO`; `wp list` khớp Mission Planner.
      *(`run_mission_auto.py`: tới đủ waypoint [1,2,3,4,5], đọc lại khớp từng trường. 25/09/2026:
      Mission Planner nối vào cùng SITL, `PLAN → Read`, bảng 5 lệnh khớp **từng trường** (lệnh, lat,
      lon, alt, frame) với mission đọc ngược từ FC — ảnh `docs/so-tay/anh/03-mp-wp-list.png`, sổ tay
      03 mục 11. Hướng kiểm là script nạp → MP đọc; tự vẽ mission trong MP vẫn là bài tập 03.6.)*
- [ ] Có **3 dòng `PreArm:` khác nhau** chép nguyên văn vào sổ tay, mỗi dòng kèm giải thích tự viết.
- [x] Mở được log `.BIN` trên UAV Log Viewer; chỉ ra đồ thị độ cao **và** các lần đổi mode.
      *(25/09/2026: log của `run_mode_chain.py` mở trên plot.ardupilot.org, đồ thị `CTUN.Alt`
      (max 20,03 m) phủ 8 dải mode có nhãn GUIDED → ALT_HOLD → LOITER → GUIDED → AUTO → LAND →
      GUIDED → RTL — ảnh `docs/so-tay/anh/03-log-viewer.png`. `run_log_dump.py` rút cùng dữ liệu
      ra CSV và từ nay FAIL nếu log không có lần đổi mode nào.)*
- [ ] 9 dòng checklist bài tập ở việc 03.6 tick hết.
- [ ] Viết được câu trả lời tự luận "GUIDED khác AUTO ở chỗ nào" **trước khi** đọc đáp án.
- [x] `logs/sitl/.gitkeep` đã commit; không file `.BIN` nào lọt vào git.
      *(Kiểm hai chiều: `git ls-files logs/sitl/` ra đúng `.gitkeep`; `git ls-files | grep .BIN` rỗng;
      CSV vừa sinh bị `logs/sitl/*` chặn đúng như thiết kế.)*

Ghi chú:

**25/09/2026 — rà soát lại toàn bộ Phase 03 + 04, chạy lại trọn bộ runner.** Ba cổng còn trống
(`PreArm:` tự giải thích, checklist 03.6, câu trả lời GUIDED/AUTO) là **bài của người học**, cố ý
không tick hộ. Hai lỗi đã sửa trong runner Phase 03, cả hai cùng kiểu "báo xanh không chứng minh":
(1) `run_mode_chain.py` in "KHÔNG TỚI ĐƯỢC" khi AUTO không tới waypoint mà vẫn PASS → nay FAIL;
(2) `run_log_dump.py` PASS với log 0 lần đổi mode và tự lấy `.BIN` mới nhất của bất kỳ runner nào
(thường là log Phase 04) → nay ưu tiên log `run_mode_chain` và FAIL nếu không có lần đổi mode.
Cổng "LOITER bay tay" trước đây được tick trong khi hàm bay tay `square_via_rc()` chưa từng chạy
được (harness nối sysid 250, ArduPilot bỏ qua RC override) — nay runner bay tay thật và kiểm quãng.
Chạy lại cả bộ bằng `bash scripts/sitl/run-all.sh`: 7/7 PASS trong ~5,5 phút.

**21/09/2026 — phạm vi Phase 03 đã đổi, chủ dự án quyết.** Plan gốc bắt tự bay hết
~6 giờ. Nay cắt đôi: phần cơ học lặp lại do script chạy, người học giữ đúng ba việc
mà Phase 19–20 sẽ cần tới khi cầm drone thật.

- **Người học tự làm (~1,5 h):** gây và sửa 3 lỗi pre-arm; một lần bay tay
  GUIDED → LOITER → ALT_HOLD → RTL; tự viết câu trả lời GUIDED-khác-AUTO **trước**
  khi đọc đáp án. Hướng dẫn từng bước: `docs/huong-dan/phase-03-viec-cua-ban.html`.
- **Script tự động (~4,5 h) — ĐÃ LÀM, 22/09/2026:** `scripts/sitl/` gồm 5 runner
  đứng trên `harness.py`. Xem `scripts/sitl/README.md`.

**22/09/2026 — `harness.py` chạy thật lần đầu.** Commit gốc tự ghi "CHUA CHAY THAT
LAN NAO", và quả thật lần chạy đầu hỏng ngay ở bước khởi động. Bốn lỗi trong
harness, tất cả đều **im lặng** — làm sai thì hỏng mà thông báo lỗi không chỉ vào
nguyên nhân:

1. **Thiếu `--no-rebuild`.** `sim_vehicle.py` đi build lại, và build hỏng: nó chạy
   bằng python venv nhưng gọi waf qua shebang `#!/usr/bin/env python3` → rơi về
   python **hệ thống** không có `empy`. Tệ hơn, nó chạy `configure` *trước* khi
   build hỏng, tức một lần chạy thử cũng đủ động vào cấu hình build đang tốt.
2. **Thiếu hàm chờ EKF sẵn sàng.** `set_mode("GUIDED")` ngay sau khi nối thì
   *thành công*, rồi vài giây sau EKF chưa có lời giải nên ArduPilot tự rơi về
   `STABILIZE`. Hỏng chỉ lộ ra mãi sau, ở `takeoff`, dưới dạng một chữ
   `MAV_RESULT_FAILED` trơ trọi.
3. **`set_param` không chịu nổi cơn lũ tham số.** SITL khởi động với `-w` đổ toàn
   bộ ~1370 tham số; vòng chờ chỉ lọc theo kiểu message nên vớ phải gói đầu tiên
   trong cơn lũ. Triệu chứng đánh lừa: xin đọc `RTL_ALT` mà nhận về
   `BARO1_GND_PRESS`.
4. **`takeoff` không kiểm mode.** ArduPilot từ chối `NAV_TAKEOFF` ngoài
   GUIDED/AUTO bằng đúng một chữ `MAV_RESULT_FAILED`.

**Bốn chỗ tài liệu/plan sai, SITL chứng minh** (đã sửa vào plan 03 và sổ tay 03
mục 10, kèm bằng chứng):

| Chỗ sai | Sự thật đo được trên ArduCopter 4.7.1 |
|---|---|
| Plan §03.2, §03.5: `RTL_ALT`, đơn vị cm, đặt 1500/5000 | `RTL_ALT` **không còn tồn tại**. Liệt kê cả 1370 tham số: nhóm RTL* chỉ còn `RTL_ALT_M` (đơn vị **mét**), `RTL_ALT_FINAL_M`, `RTL_CLIMB_MIN_M`, `RTL_SPEED_MS`. ArduPilot 4.7 chuyển sang hậu tố đơn vị SI. Đặt tên cũ thì FC **không báo lỗi**, chỉ không bao giờ xác nhận |
| Plan §03.3 dòng 141: sau `mode rtl`, mode tự chuyển sang `LAND` rồi `DISARMED` | Mode **vẫn là `RTL`** suốt lúc hạ cho tới khi disarm. RTL tự hạ trong chính nó. Chờ `LAND` là chờ mãi — đã treo trọn 180 s đúng chỗ này |
| Quy ước mission | **Item 0 là ô HOME**, không phải lệnh. Đặt `NAV_TAKEOFF` ở index 0 thì vào AUTO từ dưới đất bị từ chối: `Auto: Missing Takeoff Cmd`. Mission "5 waypoint" nạp xuống **6 item**. Khó tìm vì lỗi **chỉ** xảy ra khi vào AUTO từ mặt đất |
| Khởi động mission AUTO | `MAV_CMD_MISSION_START` trả `MAV_RESULT_DENIED`; arm thẳng trong AUTO bị `MAV_RESULT_FAILED`; máy bay tự disarm sau `DISARM_DELAY = 10` s. Cách đúng là tham số **`AUTO_OPTIONS = 3`** (bit 0 cho arm trong AUTO, bit 1 cho cất cánh không cần nâng ga). ⚠️ **Chỉ dùng trên SITL.** Trên phần cứng thật, bit 1 nghĩa là máy bay tự nhấc lên mà không ai chạm cần ga — đọc `SAFETY.md` trước |

**Kết quả 5 runner, chạy thật trên SITL ArduCopter 4.7.1:**

| Runner | Kết quả |
|---|---|
| `run_mode_chain.py` | **PASS** — 7/7 mode; RTL về home **0,0 m** |
| `run_rtl_alt.py` | **PASS** — đỉnh **20,0 m** (`RTL_ALT_M=15`) vs **50,0 m** (`=50`), chênh **30,0 m** |
| `run_mission_auto.py` | **PASS** — nạp 6 item (5 lệnh + home), đọc lại **khớp từng trường**, tới đủ waypoint **[1,2,3,4,5]**, đỉnh **25,0 m**, RTL về **0,0 m** |
| `run_mission_low_alt.py` | **PASS** — FC nhận và bay waypoint 3 m, xuống tới **3,2 m** |
| `run_log_dump.py` | **PASS** — rút **1218 mẫu** `CTUN` + các lần đổi mode ra CSV |

**Kết luận cho Phase 07 (từ `run_mission_low_alt.py`):** flight controller **nhận
và bay** waypoint ở 3 m, không hề chặn. Nó **không kiểm hộ độ cao tối thiểu**, nên
`validate_mission()` ở backend là **bắt buộc**, không phải thừa. `MIN_ALT` của dự
án là 2 m — thấp hơn nữa phải chặn ở backend.

> **Một phép đo hỏng đã tự bắt được.** Bản đầu lấy mẫu độ cao suốt cả mission, kể
> cả đoạn RTL hạ cánh cuối, nên đáy luôn ra ~0 m **bất kể** FC có bay xuống
> waypoint thấp hay không — con số đó không phân biệt được hai khả năng mà nó sinh
> ra để phân biệt. Đã thu hẹp cửa sổ lấy mẫu về đúng chặng waypoint 2→4, và thêm
> cận dưới 0,5 m để nếu đáy vẫn ~0 thì runner **từ chối kết luận** thay vì báo bừa.

**Số đo của bài tập §03.5** (chạy `scripts/sitl/run_rtl_alt.py`): cất cánh 20 m rồi
RTL — `RTL_ALT_M = 15` cho đỉnh **20,0 m** (không leo, vì đang cao hơn ngưỡng);
`RTL_ALT_M = 50` cho đỉnh **50,0 m**. Chênh **30,0 m**. Kết luận cho sổ tay:
`RTL_ALT_M` là độ cao **tối thiểu**, không phải bắt buộc.

**22/09/2026, vòng hai — hai lỗi nữa trong `harness.py`, cùng loại im lặng.**
Tìm ra khi chạy lại nghiệm thu độc lập; cả hai đều để lộ qua 28 dòng usage của
`pkill` lẫn trong output của một lần chạy PASS.

1. **Toàn bộ đoạn dọn dẹp có chủ đích là code chết.** Mẫu tìm là
   `--use-dir=<đường dẫn>`, bắt đầu bằng `--`, nên `pkill`/`pgrep` coi nó là
   **tuỳ chọn** chứ không phải mẫu: `pkill: unrecognized option '--use-dir=...'`
   rồi in usage. Ba lời gọi đều vô hiệu. Nó sống sót chỉ nhờ `terminate()` và
   mẫu `xterm.*` đứng cạnh. Sửa: bỏ hai gạch đầu, khớp `use-dir=<đường dẫn>`.
2. **`refuse_if_conflict()` báo nhầm, và không thể báo đúng khi hỏng.** `pgrep -af`
   khớp cả shell đang gọi nếu dòng lệnh của nó có chứa chuỗi `sim_vehicle.py` —
   đã chặn oan một lần chạy hợp lệ. Thêm `-A` (`--ignore-ancestors`). Đồng thời
   hàm cũ nuốt luôn mã thoát: `pgrep` tự hỏng thì `stdout` rỗng, guard lặng lẽ
   cho qua y như khi máy sạch. Nay mã thoát ≥ 2 thì **ném lỗi**. Đã bẻ gãy có
   chủ đích (stub `pgrep` exit 2) để xem nó đỏ thật, rồi bỏ stub xem nó xanh lại.

**Bản sửa `RTL_ALT` → `RTL_ALT_M` lan chưa hết, rò sang Phase 20.** Vòng một chỉ
sửa plan 03 và sổ tay 03. Còn sót 15 chỗ, nặng nhất là `phase-20` dòng 372: bảo
đặt `RTL_ALT 1500` trên **drone thật**, kèm chú thích "phải cao hơn mọi vật cản".
Firmware dự án là ArduCopter 4.7.1 (`build-d450a747/custombuild.yaml`), đúng bản
đã chứng minh tham số đó không tồn tại. Đặt nó thì FC im lặng bỏ qua, người vận
hành tin RTL đã vượt vật cản trong khi chưa đặt được gì. Đã sửa hết và thêm cảnh
báo "đọc ngược lại giá trị để xác nhận" vào cổng pass Phase 20.

**Sửa `.gitignore` (bắt buộc, không phải tuỳ chọn):** cổng pass đòi commit
`logs/sitl/.gitkeep` nhưng luật `logs/*` ở dòng 58 chặn luôn cả thư mục con, nên gate
đó vốn KHÔNG thể đạt. Đã thêm ba dòng `!logs/sitl/` + `logs/sitl/*` + `!logs/sitl/.gitkeep`.
Đã kiểm chứng hai chiều: `.gitkeep` commit được, file `.BIN` vẫn bị `*.bin` chặn.

**Lệch với plan, cố ý:** plan dòng 35 ghi "Không đụng `scripts/`" vì plan gốc giả định
phase này không code gì. Phạm vi đổi thì lệnh cấm đó hết đúng; script đặt ở
`scripts/sitl/`, không sửa `scripts/run_sitl.sh`.

**Chưa tick ô nào.** Mọi cổng pass đều cần bằng chứng thật, chưa có thì để trống.

## Phase 04 — Param + tránh vật cản ảo

Plan: plans/phase-04-param-va-tranh-vat-can-ao.md

Ngày bắt đầu: 25/09/2026 · Ngày xong: 25/09/2026

- [x] `firmware/ardupilot/params/sitl/` có đủ 3 snapshot (`00-sitl-default`, `01-sitl-base-loaded`, `02-sitl-avoid`), đã commit.
      *(`00` = 1370 param gốc; `02` = file avoid dự án + TFmini ảo, cấu hình đã thấy phanh.)*
- [x] `params/sitl/README.md` có bảng "SITL nhận / từ chối" đủ **9 dòng**, quan sát thật; mục "Param SITL từ chối" liệt kê hoặc ghi rõ "không có".
      *(Cả 9 dòng "nhận". Từ chối: `SERVO_BLH_POLES`, `SERVO_BLH_TRATE`, `AVOID_ANG_MAX`. Kiểm đủ 51/51 dòng của hai file.)*
- [x] Nạp được bộ param nền; có ảnh chụp cửa sổ so sánh (hoặc log `param load`).
      *(Log `run_param_load.py` trong sổ tay 04 mục 10.)*
- [x] **TFmini Plus ảo** đọc số đổi theo khoảng cách tới vật cản. *(Đổi từ "`graph RANGEFINDER.distance` đổi theo độ cao", xem Ghi chú.)*
      *(133 mẫu trong tầm, lệch trung bình 0,36 m so với khoảng cách tính từ GPS; lần bay 240 s: 934 mẫu, 0,28 m.)*
- [x] **Thấy AVOID phanh máy bay** trước vật cản ảo ở LOITER; có ảnh chụp màn hình.
      *(`run_avoid_brake.py` PASS, có đối chứng `AVOID_ENABLE 0` bay xuyên cột. Ảnh Mission Planner:
      `docs/so-tay/anh/04-mp-avoid-phanh.png`; đồ thị telemetry: `docs/so-tay/anh/04-avoid-phanh.png`.)*
- [x] Ghi được ba giá trị `RNGFND1_TYPE` (`1` / `100` / `20`) và dùng ở đâu. *(Sổ tay 04 mục 5.)*
- [x] Đã ghi dòng kết luận về `PRX_*` vào Ghi chú (Phase 11 và 14 sẽ đọc).

Ghi chú:

**KẾT LUẬN (Phase 11 và 14 đọc dòng này):** SITL **CÓ** nhóm `PRX_*` (`PRX1_TYPE 4` nhận); AVOID
**thử được** trên SITL với TFmini Plus ảo trên SERIAL3 và nguyên file avoid của dự án — đã thấy
phanh, không hoãn sang Phase 22. SITL bật gần như mọi feature nên điều này **không** chứng minh
custom build có `PRX_*`: Phase 14 kiểm theo danh sách ở `firmware/ardupilot/params/sitl/README.md`.

**25/09/2026 — phạm vi đổi, chủ dự án quyết:** dự án chỉ có **một** cảm biến khoảng cách là TFmini
Plus (đã mua). Bỏ bài lidar 360° LD06 và bài rangefinder analog của plan gốc. Thay bằng bộ mô
phỏng `benewake_tfmini` có sẵn trong SITL, nên thử được đúng cấu hình drone thật. Cổng "rangefinder
đổi theo độ cao" viết lại thành "TFmini đổi theo khoảng cách", vì TFmini nhìn thẳng trước, không
nhìn xuống. Bài OA BendyRuler (tuỳ chọn) không làm: `OA_TYPE 0` trên drone thật, và một tia không
đủ dữ liệu cho BendyRuler.

**Phát hiện cho Phase 11 (bản nháp base):** `SERIAL5_BAUD,19` vô tác dụng — ArduPilot ép cứng
115200 cho cổng ESC telemetry, đọc lại sau reboot là 115, cả trên board thật. `SERVO_BLH_*` SITL
không có (chỉ board ChibiOS có). `AVOID_ANG_MAX` không được biên dịch trong 4.7.1 mặc định, tức
tránh vật cản ở AltHold nhiều khả năng không có trên drone thật.

**Phát hiện cho Phase 22 (bay thật):** lao tới 3,8 m/s thì lấn margin ~1 m (dừng ở 1,01–1,12 m thay
vì 2 m); giữ cần thì dao động tới–lùi 1,4–3,2 m, chu kỳ ~4 s, do `AVOID_BACKUP_SPD 0.75`. Ô "Sonar
Range" của Mission Planner **luôn 0** với TFmini nhìn thẳng trước (ArduPilot chỉ gửi gói
`RANGEFINDER` cho rangefinder nhìn xuống) — không phải cảm biến hỏng.

**Bốn lỗi im lặng tìm ra trên đường, đã sửa:** (1) harness nối sysid 250 nên mọi RC override bị
bỏ qua, `square_via_rc()` của Phase 03 chưa từng có tác dụng → 255; (2) harness đọc nhầm HEARTBEAT
của GCS khác thành mode của drone → lọc theo sysid; (3) `run_sitl.sh` hướng dẫn "lặp lại `-A`"
nhưng cờ sau đè cờ trước → biến mới `SITL_DEVICES`; (4) chính runner param-load bản đầu lưu giá
trị sau reboot mà quên so, nên xếp `SERIAL5_BAUD` là "nhận" → đã thêm loại "FC tự đổi sau reboot".
Runner Phase 03 `run_mode_chain.py` chạy lại sau hai bản sửa harness: vẫn PASS 7/7.

**Lệch với plan, cố ý:** plan liệt kê sửa `scripts/run_sitl.sh`; phase này còn sửa
`scripts/sitl/harness.py` + `scripts/sitl/README.md` (hai lỗi harness ở trên) và thêm hai runner
`run_param_load.py`, `run_avoid_brake.py` thay cho gõ tay MAVProxy.

## Phase 05 — Backend MAVLink + telemetry

Plan: plans/phase-05-backend-mavlink-telemetry.md

Ngày bắt đầu: 22/09/2026 · Ngày xong: 22/09/2026

- [x] `uv run python -m backend.mavlink.connection` in `Heartbeat received: yes`, **đồng thời** Mission Planner vẫn nối được SITL ở cổng khác.
- [x] `ws_probe --measure-rate` cho 7.5–8.5 Hz; mọi trường trong bảng `telemetry.data` (trừ nhóm Phase 07) có giá trị thật khi SITL đã có GPS fix.
- [x] Tắt SITL → `connected` về `false` + `event` `link.lost` trong ≤ `LINK_TIMEOUT_S`+1 s, backend không crash. Bật lại → tự nối trong ≤ 10 s và `ATTITUDE` trở lại 10 Hz.
- [x] Gửi `type` lạ → nhận `error` `unknown_type` và **socket vẫn mở**.
- [x] Hai socket cùng xin web control → socket thứ hai nhận `command_denied`.
- [x] `backend/ws-contract.schema.json` tồn tại, chứa đủ mọi `type` trong hợp đồng; đã commit.
- [x] `uv run ruff check .` + `uv run ruff format --check .` sạch; `uv run pytest` xanh toàn bộ (4 file cũ vẫn xanh).
- [x] `app.py` ≤ 80 dòng; `grep -n "ws/telemetry" backend/` không còn kết quả.
- [x] Mọi lời gọi `mav.*_send` trong `backend/` đều đi qua `MavlinkConnection.send()` (kiểm bằng `grep -rn "\.mav\." backend/`).
- [x] Khối Vision trong `backend/config.py` có đủ `YOLO_DEVICE`, `DETECTION_IMGSZ`, `VISION_ENABLED` (5.7); `_env_bool` tồn tại.
- [x] `docs/so-tay/05-backend-mavlink-telemetry.md` đã viết.

### Số đo thật (SITL ArduCopter 4.7.1, 22/09/2026)

Cấu hình: SITL fan-out ba cổng — `SERIAL0 tcp:5760` (driver pymavlink) ·
`SERIAL1 udp:14551` (backend) · `SERIAL2 udp:14550` (Mission Planner 1.3.83).

| # | Bài §5.6 | Kết quả đo |
|---|---|---|
| 1 | Hai GCS song song 5 phút | **2401 frame / 5,0 phút = 8,00 Hz**, 0 lần `connected=false`, 0 event `link.lost`, khoảng lặng dài nhất **141 ms**. Mission Planner giữ nối 14550 suốt, HUD hiện Altitude 15.00 m cùng lúc |
| 2 | Telemetry đủ trường | Mọi trường ngoài nhóm Phase 07 đều có giá trị thật: `gps_fix_type=6`, `satellites=10`, `battery_voltage=12.6`, `yaw=354.3`, `home_lat/lon` có (chứng minh `request_message(242)` chạy), `link_age_ms=8` |
| 3 | Nhịp 7,5–8,5 Hz | **8,00 Hz** (lần đo đầu 7,29 Hz → tìm ra lỗi trôi nhịp, xem dưới) |
| 4 | Mất link | `link.lost` + `connected=false` đúng hạn; backend **không** crash, telemetry vẫn chảy |
| 5 | Nối lại | `link.up` tự phát, telemetry chạy tiếp. `request_streams()` đo trên dây: ATTITUDE **0,0 → 10,0 Hz**; mọi nhịp xin đều khớp (HEARTBEAT 1, SYS_STATUS 2, GPS_RAW_INT 2, GLOBAL_POSITION_INT 5, VFR_HUD 5, BATTERY_STATUS 1) |
| 6 | Sự kiện STATUSTEXT | 31 event; `PreArm: GPS 1: Bad fix` về đúng `source="mavlink"`, `code="statustext"`, `level="error"` |

**Hai lỗi chỉ lộ ra khi chạy thật, không test đơn nào bắt được:**

1. **Nhịp telemetry trôi xuống 7,29 Hz.** Vòng broadcast `sleep(interval)` *sau* khi
   làm việc, nên chu kỳ = việc + 125 ms (đo được 125–142 ms). Sửa thành ngủ tới
   **mốc kế** thay vì ngủ đủ một khoảng → 8,00 Hz chẵn. Đáng chú ý: cổng này chỉ
   phát hiện được sau khi sửa `ws_probe --measure-rate` để nó **trả mã thoát theo
   phán quyết** — trước đó nó in "KHÔNG ĐẠT" rồi vẫn `exit 0`.
2. **Nguồn `ekf_ok` mà plan gợi ý là sai.** Xem mục dưới.

### `ekf_ok` — plan gợi ý sai nguồn, đã đo và sửa

Plan §5.2.2 đánh dấu `ekf_ok` là *chưa xác minh* và gợi ý suy từ bit AHRS trong
`SYS_STATUS.onboard_control_sensors_health`. Chạy đúng thủ tục kiểm chứng §5.2.5
(A/B: tắt GPS → bật lại) cho thấy gợi ý đó **sai**:

```text
GPS tắt (EKF hỏng): health = 0x4771FC2F
GPS bật (EKF khoẻ): health = 0x5771FC2F
XOR                = 0x10000000  -> PREARM_CHECK, KHÔNG phải AHRS
```

Bit AHRS `0x20000000` thậm chí **không có** trong `onboard_control_sensors_present`.
Làm theo plan thì `ekf_ok` luôn `False` và Phase 06 chặn arm nhầm vĩnh viễn — đúng
cái mà ô rủi ro "để `None`, đừng đoán `True`" đã lo, chỉ khác hướng.

Nguồn đúng là `EKF_STATUS_REPORT` (id 193), đo lặp lại được:

```text
khoẻ    flags=0x033F  ATTITUDE VEL_H VEL_V POS_H_REL POS_H_ABS POS_V_ABS ...
hỏng    flags=0x00A7  ATTITUDE VEL_H VEL_V POS_V_ABS CONST_POS_MODE
bật lại flags=0x033F  (về đúng trạng thái cũ)
```

`ekf_ok = ATTITUDE & VELOCITY_HORIZ & POS_HORIZ_ABS & !CONST_POS_MODE`. Đã thêm
193 vào `STREAM_RATES` (2 Hz) — không xin thì FC không gửi và `ekf_ok` ở `None`
mãi mà không có gì báo. Kiểm chứng sống: WebSocket trả `ekf_ok: true`.

### Ghi cho Phase 07

`SET_MESSAGE_INTERVAL` cho `OBSTACLE_DISTANCE` (330) bị FC trả STATUSTEXT
`No ap_message for mavlink id (330)` — ArduPilot **không lập lịch được** message
này; nó do driver proximity tự đẩy khi có cảm biến. `DISTANCE_SENSOR` (132) thì
xin được, chỉ là SITL này chưa gắn rangefinder nên đo ra 0 Hz. Đừng mất công gỡ
lỗi "sao xin rồi mà không thấy".

Ghi chú: 

## Phase 06 — Backend điều khiển + dead-man

Plan: plans/phase-06-backend-dieu-khien-deadman.md

Ngày bắt đầu: 22/09/2026 · Ngày xong: 22/09/2026 · PR #31

- [x] `pytest backend/tests/test_deadman.py` → **17 PASSED**, gồm đủ 3 test bắt buộc của `SAFETY.md` §5. (Plan ghi 6; số thật cao hơn vì thêm bài hồi quy cho ba lỗi bắt được trên SITL.)
- [x] `pytest backend/tests/test_control.py` → **17 PASSED** (gồm 2 bài canh gác hàm cấm).
- [x] **9** test cũ trong `test_safety.py` vẫn xanh (plan ghi 4 — đếm sai; không bài nào bị phá).
- [x] Chuyển thử `DeadmanLoop` vào asyncio → test #5 **đỏ**. Đã thử thật, xem ô cảnh báo ở Ghi chú.
- [x] `scripts/sitl_deadman_check.py` in `KET QUA: PASS`, độ trễ zero-velocity **< 1 ms**.
- [x] 4 bài nghiệm thu tay ở 6.8 đều đạt; đã ghi `docs/test-log.md` (file này trước đó chưa tồn tại).
- [x] `grep -rniE "send_motor_pwm|..."` chỉ ra dòng **ghi chú cấm** và danh sách của chính bài test canh gác; không lời gọi thật nào.
- [x] `grep -n "\.mav\." backend/mavlink/control.py` — 2 kết quả, cả hai là **tham số** của `self.connection.send(...)`.
- [x] Xin `takeoff 50` (vượt `MAX_ALT=10`) trên SITL → `validation_failed`, `relative_alt` giữ nguyên **5.02 m**.
- [x] `ruff check .` sạch; `pytest` → **131 passed** (trước phase: 96).
- [x] `docs/so-tay/06-backend-dieu-khien-deadman.md` đã viết (11 mục).

Ghi chú:

**Ba lỗi chỉ lộ ra khi chạy SITL thật, pytest xanh toàn bộ trong khi cả ba đang
sống.** Đây là bằng chứng cụ thể nhất từ trước tới nay cho câu "một cái xanh
không thay được cái kia":

| Lỗi | Triệu chứng | Vì sao pytest mù |
|---|---|---|
| `ack done` của `cmd.arm` nói dối | arm OK rồi takeoff ngay sau báo "Chua armed" | Cờ `armed` ở HEARTBEAT (1 Hz); test đặt thẳng `state.armed=True` |
| Dead-man nổ ngay khi bật WEB CONTROL | Bắn velocity **khi drone còn trên mặt đất** → ArduCopter từ chối `NAV_TAKEOFF` với `MAV_RESULT_FAILED` | Test nào cũng gửi một lệnh velocity trước khi bơm thời gian giả |
| Sự kiện đổ tội sai | `"Mode đổi sang GUIDED — web mất quyền lái"` trong khi GUIDED nằm TRONG whitelist | Không test nào đọc `detail.reason` |

⚠️ **Và một lần phá-thử KHÔNG làm test đỏ — đây là bài học lớn nhất của phase.**
Bản đầu của `test_event_loop_bi_chen_van_gui_zero` gọi `deadman.start()` TRƯỚC
`asyncio.run(...)`, nên một bản viết bằng asyncio đặt ở thread riêng vẫn qua.
Bài test tồn tại để canh đúng một hồi quy, và nó canh không được. Phải chẹn
ĐÚNG cái loop mà bản asyncio sẽ bám vào. **Trước khi tin một test, hãy phá code
rồi xem nó có đỏ không** — ba lần phá còn lại đều đỏ đúng lý do, bảng đầy đủ ở
`docs/test-log.md`.

**Một lần kết luận sai giữa chừng, nguyên nhân đáng ghi:** tôi tuyên bố "bug A
không phải nguyên nhân của bug C" trong khi backend đang chạy **code cũ** — hai
tiến trình uvicorn cùng sống, cái cũ giữ cổng 8000 nên cái mới không bind được,
và SITL với `--no-mavproxy` chỉ nhận MỘT client TCP nên log đầy `EOF on TCP
socket`. Đếm tiến trình theo TÊN sẽ nhầm (`uv run` đẻ mấy lớp bọc); phải giết
theo PID giữ cổng. Bài học: **trước khi kết luận một bản sửa không có tác dụng,
so `StartTime` của tiến trình đang phục vụ với thời điểm sửa.**

**Đã sửa 11 chỗ plan lệch thực tế** (chi tiết trong PR #31), đáng chú ý: §6.3
bảo nối `on_mode_change` trong `telemetry.py` nhưng Phase 05 đã nối ở
`ws.py::_reconcile_control_ownership` rồi — nối lại là tạo hai người ghi; và tên
gói trong test #1 thiếu hậu tố `_send` nên `last()` trả `None` và bài test sẽ
**xanh vờ**.

**SonarCloud đỏ, đã xử (lặp lại tiền lệ Phase 01).** Gate hỏng ở
`new_reliability_rating=3` (1 BUG: so bằng trên float ở `_dang_di`) và
`new_security_rating=3` (3 cảnh báo path-traversal ở hai script CLI).

Kết quả sau khi sửa: **gate OK, cả 5 điều kiện xanh, mọi rating = 1** — 0 bug,
0 vulnerability. Không tắt luật nào. Cách xử path-traversal: neo đường dẫn
`--script` / `--log` vào gốc repo. Ràng buộc đó đúng độc lập với máy quét — file
kịch bản và sổ kiểm là *tang chứng của một lần chạy*, để ngoài repo thì không ai
xem lại được; cùng lý do với `DEADMAN_LOG_PATH` trong `backend/config.py`.

**Còn 10 code smell CHƯA sửa, nói rõ ra thay vì để trống:** 7 cái thuộc luật
"đừng nhận tham số `timeout`, để người gọi bọc `asyncio.timeout()`" và 3 cái
đòi hạ độ rối từ 17/18/20 xuống 15. Tất cả đều nằm ở hai script CLI dev, đều
là MAJOR/CRITICAL *code smell* chứ không phải bug hay lỗ hổng, và không kéo
rating nào khỏi 1. Dừng ở đây là đúng bằng vạch của tiền lệ Phase 01 (vòng 5:
0 vulnerability), không phải là hạ vạch. Luật `timeout` thật ra đáng làm — bỏ
tham số đó xoá luôn mấy dòng tính hạn chót thủ công — nhưng nó động vào đúng
hai script vừa được nghiệm thu chạy thật trên SITL, nên để thành một việc
riêng có nghiệm thu riêng, đừng nhét vào cuối một PR đã xanh.

## Phase 07 — Backend mission + proximity + safety

Plan: plans/phase-07-backend-mission-proximity-safety.md

Ngày bắt đầu: 25/09/2026 · Ngày xong: 25/09/2026

- [x] `uv run pytest` → **264 passed** (trước phase: 131); **6 test cũ** của `test_mission_validation.py` không sửa dòng nào (xem Ghi chú: plan sai về cách giữ được điều này).
- [x] Coverage `safety` 99% · `mission` 90% · `deadman` 93% · `proximity` 97% — tổng **93%**, `--cov-fail-under=80` PASS.
- [x] **Bốn phép thử phá**: 7 / 1 / 2 / 6 test đỏ. Phép 2 lần đầu **0 test đỏ** → thêm test biên `MAX_ALT` rồi mới đỏ. Sửa tạm đã hoàn nguyên, `git diff` sạch trên các dòng đó. Bảng ở sổ tay mục 11.
- [x] **Mission Planner Read WPs** đọc thẳng từ FC ra đúng TAKEOFF + 4 WAYPOINT + RTL, đúng toạ độ, đúng alt, frame Relative, không lệch dòng. Ảnh `docs/so-tay/anh/07-mp-read-wps.png`.
- [x] Mission alt 50 m → `validation_failed` qua WS, **422** qua REST; lịch sử sự kiện không có gói mission nào của lần đó; unit test khẳng định 0 gói `mission_*`.
- [x] `avoid_state` đủ 4 nhánh trên SITL: LOITER OFF → NEAR → ACTIVE (gần nhất 1,05 m); GUIDED xuống 1,53 m mà **không lần nào ACTIVE**; UNKNOWN 38 mẫu lúc FC chưa báo cảm biến khoẻ. Bảng ở sổ tay mục 7.
- [x] `test_safety_state_machine.py`: 8 dòng bảng 7.7, mỗi dòng khẳng định cả cột "KHÔNG LÀM" (không gói đổi mode / arm / RTL / LAND / mission nào đi ra).
- [x] Quét hàm cấm trên toàn `backend/` thành test CI — bằng **AST**, không bằng regex của plan (regex đó đỏ trên code sạch, xem Ghi chú); có bài `test_quet_ham_cam_tu_do` chứng minh cổng đỏ được.
- [x] `GET /api/status` trả đúng `StatusPayload` — dựng bằng CÙNG hàm `build_status()` với WebSocket; test so khoá và validate bằng model.
- [x] `/api/video/stream` hiện hình trong trình duyệt (ảnh `docs/so-tay/anh/07-video-gia-trinh-duyet.png`); `detection` mỗi ~300 ms, box chạy cạnh trên rồi rẽ xuống cạnh phải của hình chữ nhật; 15 khung/giây, frame_id liên tục.
- [x] `git diff --stat origin/main -- backend/vision/detector.py backend/vision/events.py` rỗng; `stream.py` có sửa; `grep -n fake_stream backend/vision/stream.py` rỗng.
- [x] `docs/hop-dong-mjpeg.md` đủ bốn header; parser và nguồn giả cùng khớp (test round-trip `render_part` → parser).
- [x] `docs/so-tay/07-backend-mission-proximity-safety.md` đã viết (13 mục), mục 9 có đủ 5 lý do.

Nghiệm thu tay §7.11 trên SITL: bài 1 `ack done {"count":6,"readback_ok":true}` · bài 2 MP khớp · bài 3 AUTO qua cả 4 waypoint (gần nhất 1,8 / 1,7 / 0,7 / 0,1 m), RTL, disarm sau 70 s, chạy hai lần ra cùng số · bài 4 chặn · bài 5 như trên · bài 6 tắt SITL giữa AUTO: `link.lost` mức error sau 3,1 s, `connected=false` sau 3,3 s, không đổi mode, `/api/health` vẫn 200 · bài 7 như trên.

Ghi chú:

**Bốn lỗi chỉ lộ khi chạy SITL thật, pytest xanh toàn bộ trong khi cả bốn đang sống:**

| Lỗi | Triệu chứng | Vì sao pytest mù |
|---|---|---|
| HEARTBEAT của Mission Planner bị coi là của máy bay | FC chuyển tiếp gói giữa các cổng; mode nhảy GUIDED ↔ STABILIZE, `start()` báo "Chưa armed" khi đang bay 4 m | Test chỉ có một GCS. Sửa: lọc theo sysid của FC + bỏ heartbeat loại GCS |
| Trời trống báo `UNKNOWN` | FC chỉ gửi `DISTANCE_SENSOR` khi có vật trong tầm; plan coi im lặng là mù | Test tự bơm số đo liên tục |
| Mất link vẫn báo `OFF` | 63 mẫu `connected=false`, `avoid_state=OFF` | Không test nào xét avoid_state khi link chết |
| Bit sức khoẻ sai | `LASER_POSITION` không có mặt; bit thật là `PROXIMITY` — đo bằng `run_proximity_probe.py` TRƯỚC khi viết code nên không thành lỗi | — |

**Plan sai ở bốn chỗ, đã ghi đính chính ngay trong file plan:** (1) §7.1 "thêm `command` có mặc định thì test cũ không phải sửa" — sai, 4 test cũ khẳng định `== []` cho mission chỉ có waypoint; hai luật cấu trúc phải tách ra `validate_mission_structure()`; hợp đồng WS cũng phải thêm `command`. (2) §7.9 regex quét hàm cấm **đỏ trên code sạch** vì bắt trúng docstring của `control.py`. (3) §7.6.4 bảng `avoid_state` (xem bảng lỗi). (4) §7.8.1 và §7.8 mâu thuẫn nhau về `/api/status`; chọn "y hệt `status.data`", sửa đúng một dòng `test_app.py` (`mode` → `safety.current_mode`).

**Video giả đổi theo phản hồi của chủ dự án.** Bản đầu QVGA 320×240, quay cả cửa sổ MP rồi thu nhỏ: mở trong trình duyệt thì bé và vỡ chữ. Nay mặc định VGA 640×480, JPEG chất lượng 10 (thang ESP32), clip là vùng bản đồ vệ tinh quay lúc SITL đang bay; `CAMERA_FAKE_FRAMESIZE=QVGA` để thử đúng cỡ ESP32. Hệ quả cho Phase 10: overlay phải đọc cỡ từ `detection.width/height`, không giả định 320×240.

**Một tương tác đáng biết (không phải lỗi Phase 07):** `plans/samples/takeoff.jsonl` bật WEB CONTROL rồi đóng socket ngay sau takeoff → dead-man gửi velocity 0 → GUIDED huỷ lệnh takeoff đang chạy → máy bay nằm đất, tự disarm sau 10 s. Hành vi an toàn, nhưng bật WEB CONTROL thì phải giữ tab tới khi lên xong.

**Khoá upload độc quyền đã thử thật một cách tình cờ:** hai script cùng chờ máy bay lên 4 m rồi cùng gửi mission; một cái nạp được, cái kia nhận `command_denied` đúng như §7.3 điểm 6.

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
- [ ] `RTL_ALT_M` (mét, **không phải** `RTL_ALT` cm) đã đặt cao hơn mọi vật cản trong bãi và thấp hơn `FENCE_ALT_MAX`; **đã đọc ngược lại giá trị để xác nhận**.
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
