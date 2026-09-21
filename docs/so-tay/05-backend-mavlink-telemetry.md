# Sổ tay 05 — Backend: MAVLink, telemetry và hợp đồng WebSocket

Viết cho người chưa biết gì về MAVLink. Đọc hết chừng 20 phút. Không cần mở code.

Phase này làm được một việc: **đưa số liệu của máy bay lên trình duyệt, 8 lần mỗi
giây, qua một đường dây duy nhất**. Chưa gửi lệnh nào xuống máy bay — đó là Phase 06.

---

## 1. MAVLink là gì

MAVLink là **ngôn ngữ** giữa máy bay và máy tính mặt đất. Không phải một sợi dây,
không phải một phần mềm — chỉ là quy ước: gói tin trông thế nào, trường nào nằm ở
byte thứ mấy.

Hình dung một dòng bưu thiếp nhỏ chảy liên tục từ máy bay xuống. Mỗi tấm có **tên**
và các **ô đã in sẵn**:

```
┌─ ATTITUDE ──────────────┐    ┌─ GPS_RAW_INT ───────────┐
│ roll   : -0.03 rad      │    │ fix_type   : 3          │
│ pitch  :  0.01 rad      │    │ satellites : 14         │
│ yaw    :  1.57 rad      │    │ lat        : 107600000  │
└─────────────────────────┘    └─────────────────────────┘
```

Vài điểm hay làm người mới vấp:

- **Đơn vị trong gói tin không phải đơn vị người đọc.** Vĩ độ gửi dưới dạng số
  nguyên `107600000`, phải chia `1e7` mới ra `10.76` độ. Độ cao gửi bằng milimét.
  Dòng điện gửi bằng centi-ampe. Backend làm hết việc quy đổi này — frontend nhận
  số đã sạch.
- **`-1` và `65535` nghĩa là "không đo được", không phải một số đo.** Nếu để lọt ra
  giao diện thì màn hình sẽ hiện "dòng điện −1 A". Backend đổi chúng thành `null`.
- **MAVLink không đảm bảo gói tin tới nơi.** Nó chạy trên UDP. Mất gói là chuyện
  bình thường, không phải lỗi.

---

## 2. Heartbeat — nhịp tim

Máy bay gửi một gói `HEARTBEAT` mỗi giây, đều đặn, kể cả khi đứng yên trên bàn.

Quy tắc của cả hệ thống nằm gọn trong một câu: **không nghe thấy nhịp = coi như mất
liên lạc**. Không có cách nào khác để biết — máy bay không gửi được tin nhắn "tôi
sắp mất sóng".

Backend đặt ngưỡng `LINK_TIMEOUT_S = 3` giây. Im lặng quá 3 giây thì `connected`
chuyển về `false` và giao diện phải báo đỏ.

> **Chỗ dễ nhầm:** "đã từng kết nối" và "đang còn kết nối" là hai chuyện khác nhau.
> Nếu chỉ nhớ "đã nối rồi" thì drone rơi mất tích mà web vẫn báo xanh. Backend giữ
> cả hai: một cờ "đã từng", và một phép tính "lần cuối nghe thấy cách đây bao lâu".
> Cái thứ hai mới là cái gửi ra giao diện.

---

## 3. sysid và compid — số nhà trên mạng MAVLink

Mỗi thiết bị trên mạng MAVLink có một **số nhà**: `sysid` (hệ thống) và `compid`
(bộ phận). Máy bay thường là `sysid=1`. Trạm mặt đất thì quy ước dùng `255`.

Vấn đề xuất hiện khi chạy **hai** trạm mặt đất cùng lúc — chuyện ta làm suốt trong
dự án này: backend ở một cửa sổ, Mission Planner ở cửa sổ khác để đối chứng.

```
        SITL (máy bay ảo, sysid=1)
              │
       ┌──────┴──────┐
       ▼             ▼
  Mission Planner   backend
     sysid 255      sysid 255   ← TRÙNG: hỏng
```

Khi backend hỏi máy bay "nhận lệnh chưa?", máy bay trả lời về địa chỉ `255`. Mission
Planner cũng là `255`, nên nó tưởng câu trả lời đó dành cho mình. Hai bên lẫn lộn.

Cách sửa: nhường `255` cho Mission Planner, backend lấy số khác.

```
MAVLINK_SOURCE_SYSTEM=254
MAVLINK_SOURCE_COMPONENT=190
```

---

## 4. `udpin` và `udpout` — ai ngồi chờ, ai gõ cửa

Đây là lỗi số một của người mới, và nó im lặng: không báo gì, chỉ treo mãi ở "đang
kết nối".

UDP có hai vai. Một bên **ngồi chờ** ở cổng; bên kia **gõ cửa** tới cổng đó. Hai bên
cùng ngồi chờ thì không ai nói gì với ai. Hai bên cùng gõ cửa cũng vậy.

```
  udpin:127.0.0.1:14551     "tôi NGỒI CHỜ ở cổng 14551"
  udpout:127.0.0.1:14551    "tôi GÕ CỬA tới cổng 14551"
```

Trong dự án này, SITL được chạy như sau:

```bash
sim_vehicle.py -v ArduCopter --console --map \
  --out=udp:127.0.0.1:14550 \
  --out=udp:127.0.0.1:14551
```

`--out=` nghĩa là SITL **gửi tới** hai cổng đó. Vậy cả Mission Planner lẫn backend
đều phải **ngồi chờ**:

```
   SITL ──gửi tới 14550──▶ Mission Planner (ngồi chờ ở 14550)
        └─gửi tới 14551──▶ backend         (ngồi chờ ở 14551)
```

Hai cổng **khác nhau**. Chung một cổng thì hai bên đá nhau và bên vào sau sẽ đẩy bên
kia ra.

> `udp:` trong pymavlink cũng mặc định là ngồi chờ, nên `udp:127.0.0.1:14551` chạy
> đúng. Nhưng cứ ghi rõ `udpin:` thì không ai phải đoán — kể cả bạn của sáu tháng sau.

**Gặp lỗi `Address already in use`:** một tiến trình backend cũ vẫn đang giữ cổng.
Trên Windows: `Get-Process python | Stop-Process` rồi chạy lại.

---

## 5. Stream rate — phải *xin* máy bay gửi nhanh hơn

Mặc định ArduPilot gửi mỗi loại gói tin ở một nhịp riêng, và một số nhịp rất chậm.
`ATTITUDE` (góc nghiêng) có khi chỉ 1–4 lần mỗi giây. Vẽ chân trời giả bằng số liệu
4 Hz thì nó giật như phim câm.

Giải pháp: backend **chủ động xin**. Sau khi nối xong, nó gửi lệnh
`SET_MESSAGE_INTERVAL` (mã số **511**) cho từng loại gói tin, kèm chu kỳ mong muốn:

| Gói tin | Xin | Vì sao |
|---|---|---|
| `HEARTBEAT` | 1 Hz | phát hiện mất link |
| `ATTITUDE` | 10 Hz | chân trời giả phải mượt |
| `GLOBAL_POSITION_INT` | 5 Hz | marker trên bản đồ |
| `VFR_HUD` | 5 Hz | tốc độ mặt đất, tốc độ leo |
| `GPS_RAW_INT` | 2 Hz | số vệ tinh đổi chậm, không cần nhanh |
| `BATTERY_STATUS` | 1 Hz | pin đổi rất chậm |

Nhịp không phải càng cao càng tốt: đường truyền có giới hạn, xin 50 Hz cho mọi thứ
thì gói tin quan trọng sẽ bị chen mất.

> ### Điểm quan trọng nhất của mục này
>
> **Phải xin LẠI sau mỗi lần nối lại.** Máy bay không nhớ ta đã xin gì lúc trước —
> reset, rút cáp, hay đơn giản là mất sóng một lúc, là mọi nhịp về mặc định.
>
> Đây là lỗi kinh điển: lập trình viên đặt lệnh xin ở ngoài vòng nối lại, nên nó chỉ
> chạy đúng một lần lúc khởi động. Mọi thứ trông bình thường cho tới khi link đứt
> rồi nối lại — từ đó HUD giật, và không ai hiểu vì sao vì *không có lỗi nào được
> báo cả*.

Vài loại gói tin **không** xin nhịp được, vì chúng là **sự kiện** chứ không phải
trạng thái: `STATUSTEXT` (máy bay nhắn tin cho người), nhóm `MISSION_*`, và
`HOME_POSITION`. Máy bay tự gửi khi có việc. Riêng `HOME_POSITION` thì phải xin từng
lần một, và phải xin lại mỗi khi máy bay được arm — vì lúc arm máy bay đặt lại điểm
home, nếu không xin lại thì marker "nhà" trên bản đồ sẽ chỉ vào chỗ cũ.

---

## 6. WebSocket khác REST ở chỗ nào

**REST** là hỏi–đáp. Trình duyệt hỏi một câu, máy chủ trả một câu, xong, cắt liên
lạc. Muốn biết tin mới thì phải hỏi lại.

**WebSocket** là một đường dây mở. Nối một lần, rồi hai bên nói chuyện qua lại tuỳ ý
cho tới khi ai đó gác máy.

```
REST:        [hỏi]──▶  ◀──[đáp]   cắt
             [hỏi]──▶  ◀──[đáp]   cắt      ... lặp 8 lần/giây, tốn kém

WebSocket:   nối một lần
             ◀────── telemetry ──────  (8 lần/giây)
             ────── lệnh ──────▶
             ◀────── sự kiện ──────
             ... cho tới khi đóng
```

Dự án này **bắt buộc** dùng WebSocket, và lý do là **an toàn**, không phải hiệu năng:

> Khi tab trình duyệt đóng — người dùng bấm X, máy tính sập nguồn, wifi rớt —
> WebSocket **đóng ngay lập tức** và backend biết điều đó **tức khắc**.
> Backend dùng đúng tín hiệu ấy để thu hồi quyền lái của web.

Với REST thì không có "tín hiệu đóng". Máy chủ chỉ có thể đoán: "lâu rồi không thấy
hỏi gì, chắc là đi rồi?" Trong khi drone vẫn đang bay và vẫn đang nhận lệnh cũ.

Đây chính là cơ chế **dead-man** (Phase 06 hoàn thiện): socket đóng = mất quyền =
máy bay dừng lại.

---

## 7. Hợp đồng là gì, và vì sao chỉ được có một bản

Backend viết bằng Python, frontend viết bằng TypeScript. Hai bên phải thống nhất
từng cái tên trường, từng đơn vị, từng cách viết hoa. Bản thống nhất đó gọi là **hợp
đồng**.

Nghe thì hiển nhiên. Cái không hiển nhiên là: **hợp đồng phải nằm đúng một chỗ.**

Hãy tưởng tượng hai người cùng dịch một câu tiếng Anh sang tiếng Việt, mỗi người một
cuốn từ điển riêng. Ban đầu giống nhau. Rồi một người sửa cuốn của mình —
`battery_voltage` đổi thành `batteryVoltage` cho hợp thói quen JavaScript. Người kia
không biết. Code hai bên **vẫn biên dịch được**, vì mỗi bên tự nhất quán với chính
mình. Lỗi chỉ lộ ra lúc chạy thật, dưới dạng một ô trống trên màn hình.

Trong dự án này:

```
plans/phase-05-...md, mục "Hợp đồng WebSocket"   ← văn bản, con người đọc
            │
            ▼
backend/schemas.py                                ← code Python
            │
            ▼  (sinh ra bằng máy, không gõ tay)
backend/ws-contract.schema.json
            │
            ▼  (Phase 08 sinh từ file trên)
frontend/src/lib/protocol.ts                      ← code TypeScript
```

Mũi tên chỉ một chiều. Đổi hợp đồng thì sửa **từ trên xuống**, trong **cùng một
commit**. Không bao giờ sửa `protocol.ts` rồi mong backend đuổi theo.

Điểm hay của cách này: file `.schema.json` do **máy sinh ra** từ `schemas.py`, và
`protocol.ts` cũng do máy sinh từ file đó. Người không gõ tay bước nào, nên không có
chỗ nào để gõ sai.

### Phong bì

Mọi message, cả hai chiều, đều có cùng một lớp vỏ:

```json
{ "v": 1, "type": "telemetry", "ts": 1758412345.123, "id": "c-17", "data": { } }
```

- `v` — số phiên bản hợp đồng. Bên gửi dùng bản khác thì bị từ chối thẳng, chứ không
  cố đoán.
- `type` — tên loại message.
- `data` — nội dung. **Không bao giờ là `null`**; rỗng thì là `{}`. Một quy ước nhỏ
  nhưng xoá được cả một lớp lỗi "đọc thuộc tính của null".

### Một quy tắc bất đối xứng, cố ý

- **Chiều xuống** (server → trình duyệt): gặp `type` lạ thì **bỏ qua im lặng**. Nhờ
  vậy backend mới thêm được message mà không làm gãy tab đang mở bản cũ.
- **Chiều lên** (trình duyệt → server): gặp `type` lạ thì **phải báo lỗi**.

Vì sao khác nhau? Chiều xuống bỏ qua một dòng hiển thị thì mất một dòng hiển thị.
Chiều lên nuốt im lặng một *lệnh điều khiển* thì người dùng tưởng đã bấm được, còn
máy bay thì không nhận được gì. Im lặng ở chiều lên là nguy hiểm.

### Message hỏng không đóng socket

Gửi lên một message sai chính tả, server trả về lỗi rồi **đi tiếp** — đường dây vẫn
mở. Đóng cả socket vì một message hỏng nghĩa là mất luôn telemetry: hại hơn nhiều so
với cái lỗi ban đầu.

---

## 8. Giá trị dẫn xuất — vì sao `link_age_ms` không được lưu

`link_age_ms` là "lần cuối nghe thấy máy bay cách đây bao nhiêu mili-giây".

Nó **tính ra được** từ thứ đã có: lấy giờ hiện tại trừ đi mốc thời gian của gói tin
cuối. Thứ tính ra được thì **không lưu**.

Lý do rất cụ thể: nếu lưu, con số đó đúng vào đúng khoảnh khắc ghi nó xuống, và sai
ngay mili-giây sau. Nó chỉ đúng khi có ai đó nhớ cập nhật, ở mọi chỗ, mãi mãi. Sẽ có
một chỗ bị quên. Khi đó giao diện hiện "link 12 ms" trong lúc máy bay đã im lặng 40
giây — và đó là loại sai lầm tệ nhất, vì nó **trông giống như đang bình thường**.

Cùng lý do này, `connected` gửi ra dây cũng được tính lại mỗi lần gửi, chứ không
dùng lại cái cờ đang lưu.

Quy tắc chung: **một dữ kiện, một chỗ.** Mọi thứ khác suy ra từ nó lúc cần.

---

## 9. Version 1 không có xác thực — hạn chế đã biết

Nói thẳng ra để không ai bất ngờ: **ai mở được `ws://<địa-chỉ>:8000/ws` đều nối vào
được.** Không mật khẩu, không token, không kiểm tra gì cả.

Chấp nhận được ở phạm vi hiện tại, và chỉ ở đó:

- backend nghe trên `127.0.0.1` — chỉ chính máy đó gọi được;
- chạy trong mạng LAN của phòng thí nghiệm, một người dùng;
- quyền lái còn ba lớp khoá khác nữa: phải chủ động bật WEB CONTROL, máy bay phải ở
  mode `GUIDED`, và người cầm điều khiển RC gạt một cái là web mất quyền ngay.

Nếu sau này cần mở ra ngoài mạng nội bộ thì phải làm, tối thiểu:

1. token trong query string khi mở socket, kiểm ở bước accept;
2. chỉ nghe trên `127.0.0.1` rồi để reverse proxy (Caddy/nginx) lo TLS và đăng nhập;
3. giới hạn nhịp theo địa chỉ IP, không chỉ theo socket.

Đây là chỗ giảng viên rất hay hỏi. Câu trả lời tốt không phải "em quên", mà là "em
biết, đây là lý do chấp nhận được trong phạm vi này, và đây là cách khắc phục".

---

## 10. Quy tắc một người lái

Mở hai tab cùng lúc thì ai được lái?

**Tab đầu tiên xin, và chỉ tab đó.** Tab thứ hai xin sẽ nhận lỗi
`command_denied` — *"Mot tab khac dang giu quyen lai"*.

Quyền mất đi trong bốn trường hợp:

1. tab đó tự tắt;
2. tab đó đóng (kể cả do sập nguồn hay rớt mạng);
3. máy bay rời khỏi mode `GUIDED` — nghĩa là người cầm RC đã lấy lại quyền;
4. mất link MAVLink.

Version 1 **không** có cơ chế cướp quyền. Cố ý: một nút "giành quyền lái" là đúng
thứ người ta sẽ bấm nhầm, và hậu quả của bấm nhầm ở đây là một vật thể bay nặng vài
ký đổi chủ giữa không trung.

---

## 11. Kiểm tra bằng tay

Backend chạy được mà **không cần** SITL — không có link thì báo `connected: false`
chứ không sập. Nguyên tắc: mất một bộ phận không được kéo cả hệ thống chết.

```powershell
# Cửa sổ 1 — SITL trong WSL, chẻ làm hai cổng
wsl -d Ubuntu-24.04 -- bash -lc "cd ~/ardupilot && sim_vehicle.py -v ArduCopter --console --map --out=udp:127.0.0.1:14550 --out=udp:127.0.0.1:14551"

# Cửa sổ 2 — backend, nối cổng 14551
$env:MAVLINK_ENDPOINT = "udpin:127.0.0.1:14551"
uv run uvicorn backend.app:app --host 127.0.0.1 --port 8000

# Cửa sổ 3 — xem dữ liệu chảy về
uv run python scripts/ws_probe.py --count 20
uv run python scripts/ws_probe.py --measure-rate      # phải ra 7.5-8.5 Hz
uv run python scripts/ws_probe.py --only event        # chỉ xem sự kiện
```

Rồi mở Mission Planner, nối UDP cổng **14550**. Cả hai cùng thấy máy bay — đó là bằng
chứng việc chẻ cổng hoạt động.

Thử rút dây: tắt SITL giữa chừng. Trong vòng 4 giây `connected` phải về `false` và có
một sự kiện `link.lost`, mà backend **không** sập. Bật SITL lại: trong 10 giây nó tự
nối lại, có sự kiện `link.up`, và `ATTITUDE` trở lại 10 Hz.

---

## Tóm tắt một câu mỗi ý

| Ý | Một câu |
|---|---|
| MAVLink | ngôn ngữ giữa máy bay và mặt đất, gói tin nhỏ có tên và ô cố định |
| Heartbeat | nhịp 1 Hz; không nghe thấy = mất liên lạc |
| sysid | số nhà; backend và Mission Planner không được trùng |
| udpin/udpout | ai ngồi chờ, ai gõ cửa — nhầm thì treo im lặng |
| Stream rate | phải xin, và phải xin lại sau mỗi lần nối lại |
| WebSocket | đường dây mở; socket đóng = mất quyền lái, đó là cơ chế an toàn |
| Hợp đồng | một bản duy nhất, sửa từ trên xuống trong cùng một commit |
| Giá trị dẫn xuất | tính được thì đừng lưu, lưu là sẽ lệch |
| Xác thực | Version 1 không có, biết rõ và biết cách khắc phục |
| Một người lái | tab đầu tiên giữ quyền, không có cướp quyền |
