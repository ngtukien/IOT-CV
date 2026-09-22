# HỆ THỐNG UAV TUẦN TRA TỰ HÀNH TÍCH HỢP IoT
## Khôi phục ảnh chất lượng thấp từ camera nhúng giá rẻ cho bài toán phát hiện và định vị người từ trên không

**Đồ án liên môn:** Internet of Things · Xử lý ảnh
**Phiên bản tài liệu:** v2.0 — 04/09/2026
**Trạng thái:** Đã chốt cấu hình phần cứng, chuẩn bị đặt hàng

---

## MỤC LỤC

1. Tổng quan đề tài
2. Kiến trúc hệ thống
3. Thiết kế phần cứng
4. Thiết kế phần mềm
5. Nội dung môn Xử lý ảnh
6. Huấn luyện và đánh giá mô hình
7. Nội dung môn IoT
8. Lộ trình triển khai
9. An toàn và pháp lý
10. Rủi ro và phương án dự phòng
11. Tiêu chí hoàn thành
12. Phụ lục

---

# 1. TỔNG QUAN ĐỀ TÀI

## 1.1. Bối cảnh và động lực

UAV tuần tra tự hành là bài toán ứng dụng điển hình của IoT: một thiết bị bay mang cảm biến, truyền dữ liệu không dây về trạm mặt đất, nơi dữ liệu được xử lý và hiển thị theo thời gian thực. Tuy nhiên, các hệ thống thương mại sử dụng camera chất lượng cao có giá thành vượt xa khả năng của một đồ án sinh viên.

Đề tài này đi theo hướng ngược lại: **cố ý sử dụng camera nhúng giá rẻ (ESP32-CAM, cảm biến OV2640) và biến chất lượng ảnh thấp thành đối tượng nghiên cứu chính**, thay vì coi nó là hạn chế phải chấp nhận. Ảnh thu được bị suy giảm bởi nén JPEG mạnh, nhiễu cảm biến, nhòe chuyển động, méo quang học và hiện tượng rolling shutter — đúng những vấn đề mà môn Xử lý ảnh nghiên cứu.

## 1.2. Phát biểu bài toán

> **Câu hỏi nghiên cứu chính:** Ảnh thu từ camera nhúng giá rẻ gắn trên UAV bị suy giảm theo những cơ chế nào, các tham số suy giảm đó **đo được** bằng bao nhiêu, và chuỗi xử lý ảnh nào phục hồi được hiệu năng phát hiện người tốt nhất **trên mỗi đơn vị thời gian tính toán** bỏ ra?

Bộ phát hiện đối tượng trong đề tài này đóng vai trò **thước đo**, không phải mục tiêu. Đóng góp nằm ở việc đo đạc, mô hình hóa và bù trừ suy giảm ảnh.

## 1.3. Mục tiêu

### Phiên bản 1 — bắt buộc hoàn thành

**Khối bay:**
- Bay thủ công bằng tay điều khiển RC ở các chế độ Stabilize, Altitude Hold, Loiter
- Return-to-Launch tự động khi mất tín hiệu hoặc pin yếu
- Nhận lệnh Guided từ web, điều khiển bằng bàn phím
- Vẽ lộ trình waypoint trên bản đồ web, tải xuống flight controller, bay Auto theo đúng lộ trình
- Các lệnh Hold, RTL, Land từ web

**Khối IoT:**
- Truyền telemetry (vị trí, độ cao, chế độ bay, điện áp pin, số vệ tinh) về laptop qua Wi-Fi
- Truyền ảnh từ ESP32-CAM về laptop
- Điều tiết chất lượng luồng ảnh thích ứng theo cường độ tín hiệu
- Đồng bộ thời gian NTP giữa các nút
- Công bố sự kiện qua MQTT, hiển thị trên dashboard
- Đo và báo cáo độ trễ, tỉ lệ mất gói, thời gian đáp ứng lệnh

**Khối Xử lý ảnh:**
- Đo hồ sơ suy giảm định lượng của ESP32-CAM
- Hiệu chuẩn camera, khử méo
- Mô phỏng suy giảm lên bộ dữ liệu VisDrone, huấn luyện mô hình thích nghi miền
- So sánh ablation các phương pháp khôi phục ảnh trên ba chiều đánh giá
- Phát hiện người, phân loại tư thế, chiếu tọa độ mục tiêu lên bản đồ

### Phiên bản 1 — không làm

Không tự viết bộ điều khiển PID. Không viết firmware điều khiển bay. Không SLAM. Không tránh vật cản. Không bám đuổi tự động. Không hạ cánh bằng AI. Không đưa mô hình học sâu lên ESP32. Không yêu cầu 30 khung hình mỗi giây. Không bay xa hàng kilomet.

### Giới hạn cần ghi rõ trong báo cáo

Tọa độ GPS tại thời điểm phát hiện là **tọa độ của UAV**, không phải tọa độ của người. Việc suy ra tọa độ người cần hiệu chuẩn camera, tư thế UAV, độ cao và phép chiếu tia xuống mặt đất — được thực hiện ở mức ước lượng có phân tích sai số (mục 5.6), không phải phép đo chính xác.

## 1.4. Đóng góp chính

| # | Đóng góp | Tính mới |
|---|---|---|
| 1 | Hồ sơ suy giảm định lượng của ESP32-CAM (MTF, nhiễu, artifact nén, méo, vignetting, rolling shutter) | Dữ liệu gốc, đo trực tiếp, không tồn tại trong tài liệu công khai |
| 2 | Bộ dữ liệu tổng hợp VisDrone-ESP32 sinh bằng tham số suy giảm đo được | Augmentation có căn cứ vật lý thay vì augmentation ngẫu nhiên |
| 3 | Bộ dữ liệu ảnh cặp thật (ESP32-CAM ↔ điện thoại) căn chỉnh bằng homography | Cho phép tính PSNR/SSIM với tham chiếu thật thay vì suy giảm giả lập |
| 4 | So sánh ablation 10+ phương pháp khôi phục trên ba chiều: chất lượng ảnh, hiệu năng phát hiện, chi phí tính toán | Định lượng được khoảng cách giữa "đẹp với mắt người" và "tốt cho máy" |
| 5 | Vòng điều khiển QoS thích ứng nối hai môn học thành một hệ thống thống nhất | Biến thiên chất lượng ảnh do IoT tạo ra chính là đối tượng môn Xử lý ảnh nghiên cứu |

---

# 2. KIẾN TRÚC HỆ THỐNG

## 2.1. Nguyên tắc thiết kế

Ba nguyên tắc bất di bất dịch, quyết định toàn bộ kiến trúc:

1. **Flight controller là thành phần duy nhất chịu trách nhiệm giữ thăng bằng máy bay.** Web và AI chỉ gửi lệnh mức cao.
2. **Mô hình học sâu tuyệt đối không điều khiển trực tiếp động cơ.** Không có đường đi nào từ đầu ra bộ phát hiện tới ESC.
3. **Mọi khối phải hỏng độc lập.** Mất camera không được làm rơi drone. Mất Wi-Fi không được làm mất điều khiển. Mất laptop không được làm mất chế độ bay.

## 2.2. Sơ đồ khối

```
                              UAV
                               │
        ┌──────────────────────┼──────────────────────┐
        │                      │                      │
        ▼                      ▼                      ▼
  KHỐI BAY               KHỐI THỊ GIÁC          KHỐI TRUYỀN THÔNG
        │                      │                      │
  SpeedyBee F405 V5       ESP32-CAM              ESP32 DevKit
  ArduPilot Copter        OV2640 + anten         Cầu MAVLink
        │                      │                      │
  GPS M10 + la bàn        Wi-Fi MJPEG            Wi-Fi UDP
        │                      │                      │
  Receiver iA6B                │                      │
        │                      └──────────┬───────────┘
  Tay điều khiển FS-i6X                   │
        │                                 ▼
  4 × ESC / Motor 2216                 LAPTOP
                                          │
                ┌─────────────────────────┼─────────────────────────┐
                │                         │                         │
                ▼                         ▼                         ▼
        Backend MAVLink          Pipeline Xử lý ảnh              MQTT
        FastAPI + pymavlink      Khôi phục → YOLO → SAHI      Broker sự kiện
                │                         │                         │
                └─────────────────────────┼─────────────────────────┘
                                          │
                                          ▼
                                    WEB GCS
                                          │
                    ┌─────────────────────┼─────────────────────┐
                    │                     │                     │
                  THỦ CÔNG            NHIỆM VỤ              GIÁM SÁT
                  Bàn phím            Bản đồ                Video
                  Guided              Waypoint              Pin, GPS
                    │                     │                 Phát hiện
                  GUIDED               AUTO
```

## 2.3. Luồng dữ liệu

**Luồng điều khiển (độ trễ quan trọng):**
Bàn phím web → WebSocket → Backend → pymavlink → Wi-Fi UDP → ESP32 bridge → UART → Flight controller → ESC → Motor

**Luồng telemetry (tần suất cao):**
Flight controller → UART → ESP32 bridge → Wi-Fi UDP → Backend → WebSocket → Web

**Luồng thị giác (băng thông cao):**
OV2640 → ESP32-CAM (nén JPEG) → Wi-Fi HTTP MJPEG → Backend → Khôi phục ảnh → Bộ phát hiện → Sự kiện MQTT → Dashboard

**Luồng an toàn (không qua phần mềm của nhóm):**
Tay điều khiển RC → iA6B → Flight controller. Đây là đường dự phòng độc lập hoàn toàn, luôn ưu tiên cao nhất.

---

# 3. THIẾT KẾ PHẦN CỨNG

## 3.1. Cấu hình đã chốt

> **Cập nhật 20/09/2026.** Bảng dưới đã thay bằng linh kiện **mua thật**, không còn
> là phương án dự kiến. Tổng chi 9.661.000 ₫. Ba chỗ khác với bản 04/09: motor cụ
> thể hoá thành T-Motor, pin lên 5300mAh, và khẳng định về lỗ bắt FC đã được sửa
> (xem ghi chú ngay dưới bảng).

| Hạng mục | Lựa chọn | Lý do |
|---|---|---|
| Khung | **Holybro S500 V2 (480mm) bản PCB, chân đáp cao** | PDB tích hợp sẵn trong đế dưới (60A liên tục / 100A đỉnh); chân đáp cao cho camera nhìn xuống; tải trọng thêm ~1500g. **Khung KHÔNG có lỗ bắt 30,5×30,5** — xem ghi chú dưới bảng |
| FC + ESC | **SpeedyBee F405 V5 OX32 55A stack, bản Deluxe** | Ít mối hàn nhất, target `speedybeef4v5` có trong ArduPilot Copter stable 4.7.1, bản Deluxe kèm bộ chống chập và buzzer. ESC 32-bit chạy DShot300/600 |
| Motor | **T-Motor AIR GEAR 450 II — 4 × AIR2216II KV920** | Lỗ bắt 4×M3 16×19 và trục ren M6 trùng chuẩn 22xx nên vặn thẳng lên cần S500. Lực đẩy 1332 g/motor ở 4S theo bảng đo hãng, nặng 64 g |
| Cánh | **T1045 nylon + sợi thuỷ tinh, 8 chiếc** (4 dùng + 4 dự phòng) | Đi kèm motor, đúng chiều theo từng loại ren. Giới hạn lực đẩy công bố 1,2 kg/cánh |
| GPS | **Holybro M10 v1, cáp 10 chân, kèm cột nâng** | La bàn IST8310 — **bắt buộc**, vì F405 V5 không có la bàn tích hợp. Cáp phải bấm lại, xem mục 3.4 |
| RC | **FlySky FS-i6X + iA6B** | Đủ kênh; **bắt buộc i-BUS vào chân R6** — F405 V5 không hỗ trợ PPM |
| Pin | **Ovonic LiPo 4S 5300mAh 110C, XT60** | 423 g, 12,5 mAh/g — mật độ năng lượng cao nhất trong các phương án đã so. Drone rút tối đa ~58 A nên chỉ cần 11C; 110C là thừa xa nhưng vô hại |
| Sạc | **SkyRC iMAX B6AC V2** | Bản AC có nguồn tích hợp, 50W, 1–6 cell, kèm dây XT60. Có sẵn Battery Meter đo từng cell nên không cần mua đồng hồ đo pin rời |
| Phụ kiện còn thiếu | bát chống rung 30,5×30,5 · dây 16AWG 4,5m · gen co + dây rút | ~280.000 ₫, chặn toàn bộ khâu lắp ráp |
| UBEC | **5V 3A, đầu vào 2–6S × 2** | Phải nhận được 4S; nguồn riêng cho hai ESP32 |
| Camera | **ESP32-CAM bản cổng IPEX + anten 2.4G ngoài** | Bản anten PCB chỉ ổn định trong ~10m, không dùng được cho drone |
| Cầu telemetry | **ESP32 DevKit V1** | Rẻ nhất cho liên kết MAVLink không dây |

### Đính chính — khẳng định về lỗ bắt FC

Bản 04/09 ghi khung S500 có *"lỗ bắt FC 30.5×30.5mm khớp trực tiếp tháp"*. **Điều này
sai**, và nó dẫn tới bỏ sót một món bắt buộc phải mua. Kiểm chứng ngày 20/09/2026:

- Không tài liệu chính hãng Holybro nào nêu lỗ 30,5×30,5 trên khung S500.
- Bản dựng tham chiếu S500 V2 của chính Holybro (PX4 build guide) gắn bo bay bằng
  **băng keo hai mặt** lên tấm giữa, rồi mới bắt tấm đó vào khung bằng ốc M2.5×6 —
  tức là nhà sản xuất cũng không bắt ốc cứng bo bay vào khung.
- Tồn tại cả một lớp sản phẩm adapter "S500 → 30,5×30,5" trên thị trường, điều chỉ
  có nghĩa khi khung thiếu lỗ đó.

Hệ quả thiết kế: **bắt buộc dùng bát chống rung 30,5×30,5** (hoặc băng keo xốp 3M),
và **cấm khoan đế dưới** vì đó là PDB có đường đồng đúc chìm. Chi tiết: `README.md`
GIAI ĐOẠN 26 và 31.

## 3.2. Tính toán khối lượng và lực đẩy

> **Cập nhật 20/09/2026.** Bảng cũ dùng khối lượng khung **405 g**, không khớp con số
> **782 g** mà Holybro công bố cho bộ khung S500 V2. Chênh 377 g này kéo theo toàn bộ
> phân tích lực đẩy, nên bảng đã tính lại. Các dòng đánh dấu *(ước)* là ước lượng,
> phải cân thật trước chuyến bay đầu.

| Hạng mục | Khối lượng | Nguồn |
|---|---|---|
| Khung Holybro S500 V2 + chân đáp | 782 g | công bố của Holybro |
| 4 × motor T-Motor AIR2216II | 256 g | 64 g × 4, bản vẽ hãng |
| Stack F405 V5 + bát chống rung + ốc | 55 g *(ước)* | |
| GPS M10 + la bàn + cột nâng | 40 g *(ước)* | |
| Receiver iA6B | 16 g | |
| 4 × cánh T1045 | 52 g *(ước)* | |
| Dây 16AWG nối dài, XT60, tụ, gen co | 90 g *(ước)* | tăng so với bản cũ vì phải nối dài 3,6 m dây motor |
| **Khối lượng khô — cấu hình bay** | **1291 g** | |
| LiPo Ovonic 4S 5300mAh | 423 g | cân thật của hãng |
| **AUW khi chưa gắn camera** | **≈ 1714 g** | giai đoạn 1–2 |
| ESP32-CAM + anten + mount + damper | 45 g *(ước)* | đợt 3 |
| ESP32 bridge + 2 × UBEC | 35 g *(ước)* | đợt 3 |
| Velcro, dây rút, phụ kiện | 30 g *(ước)* | |
| **AUW đầy đủ khi có camera** | **≈ 1824 g** | giai đoạn 3 trở đi |

**Phân tích lực đẩy — đây là phép tính quyết định drone có bay được không:**

Không còn phải so 3S với 4S: pin 4S đã mua. Số dưới lấy từ **bảng đo từng nấc ga của
T-Motor** cho AIR2216II với cánh T1045 ở 16 V, không phải ngoại suy.

Có hai trần khác nhau, phải lấy trần thấp hơn:

```text
Tran cua MOTOR : 1332 g moi chiec  ->  4 x 1332 = 5328 g
Tran cua CANH  : 1200 g moi chiec  ->  4 x 1200 = 4800 g   <- lay con so nay
```

Cánh T1045 chính hãng công bố giới hạn lực đẩy 1,2 kg và vùng vòng quay đẹp
6000–7000 rpm; ở ga 100% motor đẩy 1332 g tại 9857 rpm, **vượt cả hai mức**. Bay
bình thường ở ga treo thì nằm sâu trong vùng an toàn, chỉ không được giữ ga hết cỡ
kéo dài.

| Chỉ tiêu | Chưa có camera | **Đầy đủ có camera** |
|---|---|---|
| Khối lượng cất cánh | 1714 g | 1824 g |
| Tổng lực đẩy (trần cánh) | 4800 g | 4800 g |
| **Tỉ số lực đẩy / khối lượng** | **2,80 : 1** | **2,63 : 1** |
| Tỉ số nếu tính theo trần motor | 3,11 : 1 | 2,92 : 1 |
| Ga treo ước tính | ≈ 48 % | ≈ 50 % |
| Thời gian bay ước tính | ≈ 18 phút | ≈ 16 – 17 phút |

Ngưỡng an toàn tối thiểu cho một nền tảng ổn định là **2:1**. Cả hai cấu hình đều
vượt xa, kể cả khi tính theo trần cánh là con số dè dặt hơn. Biên này đủ rộng để
chịu thêm khoảng 500 g phát sinh mà vẫn không chạm sàn.

Thời gian bay tính theo dòng treo đo thật ~13 A ở 1660 g, quy đổi lên khối lượng của
bản dựng này, dùng 80% dung lượng 5300 mAh.

> **Ga treo — hai nguồn không khớp nhau, phải tự đo.** Bảng đo T-Motor quy ra ga treo
> khoảng 48–50%, nhưng file tham số chính hãng của ArduPilot cho khung S500 đặt
> `MOT_THST_HOVER = 0.25` (25%). Khác biệt là vì khung tham chiếu của họ dùng motor
> 2216-**880kv** và khối lượng khác. ArduPilot tự học lại giá trị này trong khi bay
> (`MOT_HOVER_LEARN`), nên cứ để nó tự hiệu chỉnh và **đọc số thật sau chuyến bay
> đầu** thay vì tin con số nào trong hai con số trên.

Cơ sở đối chiếu: [ArduPilot có trang tài liệu chính thức cho khung tham chiếu Holybro S500](https://ardupilot.org/copter/docs/reference-frames-holybro-s500.html) với **đúng cấu hình này** — motor 2216, cánh 1045, pin 3S hoặc 4S dung lượng 3300–5300 mAh — và cung cấp sẵn file tham số đã tinh chỉnh để nạp vào ArduPilot. Bản S500 V2 của Holybro công bố **tải trọng tối đa 1500 g chưa tính pin**; payload của đề tài này chỉ khoảng 80 g.

> **Bắt buộc đo thật trước lần bay đầu.** Mọi con số trên là ước lượng từ tài liệu. Quy trình đo: bắt cố định một cánh tay khung xuống bàn với motor hướng **xuống dưới**, đặt lên cân điện tử, tháo hết vật cản, đeo kính bảo hộ, gắn cánh, rồi dùng Motor Test trong Mission Planner chạy lần lượt 25 / 50 / 75 / 100 % và ghi số gam. Nhân 4 rồi chia cho khối lượng cất cánh đo được. **Nếu tỉ số dưới 2:1 thì đổi pin hoặc đổi sang cánh 1047 / 1147 TRƯỚC khi cất cánh.**

~~**Phương án dự phòng nếu buộc phải dùng 3S:** thay cánh 1045 bằng 1047 hoặc 1147.~~
*Không còn áp dụng — pin 4S đã mua.* Hướng tối ưu còn mở là đổi sang cánh **9450**:
theo bảng đo, nó mất ~4% lực đẩy nhưng tiết kiệm ~19% dòng điện, tỉ số vẫn trên
ngưỡng. Để dành làm thí nghiệm tối ưu sau khi bay ổn, và nó cũng là nội dung tốt cho
báo cáo.

## 3.3. Sơ đồ đấu nối

```
LiPo 4S ──XT60──┬── ESC 4in1 55A (tầng dưới)  ← tụ 1000µF hàn song song
                │        ├── M1..M4 ──► 4 × motor AIR2216II
                │        └── cáp SH1.0 10-pin ──► FC F405 V5 (tầng trên)
                │                                   ├── SERIAL4 ──► GPS M10 + la bàn
                │                                   ├── SERIAL6 (chân R6) ──► iA6B (iBUS)
                │                                   ├── SERIAL2 ──► ESP32 bridge (MAVLink)
                │                                   └── buzzer
                │
                ├── UBEC #1 5V 3A ──► ESP32-CAM (5V/GND)
                └── UBEC #2 5V 3A ──► ESP32 bridge (5V/GND)
```

FC và ESP32 đều dùng UART mức 3.3V nên nối trực tiếp, không cần mạch chuyển mức. Nối chéo TX–RX và bắt buộc chung GND.

**Không cấp nguồn ESP32 từ BEC của FC.** BEC 5V của V5 tổng cộng chỉ 2,5 A (công bố của SpeedyBee) và đã chia sẻ cho GPS, receiver, buzzer và dải LED. ESP32-CAM rút xung tới 400 mA khi phát ảnh; sụt áp trên đường này có thể làm reset FC hoặc sai số la bàn giữa lúc bay.

## 3.4. Bảng cổng nối tiếp ArduPilot cho F405 V5

| SERIAL | Chức năng mặc định | Sử dụng trong đề tài | Tham số |
|---|---|---|---|
| SERIAL0 | USB | Nạp firmware, Mission Planner | — |
| SERIAL1 | Bluetooth nội bộ | Không dùng được | — |
| SERIAL2 | UART2 tự do | **Cầu MAVLink ESP32** | `SERIAL2_PROTOCOL = 2`, `SERIAL2_BAUD = 57` |
| SERIAL3 | DJI-VTX | Dự phòng | — |
| SERIAL4 | GPS | **GPS M10 + la bàn** | `SERIAL4_PROTOCOL = 5` |
| SERIAL5 | ESC Telemetry | Tự động | — |
| SERIAL6 | RC Input (chân R6) | **Receiver iA6B** | `SERIAL6_PROTOCOL = 23` |

## 3.5. Cảnh báo mua hàng — kiểm tra trước khi thanh toán

| # | Vấn đề | Hậu quả nếu sai |
|---|---|---|
| 1 | **F405 V5 không có la bàn onboard.** GPS M10 phải là bản **GPS + Compass** | Không có la bàn thì Loiter, RTL và Auto **không hoạt động** — mất toàn bộ phần tự hành |
| 2 | **iA6B chỉ có iBUS, không có SBUS** | Đấu theo hướng dẫn SBUS sẽ không nhận tín hiệu; phải nối chân R6 và đặt `SERIAL6_PROTOCOL = 23` |
| 3 | **ESP32-CAM phải là bản có cổng IPEX** | Bản anten PCB chỉ ổn định trong ~10 m, vô dụng cho drone. Hai bản nhìn gần giống hệt nhau |
| 4 | **Tháp 4-in-1 nằm ở tâm khung** | Dây motor từ đầu càng về giữa không đủ dài; cần thêm ~30 cm dây silicone 20AWG mỗi motor |
| 5 | **Tụ và dây XT60 là món rời, không hàn sẵn** | Phải tự hàn 4 mối trên đường điện chính; tụ hóa có cực, hàn ngược là nổ |
| 6 | **Smoke stopper chỉ có ở bản Deluxe** | Đã chọn Deluxe nên có sẵn; nếu đổi sang Standard phải mua rời |
| 7 | **Motor phải ghi rõ chịu được 3–4S**, UBEC phải nhận đầu vào 4S | Dùng pin 4S với motor chỉ chịu 3S sẽ cháy cuộn dây; UBEC chỉ nhận 3S sẽ hỏng ngay khi cắm |
| 8 | Mua dư cánh (cả 1045 và 1047), 1 motor, 2 càng dự phòng | Chờ hàng giữa kỳ có thể mất 1–2 tuần; cánh 1047 là phương án bù lực đẩy |

## 3.6. Bố trí linh kiện trên khung

| Linh kiện | Vị trí | Ràng buộc |
|---|---|---|
| Flight controller | Tâm khung, trên grommet cao su | **Mũi tên trên bo phải chỉ về phía trước** |
| GPS + la bàn | Trên mast cao ≥ 8 cm, phía sau | Càng xa ESC và dây nguồn càng tốt — đây là linh kiện nhạy nhiễu từ nhất |
| ESP32-CAM | Dưới bụng, hướng nadir, qua damper cao su | Xa motor để giảm rung; chân đáp cao của S500 đảm bảo không vướng đất |
| ESP32 bridge | Tầng trên, anten hướng lên | Tách xa anten receiver — cả hai đều 2.4 GHz |
| 2 × UBEC | Khoang giữa | Hàn nguồn vào PDB tích hợp của S500 |
| Pin | Dán velcro dưới bụng | Dịch được tới lui để cân trọng tâm |

## 3.7. Đặc tính camera và kế hoạch bay

Tính toán cho OV2640 ống kính tiêu chuẩn (FOV chéo ~66°, tương đương HFOV 54.9° và VFOV 42.6°), độ phân giải VGA 640×480, hướng nhìn thẳng xuống:

| Độ cao | Bề rộng khung | Chiều sâu khung | Điểm ảnh / mét | Người đứng (~0.5 m) | Người nằm (~1.7 m) |
|---|---|---|---|---|---|
| 5 m | 5.2 m | 3.9 m | 123 px/m | ~62 px | ~209 px |
| 8 m | 8.3 m | 6.2 m | 77 px/m | ~38 px | ~131 px |
| 12 m | 12.5 m | 9.4 m | 51 px/m | ~26 px | ~87 px |
| 15 m | 15.6 m | 11.7 m | 41 px/m | ~21 px | ~70 px |

**Chọn độ cao làm việc: 6 – 8 m.** Ở khoảng này người đứng chiếm 38–50 điểm ảnh — đủ cho bộ phát hiện kết hợp SAHI, đồng thời hạn chế sai lệch do parallax. Độ cao trở thành một biến trong ma trận thí nghiệm (mục 6.4).

Về tốc độ khung hình: để đạt chồng lấn dọc 80% khi bay 3 m/s ở độ cao 8 m chỉ cần khoảng 2.4 khung/giây. ESP32-CAM đạt 15–25 khung/giây ở VGA trên mạng cục bộ, tức dư biên gấp 6–10 lần. Tốc độ khung hình **không** phải nút thắt; chất lượng ảnh mới là.

> **Lưu ý:** Bảng trên dựa trên FOV danh nghĩa. Nhóm sẽ thay bằng giá trị đo thật từ ma trận nội tham số thu được ở bước hiệu chuẩn camera (mục 5.2).

---

# 4. THIẾT KẾ PHẦN MỀM

## 4.1. Cấu trúc mã nguồn

```
uav-iot-cv/
├── backend/               # Python — trạm mặt đất
│   ├── app.py             # FastAPI, WebSocket, REST
│   ├── config.py
│   ├── mavlink/
│   │   ├── connection.py  # kết nối, heartbeat, tự nối lại
│   │   ├── telemetry.py   # đọc và chuẩn hóa telemetry
│   │   ├── control.py     # arm, mode, guided, dead-man switch
│   │   ├── mission.py     # tạo, kiểm tra, tải waypoint
│   │   └── safety.py      # geofence, kiểm tra tiền bay, failsafe
│   ├── vision/
│   │   ├── stream.py      # thu luồng MJPEG từ ESP32-CAM
│   │   ├── restore.py     # front-end khôi phục ảnh (giao diện thống nhất)
│   │   ├── detector.py    # YOLO + SAHI + ByteTrack
│   │   ├── geo.py         # chiếu tọa độ ảnh xuống mặt đất
│   │   ├── events.py      # sinh sự kiện, chống trùng lặp
│   │   └── recorder.py    # lưu ảnh và siêu dữ liệu
│   ├── mqtt/publisher.py
│   └── tests/
├── frontend/              # Web GCS thuần HTML/CSS/JS
│   ├── index.html
│   ├── telemetry.js  control.js  mission.js  map.js  video.js
├── esp32/
│   ├── camera/            # firmware ESP32-CAM + điều tiết thích ứng
│   └── mavlink_bridge/    # firmware cầu MAVLink
├── ml/
│   ├── scripts/
│   │   ├── measure_degradation.py   # đo hồ sơ suy giảm
│   │   ├── calibrate_camera.py      # hiệu chuẩn bàn cờ
│   │   ├── simulate_degradation.py  # sinh VisDrone-ESP32
│   │   ├── convert_visdrone.py
│   │   ├── split_dataset.py
│   │   ├── train.py
│   │   ├── evaluate.py
│   │   └── ablation_restore.py      # chạy toàn bộ ma trận ablation
│   ├── configs/  datasets/  weights/  results/
├── docs/
└── logs/
```

## 4.2. Backend trạm mặt đất

**Công nghệ:** Python 3.11, FastAPI, `pymavlink`, `uvicorn`, WebSocket cho telemetry và điều khiển.

**Các cơ chế an toàn bắt buộc:**

| Cơ chế | Hành vi |
|---|---|
| Dead-man switch | Lệnh Guided phải được làm mới mỗi 300 ms; quá hạn thì tự động gửi lệnh dừng |
| Kiểm tra nhiệm vụ trước khi tải | Từ chối waypoint ngoài geofence, độ cao vượt ngưỡng, khoảng cách giữa hai điểm quá lớn |
| Failsafe GCS | Mất kết nối web quá 5 giây khi đang Guided thì chuyển Loiter |
| Chống spam phát hiện | Một mục tiêu chỉ sinh một sự kiện; dùng theo vết và ngưỡng khoảng cách |
| Cách ly lỗi thị giác | Toàn bộ pipeline xử lý ảnh chạy trong tiến trình riêng; sập không ảnh hưởng luồng MAVLink |

## 4.3. Web Ground Control Station

Giao diện thuần HTML/CSS/JavaScript, không framework, để giảm phụ thuộc và dễ trình bày.

| Bảng | Nội dung |
|---|---|
| Bản đồ | Vị trí UAV thời gian thực, vẽ waypoint bằng cách nhấp chuột, quỹ đạo bay, ghim mục tiêu phát hiện |
| Telemetry | Độ cao, tọa độ, chế độ bay, điện áp và dung lượng pin, số vệ tinh, HDOP, chất lượng liên kết |
| Điều khiển | Nút chuyển chế độ, điều khiển bằng bàn phím ở chế độ Guided, các nút Hold / RTL / Land |
| Nhiệm vụ | Danh sách waypoint, nút kiểm tra, tải xuống, khởi động Auto |
| Video | Luồng MJPEG kèm khung bao phát hiện và nhãn tư thế |
| Sự kiện | Nhật ký phát hiện kèm ảnh chụp và tọa độ |

## 4.4. Firmware ESP32-CAM

Chức năng chính:
- Khởi tạo OV2640 ở chế độ JPEG, VGA 640×480, sử dụng PSRAM 4 MB, `fb_count = 2`
- Phục vụ luồng MJPEG qua HTTP
- **Vòng điều khiển QoS thích ứng** (mục 7.2)
- Đồng bộ thời gian NTP, đóng dấu thời gian cho từng khung
- Ghi song song lên thẻ microSD khi bật chế độ thu dữ liệu
- Cập nhật firmware OTA

> **Giới hạn đã biết:** ghi thẻ SD đồng thời với phát luồng ở VGA chỉ đạt khoảng 5–7 khung/giây. Khi thu dữ liệu huấn luyện, ưu tiên ghi SD và giảm tốc độ luồng.

## 4.5. Firmware cầu MAVLink

ESP32 DevKit đọc UART từ SERIAL2 của flight controller và chuyển tiếp hai chiều qua Wi-Fi UDP tới laptop. Chế độ hoạt động: điểm truy cập độc lập hoặc trạm kết nối vào router di động. Có bộ đếm gói mất và thời gian trễ để phục vụ phần đo đạc của môn IoT.

## 4.6. Định dạng dữ liệu giữa các khối

Mỗi khung ảnh đi kèm một bản ghi siêu dữ liệu, là nền tảng cho việc chiếu tọa độ và cho toàn bộ phân tích sau này:

```json
{
  "frame_id": "20260904T143012_004821",
  "ts_utc": 1788573012.483,
  "sortie_id": "A",
  "img_path": "raw/A/004821.jpg",
  "cam":  { "w": 640, "h": 480, "jpeg_q": 12 },
  "link": { "rssi_dbm": -67, "latency_ms": 38, "lost": 0 },
  "uav":  { "lat": 10.7626, "lon": 106.6822, "alt_rel_m": 8.4,
            "roll_deg": 1.2, "pitch_deg": -2.8, "yaw_deg": 93.5,
            "gps_fix": 3, "sats": 14, "hdop": 0.9 },
  "valid": true
}
```

Trường `valid` được đặt `false` khi độ lệch thời gian giữa ảnh và telemetry vượt ngưỡng, để loại khỏi phân tích hình học.

Mọi phương pháp khôi phục ảnh cài đặt cùng một giao diện, cho phép hoán đổi mà không sửa mã gọi:

```python
class Restorer:
    name: str
    def __call__(self, bgr: np.ndarray) -> np.ndarray: ...
    def latency_ms(self) -> float: ...
```

---

# 5. NỘI DUNG MÔN XỬ LÝ ẢNH

Phần này là trọng tâm học thuật của đề tài, gồm năm lớp nội dung xây chồng lên nhau.

## 5.1. Lớp 1 — Đặc tả suy giảm bằng đo đạc

Thay vì phỏng đoán "ảnh ESP32-CAM xấu", nhóm **đo** mức độ xấu bằng các bảng chuẩn chụp trong điều kiện kiểm soát.

| Đặc tính | Phương pháp đo | Bảng chuẩn |
|---|---|---|
| Độ sắc nét, hàm truyền điều biến MTF | Phương pháp cạnh nghiêng (slanted edge) | Bảng ISO 12233 in trên bìa cứng |
| Nhiễu Poisson–Gauss | Độ lệch chuẩn theo mức sáng trên vùng phẳng | Thang xám 11 bậc |
| Artifact khối JPEG | Năng lượng biên khối 8×8 trong miền DCT | Ảnh chuyển màu mượt |
| Méo xuyên tâm | Độ cong đường thẳng | Lưới ô vuông |
| Vignetting | Suy giảm độ sáng theo bán kính | Bề mặt trắng chiếu đều |
| Rolling shutter | Độ nghiêng vật thể chuyển động ngang | Con lắc / quạt quay đã biết tốc độ |

**Sản phẩm:** một tệp tham số `esp32cam_profile.yaml` mô tả camera bằng con số. Đây là dữ liệu gốc, không sao chép được từ bất kỳ bài báo nào, và là chương dữ liệu quan trọng nhất của báo cáo.

## 5.2. Lớp 2 — Hiệu chuẩn camera và khử méo

Nội dung kinh điển của môn học: chụp 20–30 ảnh bàn cờ ở nhiều góc, dùng `cv2.findChessboardCorners` và `cv2.calibrateCamera` để thu ma trận nội tham số **K** và hệ số méo **(k₁, k₂, p₁, p₂, k₃)**, sau đó khử méo bằng `cv2.undistort`.

Sản phẩm phục vụ hai mục đích: nâng chất lượng ảnh đầu vào cho bộ phát hiện, và cung cấp tham số hình học bắt buộc cho phép chiếu tọa độ ở lớp 5.

## 5.3. Lớp 3 — Mô phỏng suy giảm và thích nghi miền

**Vấn đề:** VisDrone là bộ dữ liệu ảnh **đẹp**, chụp bằng camera chất lượng cao. ESP32-CAM cho ảnh **xấu**. Mô hình huấn luyện trên VisDrone hoạt động kém trên ảnh thật của nhóm — đây gọi là khoảng cách miền (domain gap).

**Giải pháp:** dùng hồ sơ suy giảm đo được ở lớp 1 để **áp suy giảm có căn cứ vật lý** lên VisDrone, tạo miền tổng hợp `VisDrone-ESP32`:

| Bước mô phỏng | Tham số lấy từ |
|---|---|
| Hạ độ phân giải về 640×480 | Cấu hình camera |
| Nhòe quang học theo PSF đo được | MTF ở lớp 1 |
| Nhòe chuyển động, chiều dài L = v·t_phơi_sáng / GSD | Tốc độ bay và độ cao |
| Nhiễu Poisson–Gauss tham số (a, b) | Đo ở lớp 1 |
| Vignetting theo mô hình cos⁴ | Đo ở lớp 1 |
| Méo xuyên tâm | Hệ số ở lớp 2 |
| Nén JPEG với chất lượng q lấy mẫu theo phân bố thật | Nhật ký điều tiết thích ứng của lớp IoT |
| Biến dạng rolling shutter | Đo ở lớp 1 |

Điểm mấu chốt: **augmentation không ngẫu nhiên, mà theo tham số đo được từ chính camera của nhóm**. Báo cáo sẽ định lượng mức thu hẹp domain gap bằng chênh lệch mAP khi kiểm thử trên ảnh ESP32 thật.

## 5.4. Lớp 4 — Ablation front-end khôi phục ảnh

Đây là phần đậm đặc nội dung xử lý ảnh nhất.

| Nhóm | Phương pháp | Nhắm vào | Thư viện |
|---|---|---|---|
| Cổ điển | CLAHE | Tương phản cục bộ | `cv2.createCLAHE` |
| Cổ điển | Retinex đa tỉ lệ (MSR) | Thiếu sáng, ánh sáng không đều | Tự cài |
| Cổ điển | Hiệu chỉnh gamma thích ứng | Thiếu sáng | `cv2.LUT` |
| Cổ điển | Lọc song phương | Nhiễu, giữ cạnh | `cv2.bilateralFilter` |
| Cổ điển | Non-Local Means | Nhiễu | `cv2.fastNlMeansDenoisingColored` |
| Cổ điển | Giải chập Wiener | Nhòe | `skimage.restoration.wiener` |
| Cổ điển | Richardson–Lucy | Nhòe chuyển động | `skimage.restoration` |
| Cổ điển | Khử khối miền DCT | Artifact nén | Tự cài |
| Cổ điển | Unsharp masking | Độ sắc nét | `cv2` |
| Cổ điển | Nội suy Lanczos | Phóng đại | `cv2.resize` |
| Học sâu nhẹ | FSRCNN, ESPCN | Siêu phân giải ×2 | `cv2.dnn_superres` |
| Học sâu nhẹ | Zero-DCE++ | Thiếu sáng, không cần ảnh cặp | PyTorch |
| Đối chứng nặng | Real-ESRGAN | Trần trên của chất lượng | PyTorch |
| Thời gian | Hợp nhất đa khung có bù chuyển động | Nhiễu, không mất cạnh | Tự cài, dùng homography |

**Mỗi phương pháp được đo trên ba chiều, không phải một:**

1. **Chất lượng ảnh** — có tham chiếu: PSNR, SSIM, LPIPS. Không tham chiếu: BRISQUE, NIQE.
2. **Hiệu năng phát hiện** — Precision, Recall, mAP50, mAP50-95.
3. **Chi phí tính toán** — mili-giây trên mỗi khung, đo trên phần cứng thật của nhóm.

> **Kết luận dự kiến, và là giá trị chính của chương này:** ảnh "đẹp hơn với mắt người" **không** đồng nghĩa "phát hiện tốt hơn". Một số phương pháp sẽ tăng PSNR nhưng giảm mAP do làm mượt mất chi tiết của mục tiêu nhỏ. Đây là kết luận thật, có ý nghĩa thực tiễn, và là điểm phân biệt báo cáo này với các báo cáo chỉ chạy lại thư viện.

### Bộ dữ liệu ảnh cặp thật

Để PSNR và SSIM có ý nghĩa, cần ảnh tham chiếu **thật** chứ không phải ảnh suy giảm giả lập. Cách làm:

1. Gắn điện thoại ngay cạnh ESP32-CAM trên cùng một giá đỡ
2. Chụp đồng thời cùng cảnh
3. Căn chỉnh hai ảnh bằng ORB/SIFT + `cv2.findHomography` + RANSAC
4. Cắt vùng chồng lấn, thu được cặp (ảnh chất lượng thấp thật, ảnh chất lượng cao thật)

Chi phí: 0 đồng. Rất ít đồ án sinh viên có bộ dữ liệu cặp thật, và nó cho phép đánh giá khôi phục ảnh một cách chặt chẽ.

## 5.5. Lớp 5 — Đầu ra có ngữ nghĩa

Ba thành phần biến "có một người" thành thông tin có ích cho bài toán tuần tra:

**a) Suy luận theo lát cắt — SAHI.** Người nhìn từ độ cao 8 m chỉ chiếm khoảng 38 điểm ảnh, quá nhỏ cho suy luận toàn ảnh. SAHI cắt ảnh thành các lát 320×320 chồng lấn 20%, chạy phát hiện trên từng lát rồi gộp bằng NMS. Trên VisDrone, kỹ thuật này được báo cáo tăng AP **6.8%** khi chỉ áp dụng lúc suy luận, và tới **12.7%** khi kết hợp tinh chỉnh theo lát. Bản thân việc cắt, gộp và khử trùng lặp là nội dung xử lý ảnh.

**b) Theo vết và đếm — ByteTrack.** Gán định danh ổn định cho từng người qua các khung, cho phép đếm **số người duy nhất** thay vì số lần phát hiện, dựng quỹ đạo và đo thời gian lưu lại. Đồng thời loại bỏ hiện tượng một mục tiêu sinh hàng trăm sự kiện.

**c) Phân loại tư thế.** Phân biệt **đứng / ngồi / nằm**, dùng tỉ lệ khung bao kết hợp mô hình ước lượng khớp nhẹ trên vùng cắt. Tư thế nằm bất động là dấu hiệu nạn nhân trong bối cảnh tìm kiếm cứu nạn — biến hệ thống từ "bộ đếm người" thành "hệ thống phát hiện bất thường".

## 5.6. Chiếu tọa độ mục tiêu lên bản đồ

Sử dụng nội tham số **K** từ lớp 2, độ cao tương đối và tư thế UAV từ telemetry, cùng giả thiết mặt đất phẳng:

1. Lấy điểm giữa cạnh dưới khung bao (điểm tiếp đất ước lượng)
2. Khử méo, chuyển sang tọa độ chuẩn hóa bằng **K⁻¹**
3. Xoay theo ma trận tư thế UAV (roll, pitch, yaw)
4. Chiếu tia xuống mặt phẳng z = 0 để thu tọa độ mặt đất tương đối
5. Chuyển sang kinh độ / vĩ độ theo vị trí UAV

**Phân tích sai số:** đặt người ở các vị trí đã biết trên sân, đo sai lệch bằng thước dây ở nhiều độ cao và góc nghiêng. Báo cáo trình bày sai số trung bình và độ lệch chuẩn, kèm phân tích nguồn sai số chủ đạo (sai số tư thế, sai số độ cao khí áp kế, giả thiết mặt phẳng).

Đây là phần trung thực và có giá trị: hệ thống **ước lượng** vị trí người kèm sai số công bố, không tuyên bố đo chính xác.

## 5.7. Chương mở rộng — Ghép bản đồ ảnh và phát hiện thay đổi

Thực hiện nếu nhóm xin được địa điểm bay và còn thời gian.

**Ghép bản đồ ảnh (mosaicking):** bay tuyến zigzag, ghép các khung thành một bản đồ ảnh của khu vực. Nội dung: trích đặc trưng ORB/AKAZE, khớp đặc trưng, RANSAC, ước lượng homography, warping, hòa trộn đa dải, cân bằng phơi sáng giữa các khung.

**Phát hiện thay đổi giữa hai lượt tuần tra:** bay lượt A khi khu vực sạch, đặt vật hoặc người vào, bay lượt B theo cùng lộ trình, rồi chỉ ra cái gì đã xuất hiện. Nội dung: đăng ký ảnh đa thời điểm, chuẩn hóa độ sáng, hiệu ảnh, ngưỡng hóa thích nghi, hình thái học khử nhiễu đốm, gán nhãn thành phần liên thông.

Chương này cho trục khôi phục ảnh một **thước đo thứ hai ngoài mAP**: mỗi phương pháp khôi phục làm tỉ lệ đặc trưng inlier tăng bao nhiêu và sai số reprojection giảm bao nhiêu. Đó là câu hỏi xử lý ảnh thuần hình học, không dính học sâu.

**Rủi ro đã biết:** giả thiết mặt phẳng của homography bị vi phạm khi bay thấp qua cây và công trình, gây bóng ma và lệch ghép. Giảm thiểu bằng cách bay cao hơn (12–15 m) trên khu vực phẳng, và ghi rõ giả thiết trong báo cáo. GPS sai số 2–3 m cũng khiến hai lượt bay không ra cùng khung hình, nên bắt buộc đăng ký ảnh-với-ảnh chứ không so theo tọa độ GPS.

---

# 6. HUẤN LUYỆN VÀ ĐÁNH GIÁ MÔ HÌNH

## 6.1. Dữ liệu

| Nguồn | Vai trò | Quy mô |
|---|---|---|
| VisDrone-DET | Dữ liệu nền, ảnh hàng không chất lượng cao | 6471 huấn luyện / 548 kiểm định / 1610 kiểm thử |
| VisDrone-ESP32 (tổng hợp) | Thích nghi miền, sinh ở lớp 3 | Bằng quy mô VisDrone |
| Dữ liệu ESP32 tự thu | Miền đích thật | Mục tiêu 1500–2500 ảnh có nhãn |
| Ảnh cặp ESP32 ↔ điện thoại | Tham chiếu cho đánh giá khôi phục | 300–500 cặp |

**Chuyển đổi nhãn VisDrone:** gộp lớp `pedestrian` và `people` thành một lớp duy nhất `person` (chỉ số 0), loại bỏ các lớp phương tiện.

**Thu dữ liệu ESP32 khi chưa bay được:** gắn camera lên sào dài 2–3 m, ban công tầng 2–3, hoặc xe đẩy di chuyển chậm. Suy giảm ảnh là đặc tính của **camera**, không phải của việc bay — nên dữ liệu thu theo cách này có giá trị khoa học tương đương cho việc nghiên cứu khôi phục ảnh. Chỉ góc nhìn và độ cao là khác, và có thể mô phỏng bằng cách chụp từ tầng cao.

**Chia tập dữ liệu:** 70% huấn luyện, 15% kiểm định, 15% kiểm thử. Chia theo **cảnh quay**, không chia theo khung ảnh, để tránh rò rỉ dữ liệu giữa các tập. Tập kiểm thử luôn là **ảnh ESP32 thật, không augment**.

## 6.2. Các mô hình so sánh

| Mô hình | Cấu hình | Câu hỏi trả lời |
|---|---|---|
| **A** | YOLO11n tiền huấn luyện COCO, không tinh chỉnh | Baseline sẵn có làm được đến đâu? |
| **B** | A + tinh chỉnh trên VisDrone-person | Dữ liệu hàng không giúp bao nhiêu? |
| **C** | B + tinh chỉnh trên dữ liệu ESP32 thật | Dữ liệu miền đích giúp bao nhiêu? |
| **D** | C + huấn luyện thêm trên VisDrone-ESP32 tổng hợp | Mô phỏng suy giảm có thay thế được dữ liệu thật không? |
| **E** | D + suy luận SAHI | Kỹ thuật lát cắt giúp bao nhiêu với mục tiêu nhỏ? |
| **F** | E + front-end khôi phục tốt nhất từ lớp 4 | Khôi phục ảnh giúp bao nhiêu? |
| **G** | F + hợp nhất đa khung | Thông tin thời gian giúp bao nhiêu? |

## 6.3. Cấu hình huấn luyện

| Tham số | Giá trị |
|---|---|
| Kiến trúc | YOLO11n (Ultralytics) |
| Kích thước ảnh vào | 640 |
| Số vòng lặp | 100, dừng sớm với kiên nhẫn 30 |
| Kích thước lô | 16 |
| Bộ tối ưu | AdamW, tốc độ học ban đầu 0.001 |
| Phần cứng | GPU máy nhóm hoặc Google Colab (T4) |
| Augmentation cơ bản | Lật ngang, HSV, mosaic |
| Augmentation suy giảm | **Chỉ áp dụng cho tập huấn luyện**, theo tham số đo được |

**Nguyên tắc bắt buộc:** không bao giờ augment tập kiểm thử. Tập kiểm thử phải phản ánh điều kiện triển khai thật.

## 6.4. Ma trận thí nghiệm

Bảng kết quả chính của báo cáo. Mỗi ô ghi Precision / Recall / mAP50 / mAP50-95.

| Cấu hình | Ảnh sạch | Nhòe | Thiếu sáng | Nén mạnh | Cao 5 m | Cao 8 m | Cao 12 m | ms/khung |
|---|---|---|---|---|---|---|---|---|
| A — COCO | | | | | | | | |
| B — + VisDrone | | | | | | | | |
| C — + dữ liệu ESP32 | | | | | | | | |
| D — + mô phỏng suy giảm | | | | | | | | |
| E — D + SAHI | | | | | | | | |
| F — E + khôi phục ảnh | | | | | | | | |
| G — F + hợp nhất đa khung | | | | | | | | |

Kèm bảng ablation riêng cho lớp 4, mỗi phương pháp khôi phục một dòng, các cột: PSNR, SSIM, LPIPS, BRISQUE, mAP50, mAP50-95, ms/khung.

## 6.5. Chỉ số đánh giá và nguyên tắc báo cáo

Báo cáo **không** được dùng con số kiểu "độ chính xác 95%" mà không nói rõ đó là chỉ số gì, tính trên tập nào, ở ngưỡng tin cậy nào. Mọi kết quả phải kèm: tên chỉ số, tập dữ liệu, ngưỡng IoU, ngưỡng tin cậy, và số lượng mẫu.

---

# 7. NỘI DUNG MÔN IoT

## 7.1. Kiến trúc ba tầng

| Tầng | Thiết bị | Vai trò |
|---|---|---|
| Biên (edge) | ESP32-CAM, ESP32 bridge | Thu cảm biến, nén, truyền, điều tiết thích ứng |
| Sương mù (fog) | Laptop trạm mặt đất | Xử lý ảnh, ra quyết định, lưu trữ |
| Ứng dụng | Web GCS, MQTT broker, dashboard | Trình bày, cảnh báo, tích hợp |

## 7.2. Đóng góp chính — vòng điều khiển QoS thích ứng

ESP32-CAM tự điều chỉnh `jpeg_quality`, độ phân giải và tốc độ khung hình dựa trên phản hồi từ laptop về cường độ tín hiệu RSSI và độ trễ vòng.

```
Đo RSSI + độ trễ  →  So với ngưỡng  →  Điều chỉnh jpeg_quality / framesize / fps
        ▲                                              │
        └──────────────────────────────────────────────┘
```

**Vì sao đây là đóng góp có giá trị:** nó **nối hai môn học lại thành một hệ thống thống nhất**. Vòng điều khiển của môn IoT chính là thứ **tạo ra** sự biến thiên chất lượng ảnh mà môn Xử lý ảnh nghiên cứu. Báo cáo sẽ trình bày chuỗi quan hệ đo được:

> RSSI → `jpeg_quality` → mức artifact nén → mAP

Đây là một đồ án, hai môn học, một sợi dây logic chung — thay vì hai đồ án dán cạnh nhau.

## 7.3. Các cơ chế IoT khác

| Cơ chế | Mục đích |
|---|---|
| Đồng bộ thời gian NTP | Ghép ảnh với telemetry chính xác — bắt buộc cho phép chiếu tọa độ |
| Đệm và gửi lại | Lưu tạm lên thẻ SD khi mất liên kết, gửi bù khi khôi phục |
| Cập nhật firmware OTA | Sửa firmware không cần tháo drone |
| MQTT | Công bố sự kiện phát hiện theo chủ đề, tách rời khỏi web |
| Nhật ký có cấu trúc | Mọi phiên bay ghi telemetry, ảnh, sự kiện, tham số ra tệp có dấu thời gian |

**Chủ đề MQTT dự kiến:**

```
uav/telemetry          — vị trí, độ cao, chế độ, pin (1 Hz)
uav/link               — RSSI, độ trễ, tỉ lệ mất gói (0.5 Hz)
uav/detection          — sự kiện phát hiện kèm tọa độ và ảnh
uav/status             — trạng thái hệ thống, cảnh báo
```

## 7.4. Thí nghiệm đo đạc của môn IoT

| Thí nghiệm | Đại lượng đo | Cách đo |
|---|---|---|
| Độ trễ lệnh đầu cuối | ms | Dấu thời gian lúc nhấn phím → lúc backend gửi MAVLink |
| Độ trễ luồng ảnh | ms | Dấu thời gian đóng vào khung tại ESP32 → lúc backend nhận |
| Độ trễ MQTT | ms | Từ lúc sinh sự kiện → lúc dashboard hiển thị |
| Tỉ lệ mất gói telemetry | % | Bộ đếm tuần tự trong gói |
| RSSI theo khoảng cách | dBm | Đo tại 10, 25, 50, 75, 100 m |
| Tốc độ khung hình theo RSSI | fps | Ghi đồng thời với RSSI |
| Tần suất cập nhật GPS | Hz | Đếm bản tin trong 60 giây |

## 7.5. Ma trận thử nghiệm hỏng hóc

| Kịch bản | Hành vi mong đợi |
|---|---|
| Mất camera | Drone bay bình thường, web báo mất luồng video |
| Pipeline thị giác sập | Luồng MAVLink không ảnh hưởng, drone giữ chế độ bay |
| Đóng trình duyệt khi đang Guided | Dead-man switch kích hoạt, chuyển Loiter |
| Mất Wi-Fi telemetry | Drone giữ chế độ hiện tại, sau ngưỡng thì RTL |
| Mất tín hiệu RC | Failsafe RC kích hoạt, RTL |
| Pin xuống ngưỡng | Failsafe pin kích hoạt, hạ cánh hoặc RTL |
| Vượt geofence | Bị chặn, đưa về trong vùng |

---

# 8. LỘ TRÌNH TRIỂN KHAI

## 8.1. Nguyên tắc chi tiêu theo cổng

Chỉ mở khóa chi phí của giai đoạn sau khi giai đoạn trước đã chứng minh dự án khả thi.

| Cổng | Chi phí | Điều kiện mở khóa cổng tiếp theo |
|---|---|---|
| **G0 — Mô phỏng** | 0 đ | Web GCS điều khiển được drone ảo trong ArduPilot SITL: telemetry, bản đồ, Guided, tải waypoint, bay Auto, RTL |
| **G1 — Thị giác** | ~450 k | ESP32-CAM hoạt động; hoàn thành lớp 1, 2, 3, 4 của môn Xử lý ảnh |
| **G2 — Bay thủ công** | ~4 tr | Lắp xong, hiệu chỉnh xong, bay được Stabilize → AltHold → Loiter → RTL bằng tay |
| **G3 — Tích hợp** | ~1 tr | Bay Auto từ web với drone thật, phát hiện hiển thị trên dashboard |

**Điểm quan trọng:** sau cổng G1 với chi phí khoảng 450 nghìn, nhóm đã có **đủ một đồ án Xử lý ảnh hoàn chỉnh và độc lập**. Nếu drone gặp sự cố ở G2, môn Xử lý ảnh vẫn an toàn tuyệt đối.

## 8.2. Tiến độ theo tuần

| Tuần | Nội dung chính | Mốc kiểm tra |
|---|---|---|
| 1–2 | Cài môi trường, ArduPilot SITL, kết nối MAVLink, telemetry ra web | Drone ảo hiện trên bản đồ |
| 2–3 | Bản đồ, điều khiển Guided, dead-man switch, các nút Hold/RTL/Land | Điều khiển được drone ảo bằng bàn phím |
| 3–4 | Tạo, kiểm tra, tải waypoint; bay Auto trên SITL | Hoàn thành cổng G0 |
| 3–5 | Nhận ESP32-CAM; đo hồ sơ suy giảm; hiệu chuẩn camera; thu ảnh cặp | Có `esp32cam_profile.yaml` và ma trận **K** |
| 5–7 | Chuyển đổi VisDrone, mô phỏng suy giảm, huấn luyện mô hình A–D | Bảng so sánh 4 mô hình đầu |
| 6–8 | Ablation khôi phục ảnh, tích hợp SAHI và theo vết | Hoàn thành cổng G1 |
| 7–9 | Nhận phần cứng bay; kiểm tra từng linh kiện; lắp ráp; hiệu chỉnh | Qua ba cổng an toàn phần cứng |
| 9–11 | Bay thử: Stabilize → AltHold → Loiter → RTL → Auto bằng Mission Planner | Hoàn thành cổng G2 |
| 11–13 | Cầu MAVLink ESP32; bay Auto từ web; gắn camera; thu dữ liệu bay thật | Hoàn thành cổng G3 |
| 13–14 | Tinh chỉnh lại mô hình trên dữ liệu bay thật; chạy ma trận thí nghiệm cuối | Bảng kết quả đầy đủ |
| 14–15 | Chương mở rộng (mosaic, phát hiện thay đổi) nếu kịp; viết báo cáo; demo | Nộp |

Dành 2 tuần dự phòng cho va chạm, mưa, hỏng linh kiện và chờ hàng.

## 8.3. Quy trình lắp ráp phần cứng

Nguyên tắc xuyên suốt: **hàn và kiểm tra hết trên bàn trước, bắt lên khung sau.**

| Bước | Nội dung | Thời gian |
|---|---|---|
| 0 | Chuẩn bị, in 3D mount camera và mast GPS, tập hàn trên bo tập | 30 phút |
| 1 | Lắp khung S500, bắt càng, dùng keo khóa ren Loctite 243 | 30 phút |
| 2 | Gắn 4 motor, luồn và nối dài dây motor về tâm | 40 phút |
| 3 | Hàn dây motor vào pad M1–M4; hàn XT60 và tụ (chú ý cực tính) | 45 phút |
| **Cổng an toàn 1** | **Cấp điện lần đầu QUA smoke stopper, test bo ESC một mình** | 10 phút |
| 4 | Cắm cáp ribbon FC–ESC, cắm GPS, receiver, buzzer | 20 phút |
| 5 | Bắt tháp lên khung (mũi tên hướng trước), dựng mast GPS | 20 phút |
| 6 | Gắn payload, cân trọng tâm | 20 phút |
| **7** | **Đo lực đẩy trên cân điện tử và cân khối lượng cất cánh thật; xác nhận tỉ số ≥ 2:1** | **30 phút** |

## 8.4. Quy trình cấu hình ArduPilot

1. Nạp firmware Copter target `speedybeef4v5`
2. Frame type: **Quad X**
3. Hiệu chuẩn gia tốc kế (6 mặt)
4. Hiệu chuẩn la bàn — **làm ngoài trời**, xa kim loại
5. Hiệu chuẩn tay điều khiển; iA6B đặt chế độ iBUS
6. Gán kênh 5 cho chế độ bay, kênh 6 cho RTL
7. Hiệu chỉnh cảm biến pin bằng điện áp đo thật
8. Đặt `MOT_PWM_TYPE = 6` (DShot600), `SERVO_BLH_AUTO = 1`
9. **Tháo cánh**, chạy Motor Test A/B/C/D, xác nhận đúng motor và đúng chiều
10. Sai chiều thì hoán 2 trong 3 dây motor
11. Cấu hình failsafe: mất RC → RTL, pin yếu → RTL, mất GCS → Loiter
12. Đặt geofence
13. Chạy đến khi kiểm tra tiền bay sạch hoàn toàn
14. **Bỏ qua hiệu chỉnh ESC** — DShot không cần

---

# 9. AN TOÀN VÀ PHÁP LÝ

## 9.1. Quy định pháp lý

Từ **20/07/2026**, drone và phương tiện bay tại Việt Nam phải đăng ký với cơ quan đăng ký phương tiện bay thuộc Bộ Công an, kèm giấy phép người điều khiển và phép bay theo từng chuyến. Không tìm thấy ngưỡng miễn trừ theo khối lượng, và drone tự lắp cần chứng minh nguồn gốc cùng tiêu chuẩn kỹ thuật.

**Đây là rủi ro thật đối với đồ án.** Biện pháp giảm thiểu:

1. Xin khoa cấp văn bản cho phép bay thử trong khuôn viên trường
2. Bay thấp trong khu vực có kiểm soát, không người qua lại
3. **Giữ nguyên tắc: môn Xử lý ảnh không phụ thuộc vào việc bay được** (kiến trúc cổng G1)
4. Trao đổi với giảng viên hướng dẫn **trước khi** chi phần cứng bay

## 9.2. An toàn vận hành

| Quy tắc | Lý do |
|---|---|
| Cánh là thứ gắn cuối cùng, sau khi mọi kiểm tra đã qua | Hầu hết tai nạn khi lắp xảy ra với cánh đã gắn |
| Đeo kính bảo hộ mỗi khi có điện vào drone | Cánh 1045 quay ở khoảng 8000 vòng/phút |
| Sạc và cất LiPo trong túi chống cháy, không sạc qua đêm | Rủi ro cháy lớn nhất của dự án là pin, không phải bo mạch |
| Mọi lần cấp điện đầu tiên đi qua smoke stopper | Ngắt mạch trong 3 ms, biến sự cố chập từ mất 2 triệu thành mất 30 giây |
| Đo thông mạch giữa cực dương và âm trước mỗi lần cắm pin | Phát hiện cầu thiếc trước khi LiPo đổ hơn 100 A vào |
| Bán kính bãi bay tối thiểu 20 m, không người, không gió mạnh | Lần bay đầu luôn có rủi ro mất kiểm soát |
| Luôn có người cầm tay điều khiển sẵn sàng chuyển sang chế độ thủ công | RC là đường dự phòng độc lập duy nhất |

## 9.3. Quản lý phiên bản và nhật ký

- **Mã nguồn** quản lý bằng Git, mỗi giai đoạn một nhánh, gộp qua pull request
- **Tham số bay** xuất ra tệp sau mỗi lần thay đổi, đặt tên theo ngày, commit vào repo
- **Nhật ký bay** tải về sau **mỗi** chuyến bay, đọc trước khi bay chuyến tiếp theo
- **Nhật ký thử nghiệm** ghi ngày, cấu hình, hiện tượng, kết luận cho từng lần thử
- **Kết quả huấn luyện** lưu kèm cấu hình, seed, phiên bản dữ liệu để tái lập được

---

# 10. RỦI RO VÀ PHƯƠNG ÁN DỰ PHÒNG

| # | Rủi ro | Mức độ | Phương án giảm thiểu |
|---|---|---|---|
| 1 | Mua nhầm GPS không có la bàn | **Cao** | Kiểm tra listing trước khi thanh toán; nếu lỡ thì mua module la bàn I2C rời (~150 k) |
| 2 | Chưa xin được địa điểm bay | **Cao** | Kiến trúc cổng G1: thu dữ liệu bằng sào, ban công, tầng cao; môn Xử lý ảnh hoàn thành độc lập |
| 3 | Tầm sóng Wi-Fi ESP32-CAM không đủ | Cao | Bản IPEX + anten ngoài; phương án B là ghi song song lên thẻ SD |
| 4 | Rung động làm nhòe ảnh, rolling shutter | Trung bình | Damper cao su, đặt camera xa motor, cân bằng cánh; đồng thời đưa vào hồ sơ suy giảm như một đối tượng nghiên cứu |
| 5 | **Lực đẩy thực tế thấp hơn ước lượng, drone ì hoặc không cất cánh** | **Cao** | Chọn pin 4S ngay từ đầu (2.9:1 thay vì 2.1:1); **đo lực đẩy trên cân trước lần bay đầu**; dự phòng cánh 1047/1147 |
| 6 | Drone rơi vỡ giữa kỳ | Trung bình | Mua dự phòng 1 motor, 2 càng, 3 bộ cánh ngay từ đầu |
| 7 | Hỏng bo mạch do đấu sai | Trung bình | Smoke stopper bắt buộc; đo thông mạch; test ESC riêng trước khi ghép FC |
| 8 | Thiếu dữ liệu huấn luyện miền đích | Trung bình | Mô phỏng suy giảm lên VisDrone (lớp 3) chính là biện pháp bù |
| 9 | Chương mở rộng không kịp | Thấp | Đã thiết kế là stretch goal, không nằm trong tiêu chí hoàn thành |
| 10 | Parallax phá hỏng ghép ảnh | Thấp | Bay 12–15 m trên khu vực phẳng; ghi rõ giả thiết trong báo cáo |
| 11 | Chờ hàng Alibaba kéo dài | Trung bình | Đặt sớm; trong lúc chờ hoàn thành toàn bộ cổng G0 trên SITL |

---

# 11. TIÊU CHÍ HOÀN THÀNH

Dự án **không** được coi là hoàn thành khi "code xong". Dự án hoàn thành khi kịch bản sau chạy được từ đầu đến cuối:

1. Mở web GCS trên laptop, thấy UAV trên bản đồ với telemetry đầy đủ
2. Nhấp chuột vẽ một lộ trình waypoint trên bản đồ
3. Nhấn kiểm tra — hệ thống xác nhận lộ trình hợp lệ, nằm trong geofence
4. Tải lộ trình xuống flight controller
5. Cất cánh, chuyển chế độ Auto, UAV bay đúng lộ trình đã vẽ
6. Trong khi bay, luồng ảnh hiện trên web, có khung bao và nhãn tư thế
7. Khi phát hiện người, hệ thống sinh một sự kiện duy nhất kèm ảnh chụp và tọa độ ước lượng, ghim lên bản đồ
8. Nhấn RTL, UAV tự quay về điểm cất cánh và hạ cánh
9. Tắt trình duyệt giữa chừng — UAV không mất kiểm soát
10. Toàn bộ nhật ký bay, ảnh, sự kiện được lưu lại đầy đủ để phân tích

**Phần Xử lý ảnh hoàn thành khi:** có hồ sơ suy giảm đo được, có ma trận nội tham số camera, có bộ dữ liệu VisDrone-ESP32, có bảng ablation đầy đủ ba chiều đánh giá, có ma trận thí nghiệm 7 cấu hình, và có phân tích sai số của phép chiếu tọa độ.

**Phần IoT hoàn thành khi:** có số liệu đo độ trễ, tỉ lệ mất gói, RSSI theo khoảng cách, có vòng điều khiển QoS thích ứng hoạt động và đo được, và ma trận thử nghiệm hỏng hóc đã chạy đủ 7 kịch bản.

---

# 12. PHỤ LỤC

## 12.1. Tham số ArduPilot quan trọng

| Tham số | Giá trị | Ý nghĩa |
|---|---|---|
| `FRAME_CLASS` | 1 | Quad |
| `FRAME_TYPE` | 1 | Cấu hình X |
| `MOT_PWM_TYPE` | 6 | DShot600 |
| `SERVO_BLH_AUTO` | 1 | Tự động cấu hình đầu ra DShot |
| `SERIAL2_PROTOCOL` | 2 | MAVLink2 cho cầu ESP32 |
| `SERIAL4_PROTOCOL` | 5 | GPS |
| `SERIAL6_PROTOCOL` | 23 | RCIN cho iBUS |
| `FS_THR_ENABLE` | 1 | Failsafe mất RC → RTL |
| `BATT_FS_LOW_ACT` | 2 | Failsafe pin yếu → RTL |
| `BATT_LOW_VOLT` | 14.0 | Ngưỡng pin yếu cho 4S (3.5 V/cell). Trùng với `Holybro-S500.param` chính hãng ArduPilot |
| `BATT_CRT_VOLT` | 13.2 | Ngưỡng nguy hiểm cho 4S (3.3 V/cell) |
| `BATT_VOLT_PIN` | **11** | Chân ADC của **F405 V5**. File `Holybro-S500.param` ghi 0 — đó là chân của Pix32v5, nạp nguyên file vào là sai |
| `BATT_CURR_PIN` | **15** | Như trên; file chính hãng ghi 1 |
| `BATT_VOLT_MULT` | **11.2** | Như trên; file chính hãng ghi 18.182 |
| `BATT_AMP_PERVLT` | *tự hiệu chỉnh* | Mặc định 1 chắc chắn sai; phải đo bằng kìm ampe hoặc đối chiếu mAh đã nạp lại |
| `FS_GCS_ENABLE` | 1 | Failsafe mất trạm mặt đất |
| `FENCE_ENABLE` | 1 | Bật geofence |
| `RTL_ALT_M` | 15 | Độ cao RTL tối thiểu 15 m (đơn vị **mét** trên ArduCopter 4.7+; tên cũ `RTL_ALT` đơn vị cm đã bị xoá) |

## 12.2. Danh mục linh kiện tóm tắt

| Nhóm | Món chính |
|---|---|
| Khung | Holybro S500 V2 bản PCB, chân đáp cao ✅ *đã mua* |
| Động lực | T-Motor AIR GEAR 450 II — AIR2216II KV920 ×4 ✅; cánh T1045 ×8 (4 dùng + 4 dự phòng) ✅; **chưa có motor dự phòng** |
| Điều khiển bay | SpeedyBee F405 V5 OX32 55A Deluxe ✅; Holybro M10 v1 **kèm la bàn IST8310** ✅; cột nâng GPS ✅ |
| RC | FlySky FS-i6X + iA6B ✅; pin AA hoặc adapter |
| Nguồn | LiPo Ovonic **4S 5300mAh 110C ×1** ✅ (viên thứ hai để sau, mua đúng cùng loại); SkyRC iMAX B6AC V2 ✅; túi chống cháy ✅; **UBEC 5V 3A đầu vào 2–6S ×2** ⬜ đợt 3; XT60; **dây silicone 16AWG 4,5m** ⬜; tụ 1000µF (có trong bản Deluxe) ✅ |
| Gắn kết | **Bát chống rung 30,5×30,5** ⬜ *bắt buộc, chưa mua*; gen co nhiều cỡ ⬜; dây rút ⬜ |
| Thị giác + IoT | ESP32-CAM bản IPEX + anten; đế nạp ESP32-CAM-MB; ESP32 DevKit V1 ×2; thẻ microSD 32GB; mount camera + damper |
| An toàn | Kính bảo hộ; keo khóa ren Loctite 243; smoke stopper (có trong bản Deluxe); velcro, dây rút, gen co |
| Hiệu chuẩn | Bảng bàn cờ in A3 trên bìa cứng; thang xám; thước dây |

## 12.3. Thư viện phần mềm chính

| Mục đích | Thư viện |
|---|---|
| Giao tiếp bay | `pymavlink`, ArduPilot SITL, Mission Planner |
| Web backend | `fastapi`, `uvicorn`, `websockets` |
| Xử lý ảnh | `opencv-python`, `opencv-contrib-python` (dnn_superres), `scikit-image`, `numpy` |
| Học sâu | `ultralytics` (YOLO11), `torch`, `sahi` |
| Đánh giá chất lượng ảnh | `piq` hoặc `pyiqa` (BRISQUE, NIQE, LPIPS) |
| IoT | `paho-mqtt`, Mosquitto broker |
| Firmware | Arduino IDE / PlatformIO, `esp32-camera`, thư viện MAVLink C |

## 12.4. Thuật ngữ

| Thuật ngữ | Giải thích |
|---|---|
| AUW | All-Up Weight — khối lượng cất cánh toàn bộ |
| BEC | Battery Eliminator Circuit — mạch hạ áp cấp nguồn cho thiết bị 5V |
| ESC | Electronic Speed Controller — mạch điều tốc động cơ |
| FC | Flight Controller — bộ điều khiển bay |
| GSD | Ground Sample Distance — kích thước thực tế mà một điểm ảnh bao phủ trên mặt đất |
| MTF | Modulation Transfer Function — hàm truyền điều biến, thước đo độ sắc nét quang học |
| PSF | Point Spread Function — hàm trải điểm, mô tả cách một điểm sáng bị nhòe |
| RTL | Return To Launch — tự động bay về điểm cất cánh |
| SAHI | Slicing Aided Hyper Inference — suy luận theo lát cắt cho vật thể nhỏ |
| T/W | Thrust-to-Weight ratio — tỉ số lực đẩy trên khối lượng |
| mAP | mean Average Precision — độ chính xác trung bình, chỉ số chuẩn cho phát hiện đối tượng |

## 12.5. Tài liệu tham khảo chính

1. ArduPilot Copter Documentation — `ardupilot.org/copter`
2. ArduPilot hwdef, SpeedyBee F405 V5 — `github.com/ArduPilot/ardupilot/tree/master/libraries/AP_HAL_ChibiOS/hwdef/speedybeef4v5`
3. ArduPilot i-BUS Telemetry — `ardupilot.org/copter/docs/common-ibus-telemetry.html`
4. Akyon F. C. et al., *Slicing Aided Hyper Inference and Fine-tuning for Small Object Detection*, ICIP 2022 — `arxiv.org/abs/2202.06934`
5. Zhu P. et al., *VisDrone-DET: Vision Meets Drones Detection Challenge*
6. Guo C. et al., *Zero-Reference Deep Curve Estimation for Low-Light Image Enhancement*, CVPR 2020
7. Ultralytics YOLO11 Documentation
8. Espressif ESP32 Camera Driver Documentation
9. Thông tư và quy định về đăng ký phương tiện bay không người lái, hiệu lực từ 20/07/2026

---

*Tài liệu này là bản thiết kế làm việc, được cập nhật khi có kết quả đo đạc thực tế. Mọi con số được đánh dấu "ước lượng" phải được thay bằng giá trị đo trước khi đưa vào báo cáo cuối.*
