# Phase 03: Học ArduPilot trên drone ảo

| Trạng thái | Phụ thuộc | Ước lượng | Cần phần cứng |
|---|---|---|---|
| chưa bắt đầu | Phase 02 | ~6 giờ | Không |

## Mục tiêu

Biến kiến thức lái drone từ "đọc trên mạng" thành "tay đã làm rồi". Sau phase này bạn tự tin đổi mode, arm, cất cánh, bay waypoint, gọi RTL, đọc và sửa lỗi pre-arm, vẽ mission trong Mission Planner, và mở được log chuyến bay — tất cả trên drone ảo.

Đây là **phase học, không phải phase code**. Sản phẩm của nó là kỹ năng cộng với một trang sổ tay ghi lại những gì bạn tự quan sát được. Phase 04 (param + tránh vật cản ảo) và Phase 21 (bay tự động từ web) đều giả định bạn đã thạo những thứ ở đây.

## Đầu vào cần có

Phải xong trước: **Phase 02** — `./scripts/run_sitl.sh` khởi động được SITL với đủ ba cửa sổ, và Mission Planner nối vào được.

Phải đọc trước:

- `SAFETY.md` — ba luật cứng. Đọc lại ngay cả khi đang bay ảo, vì thói quen hình thành từ đây.
- `plans/reports/260921-research-sitl-firmware-toolchain.md` §5 (công cụ xem log) — UAV Log Viewer, MAVExplorer, Mission Planner log review.

Phần mềm: Mission Planner, SITL trong WSL, trình duyệt (cho UAV Log Viewer — không cần cài gì).

## File và thư mục sở hữu

Tạo mới:

- `logs/sitl/.gitkeep` — chỗ để copy file log về xem. Bản thân file `.BIN` vẫn bị `.gitignore` chặn, đó là cố ý.
- `docs/so-tay/03-hoc-ardupilot-drone-ao.md` — phase này **điền nội dung thật**, không để "chưa viết", vì đây là nơi ghi lại quan sát của chính bạn (các dòng `PreArm:` gặp được, ảnh chụp màn hình, câu trả lời tự luận).

Sửa:

- `plans/PROGRESS.md` — tick checkbox mục Phase 03.

**Không đụng:** `backend/`, `frontend/`, `ml/`, `firmware/`, `scripts/`, `plans/reports/`. Đặc biệt **không sửa `firmware/ardupilot/params/`** — việc nạp param vào SITL là của Phase 04.

## Việc theo thứ tự

### 03.1 Hai bàn điều khiển cùng nhìn một con drone

Bạn có hai "bảng điều khiển" cho cùng một drone ảo. MAVProxy là dòng lệnh: gõ chữ, chính xác, chép lại được. Mission Planner là đồ hoạ: nhìn trực quan, nhưng nhiều nút đến mức choáng. Dùng cả hai ngay từ đầu để biết cái nào mạnh ở đâu.

Chạy ở **bash trong WSL**:

```bash
cd /mnt/d/Coding/IOT-CV
./scripts/run_sitl.sh
```

Rồi mở Mission Planner trên Windows → `UDP` → `CONNECT` → cổng `14550`.

Trong cửa sổ MAVProxy (cái có dấu nhắc `STABILIZE>`), gõ từng lệnh và **nhìn cả hai màn hình sau mỗi lệnh**:

```
status
mode
param show ARMING_CHECK
param show RTL_ALT_M
wp list
```

Kết quả mong đợi:

- `status` in một khối dữ liệu (mode, arm state, vị trí, pin giả).
- `mode` in mode hiện tại, ví dụ `STABILIZE`.
- `param show RTL_ALT_M` in một dòng dạng `RTL_ALT_M 15.0` (đơn vị **mét**).
  > **Đã sửa 22/09/2026.** Bản trước ghi `RTL_ALT` đơn vị centimet (`1500.0`).
  > Liệt kê cả 1370 tham số của ArduCopter 4.7.1 trên SITL: `RTL_ALT` **không
  > còn tồn tại**. ArduPilot 4.7 đổi sang hậu tố đơn vị SI — nhóm RTL nay là
  > `RTL_ALT_M`, `RTL_ALT_FINAL_M`, `RTL_CLIMB_MIN_M`, `RTL_SPEED_MS`.
  > Bằng chứng: `scripts/sitl/run_rtl_alt.py`, chạy được với cả hai tên.
- `wp list` in `Requesting 0 waypoints` (chưa có mission nào).
- Mission Planner hiện cùng thông tin trên HUD.

Nếu lỗi:

1. **Gõ gì cũng không phản hồi** → bạn đang gõ vào cửa sổ `Console` (chỉ để xem). Cửa sổ đúng có dấu nhắc `STABILIZE>` hoặc tên mode hiện tại.
2. **`param show` báo `Unable to find parameter`** → tên sai. Tìm bằng ký tự đại diện: `param show RTL*`, `param show ARM*`.
3. **Mission Planner nối được nhưng số liệu không khớp MAVProxy** → bạn đang nối vào một SITL khác còn sót từ lần chạy trước. Đóng hết cửa sổ SITL cũ (`pkill -f sim_vehicle` trong WSL) rồi chạy lại.

### 03.2 Arm, pre-arm check, và cách đọc một dòng từ chối

ArduPilot có hàng chục điều kiện kiểm tra trước khi cho quay cánh. Lần `arm` đầu tiên rất có thể bị từ chối — **đó là điều tốt**. Biết đọc dòng từ chối là kỹ năng quan trọng nhất của cả phase này, và nó sẽ cứu bạn ở Phase 19 khi drone thật đã có cánh.

```
arm throttle
```

Nếu bị từ chối, MAVProxy in một dòng bắt đầu bằng `PreArm:` — ví dụ `PreArm: Need 3D Fix`, `PreArm: Compass not calibrated`, `PreArm: Throttle below failsafe`. Mission Planner hiện cùng dòng đó ở tab `Messages`.

**Bài tập bắt buộc: gây ra ít nhất 3 lỗi pre-arm khác nhau rồi tự sửa được cả 3.** Vài cách gây lỗi an toàn (chạy trong MAVProxy):

```
param set ARMING_CHECK 1        # bat TAT CA kiem tra (mac dinh cua SITL co the loi mot so)
param set GPS_TYPE 0            # tat GPS gia -> EKF khong hoi tu -> "Need 3D Fix"
param set GPS_TYPE 1            # bat lai
param set FENCE_ENABLE 1        # them dieu kien fence
param set FENCE_ENABLE 0
rc 3 1800                       # day ga len cao -> "Throttle too high"
rc 3 1000                       # ha ga ve thap
```

Chép **nguyên văn** cả 3 dòng `PreArm:` bạn gặp vào `docs/so-tay/03-hoc-ardupilot-drone-ao.md`, kèm một câu bạn tự viết giải thích vì sao ArduPilot từ chối.

⚠️ **Luật không thương lượng:** không bao giờ "tắt hết `ARMING_CHECK` cho nhanh". Trên SITL nó chỉ làm bạn mất cơ hội học; trên drone thật nó là cách người ta làm gãy drone. Thói quen hình thành từ đây.

Kết quả mong đợi: `arm throttle` cuối cùng in `ARMED`; bạn có 3 dòng `PreArm:` khác nhau đã chép lại và hiểu.

Nếu lỗi:

1. **Arm được ngay lần đầu, không gặp lỗi nào** → tốt, nhưng vẫn phải làm bài tập: dùng các lệnh gây lỗi ở trên.
2. **`param set ARMING_CHECK 1` xong không arm được nữa, không biết sửa** → `param set ARMING_CHECK 0` để quay lại (chỉ trên SITL trong bài tập này; KHÔNG BAO GIỜ trên bo thật), rồi bật lại từng bit một. Hoặc khởi động SITL với cờ `-w` để xoá sạch param về mặc định.
3. **`rc 3 1000` xong vẫn báo throttle** → cần `rc 3 1000` **rồi** đợi 1–2 giây; SITL đọc kênh RC theo chu kỳ.

### 03.3 Bảy chế độ bay, làm từng cái một

Đây là phần học chính. Mỗi mode làm **ít nhất 2 lần** cho tới khi không cần nhìn ghi chú.

| Mode | Nó làm gì (nói như với người chưa biết) | Cách thử trên SITL |
|---|---|---|
| `STABILIZE` | Bạn lái hoàn toàn bằng tay, máy chỉ giữ cho nó không lật. Buông cần thì nó vẫn trôi | `mode stabilize` rồi `rc 3 1600` (đẩy ga) |
| `ALT_HOLD` | Giữ nguyên độ cao, bạn chỉ lo hướng và vị trí | `mode althold`, `rc 3 1500` (ga giữa = giữ cao) |
| `LOITER` | Đứng yên một chỗ trên không, tự chống gió. Cần GPS tốt | `mode loiter`, buông cần, drone đứng im trên Map |
| `GUIDED` | Máy tính ra lệnh "bay tới toạ độ này". **Đây là mode website của bạn sẽ dùng** | `mode guided`, `takeoff 20`, rồi chuột phải trên Map → `Fly To` |
| `AUTO` | Chạy trọn một danh sách waypoint đã nạp sẵn xuống drone | Việc 03.4 |
| `RTL` | Tự leo lên `RTL_ALT` rồi bay về điểm cất cánh và hạ | `mode rtl` |
| `LAND` | Hạ ngay tại chỗ đang đứng, không bay đi đâu | `mode land` |

Chuỗi bài tập đầy đủ, gõ trong **MAVProxy**:

```
mode guided
arm throttle
takeoff 30
mode loiter
rc 2 1400
rc 2 1500
rc 1 1600
rc 1 1500
mode althold
mode rtl
```

(`rc 1` là kênh roll — nghiêng trái/phải. `rc 2` là kênh pitch — chúi trước/sau. `1500` là giữa, tức buông cần.)

Sau `mode rtl`, theo dõi: máy bay tự leo, bay về, hạ, rồi `DISARMED`.

> **Đã sửa 22/09/2026.** Bản trước viết "mode phải tự chuyển sang `LAND` rồi
> `DISARMED`". Đo thật trên ArduCopter 4.7.1: mode **vẫn là `RTL`** suốt quá
> trình hạ — RTL tự hạ trong chính nó, không đổi sang `LAND`. Chờ `LAND` là
> chờ mãi (đã treo hết 180 s). STATUSTEXT quan sát được:
> `SIM Hit ground at 0.50 m/s` → `Disarming motors`.
> Muốn thử mode `LAND` thì phải gọi `mode land` riêng.
> Bằng chứng: `scripts/sitl/run_mode_chain.py`.

Ba param cần hiểu ngay ở bước này. Xem bằng `param show`, đổi bằng `param set`, rồi **bay lại và cảm nhận khác biệt**:

- `RTL_ALT_M` — RTL leo lên độ cao nào trước khi bay về (đơn vị **mét** trên 4.7+;
  firmware cũ là `RTL_ALT`, cm). Đặt thấp quá thì về đụng cây. Lưu ý: đây là độ
  cao **tối thiểu**, không phải bắt buộc — đang bay cao hơn thì nó không hạ xuống.
- `WPNAV_SPEED` — tốc độ bay giữa các waypoint (cm/s).
- `LAND_SPEED` — tốc độ hạ ở đoạn cuối (cm/s). Nhanh quá thì đập đất.

Bài tập: đổi `RTL_ALT_M` từ mặc định `15` sang `50`, bay lại, **mô tả bằng lời**
sự khác biệt quan sát được vào sổ tay. Số đo đối chiếu (chạy
`scripts/sitl/run_rtl_alt.py`): cất cánh 20 m rồi RTL — ở `15` đỉnh đạt **20,0 m**
(không leo, vì đã cao hơn ngưỡng); ở `50` đỉnh đạt **50,0 m**. Chênh **30,0 m**.

Kết quả mong đợi: đổi được cả 7 mode; drone trên Map phản ứng đúng mô tả ở cột giữa; `mode rtl` luôn đưa nó về đúng điểm xuất phát.

Nếu lỗi:

1. **`takeoff 30` không làm gì** → chưa `arm throttle`, hoặc không ở `GUIDED`. `takeoff` chỉ chạy ở GUIDED (và trong mission AUTO).
2. **`mode loiter` bị từ chối** → EKF chưa có vị trí đủ tốt. Đợi thêm 30 giây; `status` cho thấy trạng thái GPS.
3. **Drone bay lên rồi rơi tự do** → bạn đang ở `STABILIZE` mà cần ga về 1000. Về `ALT_HOLD` và đặt `rc 3 1500`.
4. **`rc 2 1400` làm drone bay mãi không dừng** → bạn quên trả cần về giữa. `rc 2 1500`. Hoặc `mode loiter` lại để nó tự phanh.

### 03.4 Vẽ và chạy một mission từ Mission Planner

Đây là bài tập cho AUTO mode, và là bản mẫu cho tính năng mission editor của website ở Phase 09.

Trong **Mission Planner**:

1. Sang tab `PLAN` (một số bản ghi là `FLIGHT PLAN`).
2. Click chuột trái trên bản đồ 4–5 lần để đặt waypoint. Mỗi lần click thêm một dòng vào bảng bên dưới.
3. Dòng **đầu tiên**: đổi cột lệnh thành `TAKEOFF`, đặt `Alt` = 20.
4. Các dòng giữa: để `WAYPOINT`, `Alt` = 20.
5. Dòng **cuối**: đổi thành `RTL`.
6. Bấm `Write` — ghi mission xuống drone ảo.
7. Bấm `Read` — đọc ngược lại. Bảng phải trùng khít với cái bạn vừa vẽ.

Quay lại tab `DATA`:

8. `Actions` → `Arm/Disarm`.
9. Đổi mode sang `AUTO` (ô chọn mode ở panel `Actions`, hoặc gõ `mode auto` trong MAVProxy).

Đối chiếu bằng MAVProxy:

```
wp list
```

Nó in ra đúng mission vừa nạp. **Lệnh này quan trọng cho sau này**: Phase 07 sẽ tự viết luồng upload mission ở backend (giao thức `MISSION_COUNT` / `MISSION_REQUEST_INT` / `MISSION_ITEM_INT` / `MISSION_ACK`), và bạn cần biết kết quả đúng trông như thế nào để so sánh.

**Bài tập thêm:** cố tình đặt một waypoint có `Alt` = 3 m rồi chạy, xem ArduPilot xử lý ra sao. Ghi lại — Phase 07 sẽ phải chặn những mission như thế ở phía backend trước khi upload.

Kết quả mong đợi: drone ảo bay hết 4–5 waypoint theo đúng thứ tự rồi RTL và hạ; `wp list` khớp với bảng trong Mission Planner.

Nếu lỗi:

1. **`Write` báo timeout** → mất gói UDP; nối lại bằng TCP cổng `5760`.
2. **AUTO không chạy, drone đứng yên trên mặt đất** → chưa arm, hoặc waypoint đầu không phải `TAKEOFF` (bắt buộc khi cất cánh từ mặt đất).
3. **Drone bay tới waypoint đầu rồi đứng im** → `WPNAV_RADIUS` quá nhỏ nên nó không bao giờ tính là "đã tới nơi". `param set WPNAV_RADIUS 200` (cm).

### 03.5 Tải và đọc log của chuyến bay ảo

Mọi chuyến bay — ảo hay thật — đều ghi log vào bộ nhớ. Biết đọc log là cách **duy nhất** trả lời câu "vì sao nó lại làm thế" sau khi đã hạ cánh. Ở Phase 20 mỗi bài bay thật đều kết thúc bằng một lần đọc log, nên tập từ bây giờ.

Tìm và copy file log — chạy ở **bash trong WSL**:

```bash
ls -lt ~/ardupilot/ArduCopter/logs/ | head
mkdir -p /mnt/d/Coding/IOT-CV/logs/sitl
cp ~/ardupilot/ArduCopter/logs/00000001.BIN /mnt/d/Coding/IOT-CV/logs/sitl/
```

(Số thứ tự file tăng theo mỗi lần bay; `ls -lt` xếp mới nhất lên đầu — lấy tên thật từ đó.)

Mở **UAV Log Viewer**: <https://plotbeta.ardupilot.org/> — là web, không cần cài gì. Kéo thả file `.BIN` vào trang.

**Bốn thứ phải tự tìm được trong log của chính mình:**

| Cần tìm | Tên trường trong log | Đối chiếu với |
|---|---|---|
| Đồ thị độ cao | `CTUN.Alt` hoặc `BARO.Alt` | lệnh `takeoff 30` bạn đã gõ |
| Các lần đổi mode | `MODE` | chuỗi GUIDED → LOITER → ALT_HOLD → RTL |
| Thông báo và cảnh báo | `MSG` | dòng `PreArm:` gặp ở việc 03.2 |
| Trạng thái GPS/EKF | `GPS`, `XKF*` | lúc `mode loiter` bị từ chối |

Công cụ thay thế: **MAVExplorer** (đi kèm MAVProxy, mạnh hơn, vẽ nhiều biến cùng lúc, script hoá được) và **Mission Planner** tab `DataFlash Log Review` (tải log thẳng từ drone qua USB — sẽ dùng từ Phase 20).

⚠️ File `.BIN` **bị `.gitignore` chặn** (luật `*.BIN` toàn repo). Đó là cố ý: log bay nặng và không phải mã nguồn. Copy vào `logs/sitl/` chỉ để bạn xem — **đừng `git add -f`**.

Kết quả mong đợi: mở được log trên UAV Log Viewer và chỉ ra được cả 4 thứ ở bảng trên.

Nếu lỗi:

1. **Thư mục `logs/` trống** → SITL chỉ ghi log khi đã arm ít nhất một lần (trừ khi `LOG_DISARMED=1`). Bay lại một vòng có arm.
2. **UAV Log Viewer không mở được file** → file đang được ghi dở vì SITL vẫn chạy. Thoát `sim_vehicle.py` rồi copy lại.
3. **File `.BIN` quá lớn, trang treo** → bay ngắn hơn, hoặc dùng MAVExplorer thay thế.

### 03.6 Bài tập tự làm — checklist cho người mới

Làm hết **bằng tay**, không nhờ ai làm hộ, không chép kết quả của người khác. Tick từng dòng vào `docs/so-tay/03-hoc-ardupilot-drone-ao.md`:

- [ ] Khởi động SITL và nối Mission Planner vào **3 lần liên tiếp mà không cần xem lại hướng dẫn**.
- [ ] Gây ra **3 lỗi pre-arm khác nhau** và tự sửa được cả 3. Chép nguyên văn cả 3 dòng lỗi vào sổ tay, kèm một câu giải thích mỗi dòng.
- [ ] Cất cánh, giữ độ cao 20 m, bay một hình vuông cạnh ~50 m ở LOITER bằng lệnh `rc`, rồi RTL. Làm **2 lần**.
- [ ] Đổi `RTL_ALT` từ mặc định sang 50 m, bay lại, **mô tả bằng lời** sự khác biệt quan sát được.
- [ ] Vẽ và chạy trọn một mission 5 waypoint kết thúc bằng RTL; `wp list` khớp với bảng Mission Planner.
- [ ] Thử một mission có waypoint `Alt` = 3 m, ghi lại ArduPilot xử lý thế nào.
- [ ] Mở log của chuyến bay đó trên UAV Log Viewer, chỉ ra được đồ thị độ cao và các lần đổi mode.
- [ ] Giải thích được **bằng lời của mình, không nhìn tài liệu**: *GUIDED khác AUTO ở chỗ nào, và vì sao website sẽ dùng GUIDED chứ không dùng AUTO để lái tay.*
- [ ] Đọc lại `SAFETY.md` và nói được ba luật cứng.

Đáp án cho gạch đầu dòng áp chót (để tự chấm sau khi đã tự trả lời):

> **AUTO** chạy một danh sách waypoint **đã nạp sẵn xuống flight controller** — nạp xong thì trạm mặt đất rút đi cũng không sao, drone vẫn bay hết mission. **GUIDED** thì mỗi lệnh "bay tới đây" do trạm mặt đất gửi liên tục; mất kết nối là mất lệnh.
>
> Website dùng GUIDED vì điều khiển tay theo thời gian thực cần đúng tính chất đó. Và chính vì tính chất đó mà Phase 06 bắt buộc phải có cơ chế **dead-man**: nếu backend ngừng nhận lệnh từ trình duyệt quá 300 ms thì tự gửi lệnh vận tốc bằng 0, để mất mạng không thành mất kiểm soát.

Nếu bạn chưa tự trả lời được câu đó, **phase này chưa xong** — quay lại việc 03.3 và bay thêm.

## Cổng pass

- [ ] Bay trọn chuỗi trên SITL không crash: `GUIDED` cất cánh → `LOITER` bay tay → `ALT_HOLD` → `RTL` về và `DISARMED`.
- [ ] Chạy được một mission 5 waypoint (`TAKEOFF` → 3 `WAYPOINT` → `RTL`) ở mode `AUTO`, vẽ từ Mission Planner; `wp list` trong MAVProxy khớp với bảng.
- [ ] Có **3 dòng `PreArm:` khác nhau** chép nguyên văn vào `docs/so-tay/03-hoc-ardupilot-drone-ao.md`, mỗi dòng kèm một câu giải thích tự viết.
- [ ] Mở được một file log `.BIN` của SITL trên UAV Log Viewer và chỉ ra được đồ thị độ cao **và** các lần đổi mode.
- [ ] 9 dòng checklist ở việc 03.6 tick hết.
- [ ] Trả lời được bằng lời của mình câu "GUIDED khác AUTO ở chỗ nào, và vì sao web dùng GUIDED" — viết câu trả lời đó vào sổ tay **trước** khi đọc đáp án.
- [ ] `logs/sitl/.gitkeep` đã commit; không có file `.BIN` nào lọt vào git (`git log --stat` không chứa `.BIN`).
- [ ] `plans/PROGRESS.md` mục Phase 03 đã tick và commit.

## Rủi ro

| Rủi ro | Khả năng (1-5) | Ảnh hưởng (1-5) | Điểm | Xử lý |
|---|---|---|---|---|
| Học "xong" nhưng thật ra chỉ chép lệnh; tới drone thật ở Phase 20 thì lúng túng | 4 | 4 | **16** | Bắt buộc làm việc 03.6 bằng tay, đủ số lần lặp; câu tự luận GUIDED/AUTO là chốt chặn — không tự trả lời được thì phase chưa xong |
| Quen tay bỏ qua lỗi pre-arm trên SITL → hình thành thói quen nguy hiểm cho drone thật | 3 | 5 | **15** | Không bao giờ tắt `ARMING_CHECK` cho nhanh; bài tập 03.2 cố tình bắt đọc và sửa từng lỗi; ghi luật này vào sổ tay bằng chữ in đậm |
| Nghịch param làm SITL không arm được nữa, mất thời gian gỡ | 3 | 2 | 6 | `param set <ten> <gia tri cu>` để quay lại; hoặc chạy SITL với cờ `-w` để xoá sạch param về mặc định. Phase 04 sẽ dạy cách lưu snapshot trước khi đổi |
| Bay ảo quá nhiều giờ mà không ghi chép gì → kiến thức bay hơi sau một tuần | 3 | 3 | 9 | Sổ tay `03-*.md` là **sản phẩm bắt buộc** của phase, không phải tuỳ chọn; cổng pass kiểm nội dung thật (3 dòng PreArm, câu tự luận) |
| Copy log `.BIN` rồi cố `git add -f`, đẩy file nặng lên repo | 2 | 3 | 6 | `.gitignore` đã chặn `*.BIN`; việc 03.5 nói rõ; cổng pass kiểm `git log --stat` |
| Hai phiên SITL cùng chạy → Mission Planner nối nhầm, số liệu không khớp | 3 | 2 | 6 | `pkill -f sim_vehicle` trong WSL trước mỗi lần khởi động lại |
| Mission Planner phiên bản khác nhau đặt tên tab khác (`PLAN` / `FLIGHT PLAN`) → không tìm thấy nút | 3 | 1 | 3 | Đã ghi cả hai tên ở 03.4; nếu vẫn lạc, mọi thao tác mission đều làm được bằng MAVProxy (`wp load`, `wp list`) |

## Timeline

| Việc | Giờ | Ghi chú |
|---|---|---|
| 03.1 Hai bàn điều khiển | 0,75 | |
| 03.2 Arm + pre-arm check | 1,25 | Gồm gây và sửa 3 lỗi |
| 03.3 Bảy chế độ bay | 2,0 | Phần học chính, đừng vội |
| 03.4 Mission từ Mission Planner | 1,0 | |
| 03.5 Đọc log | 0,75 | |
| 03.6 Checklist + viết sổ tay | 0,25 | Phần lớn đã làm lồng trong 03.1–03.5 |
| **Tổng** | **6,0** | Có thể chia thành 2–3 buổi; học dồn một buổi không hiệu quả |

## Ghi chú cho sổ tay

`docs/so-tay/03-hoc-ardupilot-drone-ao.md` là trang sổ tay **duy nhất được viết ngay trong phase của nó** (các trang khác viết sau), vì nó chứa quan sát của chính bạn. Cần có:

- **Mode bay là gì** — vì sao một con drone cần tới bảy "chế độ"; cách hiểu trục chính: máy giữ giùm bao nhiêu phần (STABILIZE ít nhất → LOITER nhiều nhất); bảng ở việc 03.3 nên đưa nguyên vào.
- **GUIDED khác AUTO thế nào, và vì sao điều đó quyết định thiết kế website** — dẫn thẳng sang khái niệm dead-man ở Phase 06. Đây là ý quan trọng nhất của cả trang.
- **Arm / disarm là gì, pre-arm check là gì** — vì sao ArduPilot từ chối quay cánh; cách đọc một dòng `PreArm:`; **vì sao không bao giờ tắt `ARMING_CHECK` cho nhanh** (viết in đậm).
- **Ba dòng `PreArm:` của chính bạn** — nguyên văn, kèm giải thích tự viết.
- **Param là gì (mức nhập môn)** — hàng nghìn công tắc nhỏ trong flight controller; ba cái đã nghịch (`RTL_ALT`, `WPNAV_SPEED`, `LAND_SPEED`) và cảm nhận khác biệt; đơn vị hay gây nhầm (cm so với m).
- **EKF là gì (mức rất nông)** — bộ lọc gộp GPS + gia tốc kế + la bàn thành một ước lượng vị trí; vì sao phải "đợi EKF hội tụ" mới arm được ở LOITER.
- **Waypoint và mission** — mission là danh sách lệnh nạp xuống flight controller; `TAKEOFF` phải là lệnh đầu khi cất từ mặt đất; vì sao `wp list` là cách kiểm chứng đáng tin hơn nhìn màn hình.
- **Log bay** — `.BIN` là gì, ghi lúc nào, đọc ở đâu (UAV Log Viewer là đường dễ nhất cho người mới); bốn thứ cơ bản phải tìm được và tên trường tương ứng; vì sao log không commit vào git.
- **Lệnh `rc N <giá trị>`** — mô phỏng việc đẩy cần trên tay điều khiển; `1500` là giữa; kênh 1 = roll, 2 = pitch, 3 = throttle, 4 = yaw. Người mới hay quên trả cần về giữa.
