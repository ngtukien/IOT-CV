# Sổ tay 03-hoc-ardupilot-drone-ao

Trang này ghi lại những gì học được khi lái drone ảo trên SITL. Phần lớn cơ học
(đổi mode, bay mission, đọc log) do `scripts/sitl/` chạy tự động. Trang này chỉ
giữ phần kiến thức và những quan sát bắt buộc phải tự tay làm.

## 1. Mode bay là gì

Một con drone không có một cách bay duy nhất. Tuỳ tình huống, bạn muốn máy tự lo
nhiều hay ít việc khác nhau: lúc test ở gần thì muốn tự lái hoàn toàn, lúc bay xa
lại muốn nó tự giữ vị trí để rảnh tay quan sát. ArduPilot gói mỗi kiểu hành vi đó
thành một "mode" (chế độ bay), và bạn đổi qua lại giữa chúng ngay khi đang bay.

Cách dễ nhớ nhất: xếp bảy mode theo một trục duy nhất, **máy giữ giùm bao nhiêu
phần**. Một đầu là `STABILIZE`, máy chỉ giữ cho khỏi lật, mọi thứ khác bạn tự lo.
Đầu kia là `LOITER`, máy tự đứng yên một chỗ, chống gió, giữ cao. Bạn gần như
không phải làm gì nếu buông hết cần.

| Mode | Nó làm gì (nói như với người chưa biết) | Cách thử trên SITL |
|---|---|---|
| `STABILIZE` | Bạn lái hoàn toàn bằng tay, máy chỉ giữ cho nó không lật. Buông cần thì nó vẫn trôi | `mode stabilize` rồi `rc 3 1600` (đẩy ga) |
| `ALT_HOLD` | Giữ nguyên độ cao, bạn chỉ lo hướng và vị trí | `mode althold`, `rc 3 1500` (ga giữa = giữ cao) |
| `LOITER` | Đứng yên một chỗ trên không, tự chống gió. Cần GPS tốt | `mode loiter`, buông cần, drone đứng im trên Map |
| `GUIDED` | Máy tính ra lệnh "bay tới toạ độ này". **Đây là mode website của bạn sẽ dùng** | `mode guided`, `takeoff 20`, rồi chuột phải trên Map → `Fly To` |
| `AUTO` | Chạy trọn một danh sách waypoint đã nạp sẵn xuống drone | Vẽ mission trong Mission Planner rồi `mode auto` |
| `RTL` | Tự leo lên `RTL_ALT_M` rồi bay về điểm cất cánh và hạ | `mode rtl` |
| `LAND` | Hạ ngay tại chỗ đang đứng, không bay đi đâu | `mode land` |

## 2. GUIDED khác AUTO thế nào, và vì sao điều đó quyết định thiết kế website

**Tự viết câu trả lời của bạn vào ô dưới đây, trước khi đọc phần đáp án bên
dưới đường kẻ.** Đây là bài tập bắt buộc của Phase 03. Cổng pass yêu cầu bạn tự
giải thích được bằng lời của mình.

> <!-- bạn điền: câu trả lời của bạn. GUIDED khác AUTO ở chỗ nào, và vì sao website sẽ dùng GUIDED chứ không dùng AUTO để lái tay -->

---

### Đáp án (chỉ đọc sau khi đã tự viết ở trên)

**AUTO** chạy một danh sách waypoint **đã nạp sẵn xuống flight controller**. Nạp
xong thì trạm mặt đất (Mission Planner, hay sau này là website) có rút đi cũng
không sao, drone vẫn tự bay hết mission, vì toàn bộ lệnh đã nằm trong bộ nhớ
của flight controller rồi.

**GUIDED** thì ngược lại: mỗi lệnh "bay tới đây" do trạm mặt đất gửi liên tục,
gần như theo thời gian thực. Không có lệnh mới thì drone không biết phải làm
gì tiếp theo. Mất kết nối là mất lệnh.

Website dùng GUIDED vì điều khiển tay theo thời gian thực (người dùng bấm nút,
kéo cần trên trình duyệt) cần đúng tính chất đó: mỗi thao tác của người dùng
phải chuyển ngay thành một lệnh gửi xuống drone. AUTO không làm được việc này,
vì nó được thiết kế cho một kịch bản đã biết trước, không phải cho một người
đang lái theo thời gian thực.

Và chính vì GUIDED phụ thuộc vào việc "có lệnh mới liên tục" mà Phase 06 bắt
buộc phải có cơ chế **dead-man**: nếu backend ngừng nhận lệnh từ trình duyệt quá
300 ms (ví dụ người dùng đóng tab, hoặc mất mạng), backend phải tự gửi lệnh vận
tốc bằng 0 xuống drone. Không được đợi trình duyệt gửi lệnh dừng, vì lúc đó có
thể trình duyệt đã không còn gửi được gì nữa. Nhờ vậy mất mạng chỉ làm drone
đứng yên tại chỗ, không phải mất kiểm soát.

## 3. Arm/disarm, pre-arm check

"Arm" là bước bật động cơ, cho cánh quạt sẵn sàng quay khi có lệnh ga. Trước
khi cho arm, ArduPilot tự chạy hàng chục điều kiện kiểm tra gọi là **pre-arm
check**: GPS có fix chưa, la bàn đã hiệu chỉnh chưa, RC có tín hiệu không, EKF
đã hội tụ chưa, và nhiều điều kiện khác. Bất kỳ điều kiện nào chưa đạt thì lệnh
`arm` bị từ chối.

Khi bị từ chối, MAVProxy in một dòng bắt đầu bằng `PreArm:`, ví dụ
`PreArm: Need 3D Fix` hoặc `PreArm: Compass not calibrated`. Mission Planner
hiện cùng dòng đó ở tab `Messages`. Cách đọc: phần sau dấu hai chấm chính là lý
do thật, không phải lỗi ngẫu nhiên, mà ArduPilot đang nói đúng thứ nó chưa sẵn
sàng.

**Không bao giờ tắt `ARMING_CHECK` cho nhanh.** Trên SITL việc này chỉ làm bạn
mất cơ hội học cách đọc và sửa lỗi thật. Trên drone thật, đó là cách người ta
làm gãy drone. Pre-arm check tồn tại chính là để chặn những chuyến bay sẽ hỏng
ngay từ lúc cất cánh. Thói quen đọc và sửa lỗi, thay vì tắt cảnh báo, phải hình
thành từ đây.

## 4. Ba dòng `PreArm:` của chính bạn

Gây ra ít nhất 3 lỗi pre-arm khác nhau, tự sửa được cả 3, rồi chép **nguyên
văn** vào đây, kèm một câu bạn tự viết giải thích vì sao ArduPilot từ chối.

> Lỗi 1: <!-- bạn điền: nguyên văn dòng PreArm: đầu tiên -->
>
> Giải thích: <!-- bạn điền: vì sao ArduPilot từ chối -->

> Lỗi 2: <!-- bạn điền: nguyên văn dòng PreArm: thứ hai -->
>
> Giải thích: <!-- bạn điền: vì sao ArduPilot từ chối -->

> Lỗi 3: <!-- bạn điền: nguyên văn dòng PreArm: thứ ba -->
>
> Giải thích: <!-- bạn điền: vì sao ArduPilot từ chối -->

## 5. Param là gì (nhập môn)

Flight controller lưu hành vi bay bằng hàng nghìn "param": mỗi param là một
công tắc hoặc một con số điều chỉnh một hành vi cụ thể. Ba param đầu tiên cần
biết:

- `RTL_ALT_M`: khi gọi RTL, drone leo lên **tối thiểu** độ cao này trước rồi
  mới bay về điểm cất cánh. Đặt thấp quá thì trên đường về có thể đụng cây
  hoặc vật cản. Đang bay cao hơn ngưỡng thì nó không leo thêm (xem mục 10).
- `WPNAV_SPEED`: tốc độ bay giữa các waypoint trong mission hoặc GUIDED.
- `LAND_SPEED`: tốc độ hạ ở đoạn cuối cùng khi tiếp đất. Nhanh quá thì đập đất.

**Bẫy đơn vị:** nhiều param về độ cao và tốc độ dùng đơn vị **centimet**, không
phải mét, nên một con số lớn bất thường thì việc đầu tiên là kiểm tra đơn vị.
Nhưng ArduPilot 4.7 đã chuyển dần sang **hậu tố SI tường minh**: `_M` là mét,
`_MS` là mét trên giây. `RTL_ALT_M = 15` nghĩa là 15 mét, không phải 15 cm.
Gặp một tên param đọc trên mạng mà firmware không nhận, đọc mục 10 trước khi
kết luận mình gõ sai.

## 6. EKF là gì (rất nông)

EKF (Extended Kalman Filter) là bộ lọc gộp nhiều nguồn dữ liệu (GPS, gia tốc
kế, la bàn, khí áp) thành một ước lượng duy nhất về vị trí và tốc độ của drone.
Không có bộ lọc này, mỗi cảm biến riêng lẻ đều nhiễu và không đủ tin cậy để bay.

Ngay sau khi khởi động, EKF cần vài giây đến vài chục giây để "hội tụ", tức là
đủ dữ liệu để ước lượng ổn định. Đó là lý do `mode loiter` (và nhiều mode khác
dựa vào vị trí GPS) có thể bị từ chối ngay sau khi vừa bật SITL: không phải lỗi,
chỉ là EKF chưa kịp hội tụ. Đợi thêm rồi thử lại.

## 7. Waypoint và mission

Một "mission" là một danh sách lệnh (chủ yếu là toạ độ waypoint) được nạp xuống
flight controller, để nó tự chạy khi ở mode `AUTO`. Khi cất cánh từ mặt đất,
lệnh đầu tiên trong mission **bắt buộc phải là `TAKEOFF`**. Nếu không, drone sẽ
không tự cất cánh được dù mission có đủ waypoint phía sau.

Sau khi ghi (`Write`) một mission xuống drone, cách kiểm tra đáng tin nhất không
phải là nhìn bảng trên Mission Planner, mà là gõ `wp list` trong MAVProxy. Bảng
trên Mission Planner là những gì bạn *vừa vẽ*; `wp list` là những gì flight
controller *thật sự đang giữ*. Hai thứ này có thể lệch nhau nếu lệnh ghi bị mất
gói giữa chừng, nên `wp list` mới là nguồn sự thật cuối cùng.

## 8. Log bay

Mọi chuyến bay đều tự động ghi vào một file `.BIN`. Đọc lại log là cách duy nhất
trả lời câu "vì sao nó lại làm thế" sau khi đã hạ cánh. Không có cách nào khác
để biết chính xác drone đã ở mode gì, độ cao bao nhiêu, và gặp cảnh báo gì tại
từng thời điểm.

Công cụ dễ nhất cho người mới là **UAV Log Viewer** (`https://plotbeta.ardupilot.org/`),
chạy trên trình duyệt, không cần cài gì, kéo thả file `.BIN` vào là xem được.
Bốn thứ cơ bản cần tìm được trong bất kỳ log nào:

| Cần tìm | Tên trường trong log | Đối chiếu với |
|---|---|---|
| Đồ thị độ cao | `CTUN.Alt` hoặc `BARO.Alt` | lệnh `takeoff` đã gõ |
| Các lần đổi mode | `MODE` | chuỗi mode đã bay qua |
| Thông báo và cảnh báo | `MSG` | các dòng `PreArm:` gặp phải |
| Trạng thái GPS/EKF | `GPS`, `XKF*` | lúc lệnh đổi mode bị từ chối |

File `.BIN` **không commit vào git**. Luật `*.BIN` trong `.gitignore` chặn toàn
repo. Log bay nặng và không phải mã nguồn; copy vào `logs/sitl/` chỉ để xem tại
chỗ.

## 9. Lệnh `rc N <giá trị>`

Lệnh `rc N <giá trị>` mô phỏng việc đẩy cần trên tay điều khiển thật, gửi trực
tiếp một giá trị PWM cho kênh RC số N. `1500` luôn là **giữa**, tức buông cần
về vị trí trung lập. Bốn kênh dùng nhiều nhất:

- kênh 1 = roll (nghiêng trái/phải)
- kênh 2 = pitch (chúi trước/sau)
- kênh 3 = throttle (ga)
- kênh 4 = yaw (xoay quanh trục đứng)

Lỗi hay gặp nhất của người mới: đẩy một kênh (ví dụ `rc 2 1400` để bay tới) rồi
**quên trả về giữa**. Drone sẽ tiếp tục bay theo hướng đó mãi cho tới khi bạn gõ
`rc 2 1500`, hoặc chuyển sang `LOITER` để nó tự phanh lại.

## 10. Bộ script tự động trong `scripts/sitl/`

Phần cơ học lặp đi lặp lại do script chạy. Bạn vẫn nên tự bay một lần cho biết
cảm giác, nhưng không cần bay hai mươi lần để lấy số liệu.

Chạy **trong WSL**, bằng đúng python của venv (nó mới có `pymavlink`):

```bash
cd /mnt/d/Coding/IOT-CV
~/venv-ardupilot/bin/python3 scripts/sitl/run_mode_chain.py      # 7 mode
~/venv-ardupilot/bin/python3 scripts/sitl/run_rtl_alt.py         # RTL_ALT_M 15 vs 50
~/venv-ardupilot/bin/python3 scripts/sitl/run_mission_auto.py    # mission 5 waypoint
~/venv-ardupilot/bin/python3 scripts/sitl/run_mission_low_alt.py # waypoint thấp 3 m
~/venv-ardupilot/bin/python3 scripts/sitl/run_log_dump.py        # .BIN -> CSV
```

Mỗi script tự mở một phiên SITL riêng rồi tự tắt. Chúng **từ chối chạy** nếu đã
có SITL nào đang sống, để không giẫm lên phiên bạn đang mở tay bằng Mission
Planner. Nên chạy **lần lượt**, không chạy song song.

Mỗi script in một khối `## KET QUA` dạng bảng, và kết bằng `KET QUA: PASS` hoặc
`KET QUA: FAIL`. Mã thoát khác 0 khi hỏng — nghĩa là cắm được vào CI sau này.

### Ba chỗ tài liệu cũ nói sai, đo thật mới biết

Đây là phần đáng đọc nhất của mục này. Cả ba đều là loại sai *im lặng*: làm theo
thì hỏng, mà thông báo lỗi không chỉ vào nguyên nhân.

**1. `RTL_ALT` không còn tồn tại.** Tài liệu cũ (và rất nhiều hướng dẫn trên
mạng) bảo đặt `RTL_ALT` bằng centimet, ví dụ `5000` cho 50 m. Trên ArduCopter
4.7.1 tham số đó **đã bị xoá**. Liệt kê cả 1370 tham số của flight controller,
nhóm `RTL*` chỉ còn:

```text
RTL_ALT_M = 15.0        <- thay cho RTL_ALT, đơn vị MÉT
RTL_ALT_FINAL_M · RTL_CLIMB_MIN_M · RTL_SPEED_MS
RTL_ALT_TYPE · RTL_CONE_SLOPE · RTL_LOIT_TIME · RTL_OPTIONS
```

ArduPilot 4.7 chuyển sang hậu tố đơn vị SI tường minh (`_M` = mét, `_MS` = m/s).
Đặt `RTL_ALT` trên firmware này thì flight controller **không báo lỗi gì cả** —
nó chỉ im lặng không bao giờ gửi xác nhận, và script ngồi chờ tới hết giờ.

**2. `RTL_ALT_M` là độ cao TỐI THIỂU, không phải độ cao bắt buộc.** Đo được:
cất cánh 20 m rồi gọi RTL — với `RTL_ALT_M = 15` đỉnh đạt **20,0 m**, tức là máy
bay **không leo** thêm; với `RTL_ALT_M = 50` đỉnh đạt **50,0 m**, tức nó phải leo
trước khi về. Chênh nhau 30,0 m.

> Phép đo này là một giá trị **lớn nhất**, nên nó chỉ chứng minh được *"không
> leo"*. Nó **không** chứng minh được máy bay giữ nguyên 20 m suốt đường về —
> một cú tụt xuống 15 m giữa chừng rồi lên lại cũng cho cùng con số đỉnh 20,0 m.
> Muốn nói được điều đó thì phải đo giá trị **nhỏ nhất** trong đoạn bay về.

Ý nghĩa thực tế: đặt `RTL_ALT_M` thấp không *bắt* máy bay bay thấp — nó chỉ bỏ
ràng buộc phải leo. Lưu ý thêm: kết luận này đo ở cách home 60 m; bay về từ gần
home thì `RTL_CONE_SLOPE` xen vào và hình dạng đường về khác hẳn.

**3. RTL KHÔNG chuyển mode sang `LAND`.** Nhiều tài liệu (kể cả plan gốc của dự
án này) viết: sau `mode rtl`, theo dõi mode tự chuyển sang `LAND` rồi
`DISARMED`. Sai. Đo thật: mode **vẫn là `RTL`** suốt quá trình hạ cho tới lúc
disarm. RTL tự hạ bên trong chính nó. Chờ `LAND` là chờ mãi — script đầu tiên
của tôi treo trọn 180 giây ở đúng chỗ này. Thứ thật sự quan sát được:

```text
STATUSTEXT: SIM Hit ground at 0.50 m/s
STATUSTEXT: Disarming motors
```

Muốn thử mode `LAND` thì phải gọi `mode land` riêng.

### Một quy ước mission dễ vấp

**Item số 0 của mission là ô HOME, không phải một lệnh.** Nếu bạn đặt
`NAV_TAKEOFF` làm item đầu tiên, nó bị nuốt vào ô home và mission coi như không
có lệnh cất cánh. Vào `AUTO` từ dưới đất sẽ bị từ chối:

```text
Auto: Missing Takeoff Cmd
Mode change to Auto failed: init failed
```

Nên một mission "5 waypoint" thật ra nạp xuống **6 item**: 1 ô home + 5 lệnh.

Điều làm lỗi này khó tìm: nó **chỉ xảy ra khi vào AUTO từ dưới đất**. Nếu máy
bay đã ở trên không (cất cánh bằng GUIDED trước) thì ArduPilot bỏ qua kiểm tra
takeoff và AUTO vào bình thường — nên cùng một mission sai có thể lúc chạy được
lúc không, tuỳ bạn vào AUTO khi nào.

### Trước khi đổi sang mode cần vị trí, phải chờ EKF

`GUIDED`, `AUTO`, `RTL`, `LOITER`, `POSHOLD` đều cần máy bay biết mình đang ở
đâu. Gọi `mode guided` ngay sau khi SITL khởi động thì lệnh **thành công** —
heartbeat báo đúng `GUIDED` — nhưng vài giây sau EKF vẫn chưa có lời giải vị trí
và ArduPilot **tự rơi về `STABILIZE`**. Không có lỗi nào được báo ở chỗ đổi mode;
hỏng chỉ lộ ra mãi sau, ở `takeoff`, dưới dạng một chữ `MAV_RESULT_FAILED` trơ
trọi không nói lý do.

`harness.wait_ready()` chờ đủ hai điều kiện trước khi cho đi tiếp: EKF có lời
giải vị trí tuyệt đối, và GPS đạt 3D fix với ít nhất 6 vệ tinh.
