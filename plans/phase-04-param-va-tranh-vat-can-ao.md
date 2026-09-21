# Phase 04: Nạp thử param vào SITL và tránh vật cản ảo

| Trạng thái | Phụ thuộc | Ước lượng | Cần phần cứng |
|---|---|---|---|
| chưa bắt đầu | Phase 03 | ~5 giờ | Không |

## Mục tiêu

Hai việc, cùng một mục đích: **biết trước những gì sẽ xảy ra trên board thật**.

1. Nạp thử bộ param của dự án vào drone ảo và ghi lại **chính xác param nào SITL từ chối** — đó là danh sách "chỉ chạy được trên bản custom build", cần kiểm tra lại ngay sau khi nạp firmware ở Phase 14.
2. Bật cảm biến khoảng cách ảo và **nhìn thấy bằng mắt** việc drone tự phanh lại trước vật cản khi đang bay LOITER. Đó đúng là hành vi TFmini Plus sẽ tạo ra trên drone thật ở Phase 22.

Sau phase này bạn không còn phải đoán "liệu param này có tồn tại không" — bạn có một bảng đã kiểm chứng.

## Đầu vào cần có

Phải xong trước: **Phase 03** — thạo `mode` / `arm` / `takeoff` / `rc` trên SITL, đọc được dòng `PreArm:`.

Phải đọc trước:

- `firmware/ardupilot/params/obstacle-avoidance-tfminiplus-serial3.param` — đọc kỹ khối ghi chú ở đầu file: vì sao chọn SERIAL3, vì sao `OA_TYPE,0` lúc đầu, cách đấu dây TFmini Plus.
- `firmware/ardupilot/params/README.md` — quy ước tên file `00-after-flash.param` … `07-final.param`.
- `plans/reports/260921-research-sitl-firmware-toolchain.md` §4 — bảng enum param đã xác minh từ mã nguồn ArduPilot (`SERIALn_PROTOCOL`, `RC_PROTOCOLS`, `GPS1_TYPE`, `MOT_PWM_TYPE`), và §4.6 — **bản nháp `01-base.param`**.
- Tài liệu ArduPilot: [Adding Simulated Peripherals to sim_vehicle](https://ardupilot.org/dev/docs/adding_simulated_devices.html) — nguồn của mọi lệnh mô phỏng cảm biến ở việc 04.4.

**Về `01-base.param`:** file chính thức do **Phase 11** sở hữu và chốt. Phase 11 chỉ phụ thuộc Phase 01 nên có thể đã xong trước. Nếu `firmware/ardupilot/params/01-base.param` đã tồn tại → dùng file đó. Nếu chưa → tạo một **bản nháp riêng** tại `firmware/ardupilot/params/sitl/01-base-draft.param` bằng cách chép khối ở báo cáo §4.6, và **không** tạo file `01-base.param` (tránh giẫm chân Phase 11). Bảng kết quả bạn ghi ở phase này chính là đầu vào cho Phase 11.

## File và thư mục sở hữu

Tạo mới — **toàn bộ nằm trong `firmware/ardupilot/params/sitl/`**, không chạm file param của board thật:

- `firmware/ardupilot/params/sitl/00-sitl-default.param` — snapshot param gốc của SITL.
- `firmware/ardupilot/params/sitl/01-sitl-base-loaded.param` — snapshot sau khi nạp bộ base.
- `firmware/ardupilot/params/sitl/02-sitl-avoid.param` — snapshot cấu hình tránh vật cản đã chạy được.
- `firmware/ardupilot/params/sitl/01-base-draft.param` — **chỉ tạo nếu Phase 11 chưa xong**.
- `firmware/ardupilot/params/sitl/README.md` — **bảng "SITL nhận / SITL từ chối"**, sản phẩm chính của phase.

Sửa:

- `scripts/run_sitl.sh` — dùng biến `SITL_EXTRA` đã có sẵn từ Phase 02; nếu chưa có thì thêm.
- `docs/so-tay/04-param-va-tranh-vat-can-ao.md`, `plans/PROGRESS.md`.

**Không đụng:** `firmware/ardupilot/params/01-base.param` và `02-avoid-tfmini.param` (Phase 11 sở hữu) · `firmware/ardupilot/params/obstacle-avoidance-tfminiplus-serial3.param` (chỉ đọc) · `backend/`, `frontend/`, `ml/`.

## Việc theo thứ tự

### 04.1 Chụp ảnh trạng thái gốc trước khi đụng vào gì

Luật bất di bất dịch khi làm việc với param — trên SITL cũng như trên drone thật: **lưu snapshot trước khi đổi**. Không có nó thì khi nghịch hỏng bạn không có đường lùi.

Chạy ở **bash trong WSL**, khởi động SITL:

```bash
cd /mnt/d/Coding/IOT-CV
mkdir -p firmware/ardupilot/params/sitl
./scripts/run_sitl.sh
```

Trong cửa sổ **MAVProxy**:

```
param fetch
param save /mnt/d/Coding/IOT-CV/firmware/ardupilot/params/sitl/00-sitl-default.param
```

`param fetch` kéo toàn bộ danh sách param từ drone về (mất vài giây, nó in tiến độ). `param save` ghi ra file.

Cách thứ hai, từ **Mission Planner**: `Config/Tuning` → `Full Parameter List` → `Save to file`. Hai cách cho kết quả tương đương; dùng cách nào quen tay hơn.

Kết quả mong đợi: file `00-sitl-default.param` tồn tại và có vài trăm dòng dạng `TÊN_PARAM,giá_trị`.

```bash
wc -l firmware/ardupilot/params/sitl/00-sitl-default.param
head -5 firmware/ardupilot/params/sitl/00-sitl-default.param
```

Nếu lỗi:

1. **`param save` báo không ghi được** → thư mục chưa tồn tại. `mkdir -p` như lệnh ở trên.
2. **File chỉ có vài dòng** → `param fetch` chưa xong. Đợi dòng `Received N parameters` rồi mới `param save`.
3. **Không biết `/mnt/d/` là gì** → đó là ổ D của Windows nhìn từ trong WSL. `ls /mnt/d/Coding/IOT-CV` để kiểm chứng.

### 04.2 Nạp bộ param nền vào SITL

**(a) Chuẩn bị file**

Nếu `firmware/ardupilot/params/01-base.param` đã có (Phase 11 xong trước) → dùng luôn. Nếu chưa → chép khối ở `plans/reports/260921-research-sitl-firmware-toolchain.md` §4.6 vào `firmware/ardupilot/params/sitl/01-base-draft.param`.

File này khai báo: khung (`FRAME_CLASS`, `FRAME_TYPE`), phân bổ 6 cổng serial, giao thức receiver (`RC_PROTOCOLS,4` = iBUS), GPS (`GPS1_TYPE,2` = uBlox), compass, ESC (`MOT_PWM_TYPE,5` = DShot300), pin 4S, failsafe cơ bản, và log.

**(b) Nạp bằng Mission Planner**

`Config/Tuning` → `Full Parameter List` → `Load from file` → chọn file → **một cửa sổ so sánh hiện lên** → `Write Params`.

**Cửa sổ so sánh đó chính là thứ bạn cần đọc.** Nó liệt kê từng param: giá trị cũ, giá trị mới, và **param nào nó không tìm thấy**. Chụp màn hình cửa sổ này.

**(c) Cách thứ hai, bằng MAVProxy** (dễ ghi lại kết quả hơn):

```
param load /mnt/d/Coding/IOT-CV/firmware/ardupilot/params/sitl/01-base-draft.param
```

MAVProxy in từng dòng nó xử lý, và in rõ dòng nào thất bại — dễ copy vào bảng hơn cửa sổ đồ hoạ.

**(d) Lưu snapshot sau khi nạp**

```
param fetch
param save /mnt/d/Coding/IOT-CV/firmware/ardupilot/params/sitl/01-sitl-base-loaded.param
```

**(e) Luật quan trọng — param KHÔNG bao giờ nạp bằng file**

Bốn nhóm sau **bắt buộc chạy wizard** trong Mission Planner, kể cả sau này trên board thật:

| Nhóm param | Wizard tương ứng | Vì sao |
|---|---|---|
| `RC*_MIN` / `MAX` / `TRIM` | Radio Calibration | Số đo của **tay điều khiển của bạn** |
| `COMPASS_OFS*`, `COMPASS_DIA*` | Compass Calibration | Số đo từ trường **tại chỗ lắp của bạn** |
| `INS_ACC*` | Accel Calibration | Số đo gia tốc kế **của con board của bạn** |
| — | ESC Calibration | Dải xung của **bộ ESC của bạn** |

Nạp bằng file là **dán giá trị của một con drone khác lên drone của bạn**. Ghi luật này vào sổ tay bằng chữ in đậm.

Kết quả mong đợi: bộ param nạp xong, có ảnh chụp cửa sổ so sánh, có file `01-sitl-base-loaded.param`.

Nếu lỗi:

1. **`Write Params` xong nhưng giá trị không đổi** → chưa reboot. Gõ `reboot` trong MAVProxy, đợi kết nối lại, `param fetch` rồi kiểm lại.
2. **SITL crash ngay sau khi nạp** → một param làm lệch cấu hình khung. Khởi động lại với `WSL_MIRRORED=1 SITL_EXTRA="-w" ./scripts/run_sitl.sh` (cờ `-w` xoá param về mặc định) rồi nạp lại từng khối nhỏ để khoanh vùng.
3. **`param load` báo không đọc được file** → sai đường dẫn, hoặc file lưu với xuống dòng kiểu Windows. `sed -i 's/\r$//' <file>` rồi thử lại.

### 04.3 Nạp bộ param tránh vật cản và ghi bảng kết quả

**(a) Nạp**

```
param load /mnt/d/Coding/IOT-CV/firmware/ardupilot/params/obstacle-avoidance-tfminiplus-serial3.param
```

File này khai báo `SERIAL3_PROTOCOL,9` (Rangefinder), `RNGFND1_TYPE,20` (Benewake TFmini Plus qua UART), `PRX1_TYPE,4` (đưa rangefinder vào hệ proximity), cả nhóm `AVOID_*`, và `OA_TYPE,0`.

**(b) Ghi bảng — sản phẩm chính của phase**

Tạo `firmware/ardupilot/params/sitl/README.md`. Điền cột "SITL nhận?" bằng **quan sát thực tế**, không chép đoán:

```markdown
# Kết quả nạp param của dự án vào SITL

Ngày thử: ____ · Bản SITL: ArduCopter 4.7.1 build từ nguồn (Phase 02)

| Param | File nguồn | SITL nhận? | Ghi chú |
|---|---|---|---|
| `FRAME_CLASS` | base | | 1 = Quad |
| `SERIAL3_PROTOCOL` | base | | 9 = Rangefinder |
| `GPS1_TYPE` | base | | tên cũ `GPS_TYPE`, đổi từ 4.6 |
| `MOT_PWM_TYPE` | base | | 5 = DShot300 |
| `BATT_VOLT_MULT` | base | | |
| `RNGFND1_TYPE` | avoid | | 20 = Benewake TFmini Plus UART |
| `PRX1_TYPE` | avoid | | 4 = rangefinder |
| `AVOID_ENABLE` | avoid | | |
| `OA_TYPE` | avoid | | 0 = tắt, cố ý |

## Param SITL từ chối (nếu có)

Liệt kê ở đây. Mỗi dòng kèm: tên param, thông báo lỗi nguyên văn, và ý nghĩa
(chỉ có trên custom build? đổi tên ở bản mới? hay ta ghi sai?).

## Kiểm lại ở Phase 14

Sau khi nạp firmware lên board thật, mở Full Parameter List và kiểm từng dòng
"SITL từ chối" ở trên. Nếu board thật cũng không có → bản custom build thiếu
feature, phải build lại tại custom.ardupilot.org bằng
`firmware/ardupilot/custombuild/speedybeef4v5-copter471-tfminiplus.yaml`.
```

**(c) Điểm phải thận trọng — chưa xác minh**

Ghi chú trong chính file `obstacle-avoidance-tfminiplus-serial3.param` và trong báo cáo SITL nói rằng bản firmware **stock** không có nhóm `PRX_*`, nên nạp file này sẽ báo "parameter not found".

Nhưng bản SITL bạn build ở Phase 02 là bản **đầy đủ feature** — build SITL mặc định bật nhiều thứ hơn firmware phải nhét vừa con chip F405. Rất có thể nó **có đủ** `PRX_*` và `RNGFND*`.

**Đây là điểm chưa xác minh.** Đừng đoán theo hướng nào: cứ nạp, đọc thông báo, và ghi đúng những gì máy trả lời. Cả hai kết quả đều có ích:

- **SITL nhận hết** → bạn thử được trọn luồng tránh vật cản ở việc 04.4, và bạn biết bản custom build trên board thật **cũng phải** có những feature đó. Đối chiếu với `firmware/ardupilot/build-d450a747/build.log`.
- **SITL từ chối một số** → bạn có danh sách chính xác "chỉ chạy trên custom build". Phase 14 kiểm lại từng dòng.

Kết quả mong đợi: `firmware/ardupilot/params/sitl/README.md` có bảng điền đủ **9 dòng**, mỗi dòng là quan sát thật.

Nếu lỗi:

1. **Mọi param đều báo không tìm thấy** → bạn nạp nhầm file, hoặc `param fetch` chưa xong nên MAVProxy chưa biết drone có param gì. `param fetch` rồi nạp lại.
2. **Không phân biệt được "từ chối" và "nhận nhưng giá trị khác"** → dùng `param show <tên>` sau khi nạp: nếu in ra giá trị mới thì nhận, nếu báo `Unable to find parameter` thì từ chối.
3. **Nạp xong `AVOID_*` nhưng không thấy tác dụng gì** → bình thường, chúng chỉ có tác dụng khi có cảm biến proximity thật sự báo dữ liệu về (việc 04.4).

### 04.4 Bật cảm biến khoảng cách ảo

ArduPilot SITL mô phỏng được **hai thứ riêng biệt**, đừng lẫn:

- **Rangefinder** — một tia, đo khoảng cách theo một hướng. Trên drone thật đây là TFmini Plus.
- **Proximity (lidar 360°)** — vòng quét quanh drone. SITL dùng nó để dựng ra vật cản ảo mà AVOID có thể phản ứng.

Cả hai lệnh dưới đây lấy từ tài liệu [Adding Simulated Peripherals to sim_vehicle](https://ardupilot.org/dev/docs/adding_simulated_devices.html).

**(a) Rangefinder ảo**

Gõ trong **MAVProxy**:

```
param set SIM_SONAR_SCALE 10
param set RNGFND1_TYPE 1
reboot
```

⚠️ **Ba con số dễ chép nhầm — đây là lỗi tốn nhiều giờ nhất của phase này:**

| `RNGFND1_TYPE` | Nghĩa | Dùng ở đâu |
|---|---|---|
| `1` | Analog | **SITL, việc này** |
| `100` | SITL (ghép với trình mô phỏng ngoài như AirSim) | không dùng trong dự án |
| `20` | Benewake TFmini Plus qua UART | **board thật, Phase 14 trở đi** |

Snapshot SITL nằm riêng trong `params/sitl/` chính là để bạn **không bao giờ** chép nhầm `1` sang file của board thật.

Kiểm chứng: gõ `graph RANGEFINDER.distance` trong MAVProxy (mở một cửa sổ đồ thị), hoặc nhìn ô `Sonar Range` trên HUD Mission Planner. Bay lên xuống — con số phải đổi theo độ cao.

**(b) Lidar 360° ảo — đây mới là thứ tạo ra vật cản**

```
param set SERIAL5_PROTOCOL 11
param set PRX1_TYPE 16
reboot
```

(`SERIAL5_PROTOCOL 11` = Proximity. `PRX1_TYPE`: `16` = LD06, `5` = RPLidarA2, `8` = SF45b — chọn `16`.)

Rồi khởi động lại SITL **kèm thiết bị ảo và một toạ độ có sẵn tường ảo**. Chạy ở **bash trong WSL**:

```bash
cd /mnt/d/Coding/IOT-CV
SITL_EXTRA="-A --serial5=sim:ld06 -l 51.8752066,14.6487840,54.15,0" ./scripts/run_sitl.sh
```

Hoặc gọi thẳng:

```bash
cd ~/ardupilot/ArduCopter
../Tools/autotest/sim_vehicle.py --map --console --no-wsl2-network \
  -A --serial5=sim:ld06 \
  -l 51.8752066,14.6487840,54.15,0
```

Toạ độ `51.8752066,14.6487840` là vị trí tài liệu ArduPilot chỉ định vì **xung quanh nó có sẵn rào chắn ảo** — bay ra bốn phía sẽ đụng.

Tài liệu có nêu một lệnh riêng để **hiển thị các rào đó lên bản đồ** MAVProxy, nhưng tôi **chưa xác minh được cú pháp chính xác** — mở trang tài liệu ở link trên và đọc đúng dòng đó. Nếu không hiển thị được thì vẫn quan sát được hành vi qua đồ thị proximity và qua việc drone bị phanh, nên đừng để nó chặn bạn.

Kiểm chứng proximity có dữ liệu: `graph PROXIMITY` trong MAVProxy, hoặc Mission Planner → tab `Proximity` (một số bản nằm trong `Ctrl+F` → `Proximity`).

Kết quả mong đợi: giá trị proximity đổi khi drone lại gần rào chắn.

Nếu lỗi:

1. **`param set PRX1_TYPE 16` báo `Unable to find parameter`** → bản SITL của bạn không build kèm proximity. Đây là **phát hiện đáng ghi vào bảng ở 04.3**. Thử build lại SITL (`./waf configure --board=sitl && ./waf copter` trong `~/ardupilot`); nếu vẫn thiếu thì hoãn phần AVOID sang Phase 22 (drone thật) và **ghi rõ vào PROGRESS là cổng pass này bị hoãn** — đừng tick bừa.
2. **`--serial5=sim:ld06` báo lỗi tham số** → phiên bản `sim_vehicle.py` của bạn dùng tên cờ cũ (`--uartF`). Xem cờ nào có: `../Tools/autotest/sim_vehicle.py --help | grep -i -E "serial|uart"`. Ghi cờ đúng vào `scripts/run_sitl.sh` và vào sổ tay.
3. **`graph` không mở cửa sổ** → thiếu `python3-matplotlib` trong WSL (Phase 02 việc 02.4). Dùng tab Proximity của Mission Planner thay thế.

### 04.5 Nhìn thấy AVOID phanh máy bay

Bật avoidance. Gõ trong **MAVProxy**:

```
param set AVOID_ENABLE 3
param set AVOID_BEHAVE 1
param set AVOID_MARGIN 2
param set AVOID_DIST_MAX 5
reboot
```

Ý nghĩa (khớp với `firmware/ardupilot/params/obstacle-avoidance-tfminiplus-serial3.param`):

| Param | Giá trị | Nghĩa |
|---|---|---|
| `AVOID_ENABLE` | 3 | Bật tránh vật cản dựa trên **cả** fence lẫn cảm biến proximity |
| `AVOID_BEHAVE` | 1 | Kiểu ứng xử **Stop** (phanh đứng) thay vì Slide (trượt dọc vật cản) |
| `AVOID_MARGIN` | 2 | Giữ khoảng cách 2 m |
| `AVOID_DIST_MAX` | 5 | Bắt đầu phản ứng từ 5 m |

⚠️ **`AVOID_*` chỉ hoạt động ở LOITER / PosHold / AltHold.** Ở AUTO / GUIDED / RTL phải dùng Object Avoidance Path Planner (`OA_TYPE`) — đó chính là lý do file param thật để `OA_TYPE,0` lúc đầu.

**Bài thử chính:**

```
mode guided
arm throttle
takeoff 15
mode loiter
rc 2 1300
```

`rc 2 1300` là đẩy cần pitch về phía trước — lệnh "bay tới" và **giữ nguyên**.

Drone phải bay tới, rồi **tự dừng lại** cách rào chắn ảo khoảng `AVOID_MARGIN` mét, **dù bạn vẫn đang giữ cần**. Đó là khoảnh khắc cần chụp màn hình.

Trả cần về giữa rồi hạ:

```
rc 2 1500
mode rtl
```

**Bài thử phụ — OA path planner ở AUTO** (làm nếu 04.3 cho thấy SITL có `OA_TYPE`):

```
param set OA_TYPE 1
reboot
```

`OA_TYPE 1` = BendyRuler, thuật toán tìm đường vòng qua vật cản, hoạt động trong AUTO/GUIDED/RTL. Vẽ một mission đi xuyên qua chỗ có rào chắn rồi chạy AUTO, xem nó có vòng không.

⚠️ Trên drone thật, `OA_TYPE` **để 0 lúc đầu**: BendyRuler cần biết đường vòng, mà ta chỉ có một tia TFmini rộng 3,6° nhìn thẳng trước — nó sẽ lệch sang hướng **chưa có dữ liệu**. Giống như đi trong tối chỉ có một cây đèn pin chiếu thẳng: bạn thấy phía trước có tường, nhưng không biết bên trái có gì. Trên SITL thì lidar 360° có đủ dữ liệu nên thử được thoải mái — **đừng nhầm hai tình huống đó với nhau**.

**Lưu snapshot:**

```
param fetch
param save /mnt/d/Coding/IOT-CV/firmware/ardupilot/params/sitl/02-sitl-avoid.param
```

Kết quả mong đợi: drone phanh lại trước rào chắn ảo ở LOITER dù đang giữ cần tiến; có ảnh chụp màn hình lưu vào `docs/so-tay/04-param-va-tranh-vat-can-ao.md`.

Nếu lỗi:

1. **Drone bay xuyên qua, không phanh** → (a) sai toạ độ khởi động nên không có rào chắn ở đó; (b) đang ở GUIDED chứ không phải LOITER; (c) quên `reboot` sau `param set`; (d) proximity không có dữ liệu — kiểm bằng `graph PROXIMITY` trước.
2. **Drone phanh rồi lùi lại liên tục, giật giật** → `AVOID_MARGIN` quá lớn so với `AVOID_DIST_MAX`. Giảm margin xuống 1,5.
3. **`param set AVOID_ENABLE 3` báo không tìm thấy** → bản SITL thiếu AC_Avoid. Ghi vào bảng 04.3; xem cách xử lý ở lỗi (1) của việc 04.4.

### 04.6 Chốt lại và commit

```bash
cd /mnt/d/Coding/IOT-CV
ls -la firmware/ardupilot/params/sitl/
git add firmware/ardupilot/params/sitl/ docs/so-tay/04-param-va-tranh-vat-can-ao.md plans/PROGRESS.md
git commit -m "param: ghi ket qua nap param va mo phong tranh vat can tren SITL"
```

Kiểm tra bảng ở `firmware/ardupilot/params/sitl/README.md` đã điền đủ 9 dòng, và mục "Param SITL từ chối" hoặc có danh sách hoặc ghi rõ "không có".

Ghi vào `plans/PROGRESS.md` mục Phase 04: kết luận một dòng — *"SITL có/không có nhóm PRX_*; AVOID thử được/hoãn sang Phase 22"*. Phase 11 và Phase 14 sẽ đọc dòng đó.

## Cổng pass

- [ ] `firmware/ardupilot/params/sitl/` có đủ 3 file snapshot (`00-sitl-default`, `01-sitl-base-loaded`, `02-sitl-avoid`) và đã commit.
- [ ] `firmware/ardupilot/params/sitl/README.md` có bảng "SITL nhận / từ chối" điền đủ **9 dòng**, mỗi dòng là quan sát thực tế; mục "Param SITL từ chối" hoặc liệt kê hoặc ghi rõ "không có".
- [ ] Nạp được bộ param nền vào SITL và có **ảnh chụp cửa sổ so sánh** của Mission Planner (hoặc log `param load` của MAVProxy) trong sổ tay.
- [ ] `graph RANGEFINDER.distance` (hoặc ô `Sonar Range` trên HUD) hiện số liệu đổi theo độ cao.
- [ ] **Thấy AVOID phanh máy bay trước vật cản ảo ở LOITER**: giữ `rc 2 1300` mà drone dừng lại; có ảnh chụp màn hình trong `docs/so-tay/04-param-va-tranh-vat-can-ao.md`.
  - *Hoặc*: nếu bản SITL thiếu `PRX_*`/`AVOID_*`, ghi rõ vào PROGRESS là **hoãn sang Phase 22** kèm bằng chứng (thông báo lỗi nguyên văn). Không tick ô này khi chưa thấy.
- [ ] Ghi được vào sổ tay ba giá trị `RNGFND1_TYPE` và dùng ở đâu (`1` SITL analog / `100` SITL-external / `20` TFmini Plus thật).
- [ ] `plans/PROGRESS.md` mục Phase 04 có dòng kết luận về `PRX_*`, đã tick và commit.
- [ ] `git status --short` sạch; không có file nào ngoài danh sách sở hữu bị sửa.

## Rủi ro

| Rủi ro | Khả năng (1-5) | Ảnh hưởng (1-5) | Điểm | Xử lý |
|---|---|---|---|---|
| Chép nhầm `RNGFND1_TYPE` của SITL (`1`/`100`) sang param của board thật (phải là `20`) | 3 | 4 | **12** | Snapshot SITL để riêng trong `params/sitl/`; **không bao giờ** sửa `01-base.param` từ snapshot SITL; bảng ba giá trị ghi ngay trong `params/sitl/README.md` và trong sổ tay |
| Bản SITL thiếu `PRX_*`/`AVOID_*` nên không thử được luồng tránh vật cản (**chưa xác minh**) | 3 | 4 | **12** | 04.3 kiểm tra **trước** khi tới 04.4; nếu thiếu: build lại SITL, hoặc hoãn sang Phase 22 và ghi rõ vào PROGRESS kèm bằng chứng — tuyệt đối không tick cổng pass bừa |
| Tick cổng pass "thấy AVOID phanh" mà thật ra chưa thấy, tới Phase 22 mới vỡ lẽ | 3 | 4 | **12** | Cổng pass yêu cầu **ảnh chụp màn hình**; có nhánh "hoãn" ghi sẵn để không phải nói dối cho xong |
| Giẫm chân Phase 11: tạo `01-base.param` trong khi Phase 11 sở hữu file đó | 3 | 3 | 9 | Quy tắc ở "Đầu vào cần có": nếu file chưa có thì tạo **bản nháp** trong `params/sitl/01-base-draft.param` |
| Cú pháp `--serial5=sim:ld06` và lệnh hiển thị rào chắn trên map **chưa xác minh** với bản `sim_vehicle.py` đang dùng | 3 | 3 | 9 | Đọc `sim_vehicle.py --help` và trang tài liệu tại chỗ; ghi cờ đúng vào `scripts/run_sitl.sh` và sổ tay |
| Nghịch param làm SITL không arm/không bay được, mất thời gian gỡ | 3 | 2 | 6 | Luôn có `00-sitl-default.param` để nạp lại; hoặc chạy SITL với `-w` để xoá sạch |
| Lẫn AVOID (chỉ LOITER/AltHold) với OA path planner (AUTO/GUIDED) → tưởng AVOID hỏng khi bay AUTO | 3 | 2 | 6 | Ghi rõ ở 04.5 và trong sổ tay; hai cơ chế, hai phạm vi mode |
| Thấy OA BendyRuler chạy ngon trên SITL (lidar 360°) rồi bật luôn trên drone thật (một tia) | 2 | 5 | **10** | Cảnh báo in đậm ở 04.5 kèm ví dụ cây đèn pin; Phase 22 nhắc lại trước khi bật `OA_TYPE` |

## Timeline

| Việc | Giờ | Ghi chú |
|---|---|---|
| 04.1 Snapshot trạng thái gốc | 0,5 | |
| 04.2 Nạp bộ param nền | 1,0 | |
| 04.3 Nạp bộ avoid + ghi bảng | 1,25 | Sản phẩm có giá trị nhất của phase |
| 04.4 Rangefinder + proximity ảo | 1,0 | Rủi ro cao nhất; có thể phải build lại SITL (+1 giờ chờ máy) |
| 04.5 Thấy AVOID phanh + thử OA | 1,0 | |
| 04.6 Chốt, viết sổ tay, commit | 0,25 | |
| **Tổng** | **5,0** | Cộng ~1 giờ nếu phải build lại SITL ở 04.4 |

## Ghi chú cho sổ tay

Những khái niệm `docs/so-tay/04-param-va-tranh-vat-can-ao.md` cần giải thích cho người chưa biết gì:

- **Param là gì, snapshot param là gì** — hàng nghìn công tắc nhỏ trong flight controller; vì sao phải lưu ảnh chụp trước khi đổi; quy ước tên `00-after-flash` → `07-final`; vì sao file của SITL để riêng trong `params/sitl/`.
- **Ba loại param chỉ được đặt bằng wizard** — radio / compass / accel / ESC calibration. Ví von: nạp bằng file là **đo cỡ giày của người khác rồi bắt chân mình đi vừa**.
- **Custom build là gì** — firmware dựng riêng ở `custom.ardupilot.org` có bật thêm tính năng (PRX, OAPATHPLANNER, TFMINIPLUS) mà bản stock không có, vì chip F405 không đủ chỗ nhét tất cả. Vì sao phải biết trước param nào phụ thuộc nó.
- **Rangefinder khác proximity thế nào** — một tia đo theo một hướng, so với một vòng quét 360°; TFmini Plus là một tia nhưng được đưa vào hệ proximity qua `PRX1_TYPE,4`; vẽ hình minh hoạ.
- **Ba giá trị `RNGFND1_TYPE`** — `1` (analog trong SITL) / `100` (SITL ghép mô phỏng ngoài) / `20` (TFmini Plus thật). Nhấn mạnh: đây là lỗi tốn nhiều giờ nhất nếu chép nhầm.
- **AVOID so với OA path planner** — AVOID phanh/trượt, chỉ chạy ở LOITER/PosHold/AltHold; OA tìm đường vòng, chạy ở AUTO/GUIDED/RTL. Hai cơ chế khác nhau, đừng lẫn.
- **Vì sao `OA_TYPE,0` trên drone thật** — ví dụ đi trong tối với một cây đèn pin chiếu thẳng: thấy tường phía trước, nhưng không biết bên trái có gì, nên "vòng sang trái" là đánh cược. Trên SITL lidar 360° nhìn được hết nên thử thoải mái; đó là khác biệt then chốt.
- **`AVOID_MARGIN`, `AVOID_DIST_MAX`, `AVOID_BEHAVE`** — giải thích bằng hình: vùng nào bắt đầu phản ứng, vùng nào dừng hẳn; Stop khác Slide ra sao.
- **Cửa sổ so sánh param của Mission Planner** — đọc thế nào, cột nào là giá trị cũ, dòng "không tìm thấy" nghĩa là gì.
- **Vì sao phải `reboot` sau `param set`** — một số param chỉ đọc lúc khởi động (đặc biệt `SERIAL*_PROTOCOL` và `*_TYPE` của cảm biến).
