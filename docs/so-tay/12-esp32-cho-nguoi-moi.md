# Sổ tay 12 — ESP32 cho người mới

Trang này dành cho người chưa từng nạp một con vi điều khiển nào. Đọc xong bạn biết hai con ESP32
trong dự án làm gì, vì sao chúng nối vào laptop chứ không phải ngược lại, và vì sao vài con số
cấu hình lại "ngược đời".

Lệnh cụ thể nằm ở `firmware/dronebridge/README.md` (ESP32 telemetry) và `firmware/camera/README.md`
(bo camera). Trang này chỉ giải thích khái niệm.

## 1. ESP32 là gì

Một con **vi điều khiển** có sẵn Wi-Fi (và Bluetooth), giá vài trăm nghìn, chạy **một** chương trình
bạn nạp vào. Không phải máy tính: không có hệ điều hành theo nghĩa Windows/Linux, không có ổ đĩa để
cài thêm phần mềm. Cắm điện là nó chạy đúng chương trình đã nạp, từ đầu, mãi mãi, cho tới khi bạn
nạp chương trình khác.

"Nạp" (flash) là ghi chương trình vào bộ nhớ flash của chip qua cáp USB. Trên bo có một con chip
chuyển USB sang cổng nối tiếp (CP2102 hay CH343P) để máy tính nói chuyện được với ESP32 — vì thế
Windows thấy bo như một cổng `COMx`.

## 2. Hai con ESP32 trong dự án — đừng lẫn

| | ESP32 telemetry | Bo camera |
|---|---|---|
| Phần cứng | ESP32 DevKit 30 chân, chip USB **CP2102** | **ESP32-S3 N16R8** + module camera **OV3660**, chip USB **CH343P** |
| Cổng trên máy dự án | COM4 | COM7 |
| Firmware | **DroneBridge** — tải về, không viết mã | **tự viết** — `firmware/camera/` |
| Việc | chuyển MAVLink giữa bo bay và laptop | chụp ảnh, phát luồng MJPEG cho backend |
| Tên trên mạng | `DroneBridgeESP32.mshome.net` | `iotcv-camera.mshome.net` |

Vì sao một con dùng firmware có sẵn, con kia tự viết: cầu MAVLink là bài toán đã có lời giải tốt
(DroneBridge xử lý mất sóng, bộ đệm, web cấu hình); camera theo hợp đồng header riêng của dự án thì
không có firmware đóng gói sẵn nào làm.

Cả hai **không** phải bo bay. Bo bay (SpeedyBee F405) chạy ArduPilot, là chip STM32, nạp kiểu khác
hẳn (sổ tay 11).

## 3. AP và STA

- **AP** (Access Point) = **phát** Wi-Fi, như cục router ở nhà.
- **STA** (Station) = **nối vào** Wi-Fi của người khác, như điện thoại của bạn.

Dự án này: **laptop là AP** (Mobile Hotspot), **cả hai ESP32 là STA**. Lý do: card Wi-Fi laptop chỉ
nối được **một** AP một lúc. Nếu mỗi ESP32 tự phát Wi-Fi, laptop phải chọn hoặc telemetry hoặc
video. Đảo lại, laptop phát một mạng, hai ESP32 cùng vào, xong. Cách bật hotspot:
`docs/so-tay/12-hotspot-laptop.md`.

## 4. UDP không có "kết nối"

Telemetry đi bằng **UDP**: gửi gói và quên, không bắt tay, không biết bên kia có nghe không. Hệ quả:
nếu ESP32 không biết địa chỉ laptop, nó không biết gửi đi đâu — phải đợi GCS (Mission Planner)
**gửi trước** một gói rồi mới trả lời về địa chỉ đó. Dự án tránh chuyện này bằng cách ghi sẵn IP
laptop (`192.168.137.1`) vào DroneBridge, nên ESP32 **tự đẩy** gói về.

Video thì đi bằng HTTP trên **TCP** — có kết nối, có xác nhận, mất gói thì gửi lại.

## 5. MJPEG là gì

**Không phải video nén**: chỉ là một chuỗi ảnh JPEG nối đuôi nhau trong một câu trả lời HTTP không
bao giờ kết thúc. Giữa hai ảnh có một dòng ranh giới (`--frame`) và vài dòng header nói ảnh dài bao
nhiêu byte, chụp lúc nào, chất lượng bao nhiêu (`docs/hop-dong-mjpeg.md`).

Lợi: trình duyệt xem thẳng được, cắt ra từng khung để đưa vào AI cực dễ, mất một khung không làm hỏng
khung sau. Hại: tốn băng thông hơn video nén thật (H.264 chỉ gửi phần thay đổi giữa hai khung, MJPEG
gửi lại cả ảnh mỗi lần).

## 6. `jpeg_quality` 0..63 — số nhỏ là nét

Ngược trực giác "chất lượng 0–100" quen thuộc: trong thư viện camera của ESP32, `jpeg_quality` là
mức **nén**. Số **nhỏ** = nén ít = **nét hơn** = file **to hơn** = fps **thấp hơn** (Wi-Fi phải chở
nhiều byte hơn). Đo trên bo dự án: chất lượng 8 → ~10 KB/khung, 60 → ~7 KB/khung (cùng cảnh).

Đổi lúc đang chạy: `http://iotcv-camera.mshome.net/set?quality=20`. Mỗi khung mang header
`X-Jpeg-Quality` ghi giá trị **thật** lúc chụp khung đó — phải thế thì thí nghiệm "chất lượng ảnh ảnh
hưởng AI ra sao" ở các phase sau mới đúng số liệu.

## 7. PSRAM — và vì sao bắt buộc

ESP32-S3 chỉ có ~512 KB RAM trong chip, phải chia cho Wi-Fi, máy chủ HTTP và chương trình. Bộ đệm
khung ảnh của camera được cấp sẵn theo cỡ khung lớn nhất, và muốn "luôn có khung mới nhất" thì cần
**hai** bộ đệm luân phiên. **PSRAM** là chip RAM phụ gắn ngoài (bo dự án có 8 MB) để chứa các bộ
đệm đó. Không có PSRAM, ví dụ `CameraWebServer` gốc tự hạ xuống **một** bộ đệm trong RAM trong chip
và chặn khung JPEG ở tối đa SVGA 800×600 — mất cơ chế lấy khung mới nhất (`CAMERA_GRAB_LATEST`) mà
firmware dự án dựa vào.

Bo N16R8 = flash **16** MB + PSRAM **8** MB, PSRAM loại **octal** (8 đường dữ liệu, nhanh). Firmware
phải khai đúng loại: `board_build.arduino.memory_type = qio_opi`. Khai sai (`qio_qspi`, kiểu 4
đường) thì bo báo `PSRAM ID read error` hoặc khởi động lại liên tục — nhìn như hỏng phần cứng nhưng
chỉ là một dòng cấu hình.

## 8. Camera chỉ phục vụ được một client

Bo camera gửi một luồng tới **một** người xem. Ba tab trình duyệt cùng mở thẳng vào camera thì
Wi-Fi và CPU của nó không gánh nổi (và máy chủ HTTP của nó chỉ xử lý một yêu cầu một lúc). Nên
**backend đứng giữa**: một kết nối duy nhất tới camera, rồi phát lại cho bao nhiêu trình duyệt cũng
được. Trình duyệt không bao giờ cắm thẳng vào camera.

## 9. Đưa ESP32-S3 vào chế độ nạp bằng tay

Bình thường không cần: cổng `USB-UART` có mạch tự reset, công cụ nạp tự đưa chip vào chế độ nạp.
Khi nạp báo `Failed to connect to ESP32-S3`:

```text
giu nut BOOT  ->  nhan roi nha RST  ->  nha BOOT  ->  chay lai lenh nap
```

Chip đọc chân BOOT đúng lúc khởi động: thấy BOOT đang bị giữ thì chờ nhận chương trình mới thay vì
chạy chương trình cũ.

## 10. Brownout — vì sao một cái tụ chữa được

Lúc Wi-Fi phát, ESP32 kéo dòng **đột ngột** (vài trăm mA trong vài mili-giây). Dây nguồn dài hay
nguồn yếu không kịp đáp ứng, điện áp sụt thoáng qua. Chip có mạch canh: thấy điện áp tụt dưới ngưỡng
là tự reset để khỏi chạy sai — gọi là **brownout**. Dấu hiệu: log in `Brownout detector was
triggered`, hoặc bo khởi động lại đúng lúc bật Wi-Fi.

Một tụ 470–1000 µF low-ESR hàn sát chân 5V–GND của bo là một "bình nước" nhỏ: lúc dòng vọt lên, tụ
xả bù trong vài mili-giây đó, điện áp không kịp sụt. Và luôn cấp nguồn bằng **UBEC 5V riêng**, không
lấy từ pad 5V của bo bay — một ESP32 sụt áp không được kéo bo bay reset theo giữa trời.

## 11. OTA — nạp firmware qua Wi-Fi

OTA (Over-The-Air) là nạp chương trình mới qua mạng thay vì qua cáp USB. Khi bo camera đã bắt vít lên
khung drone, tháo ra cắm cáp mỗi lần sửa firmware rất phiền; OTA cho phép gõ một lệnh trên laptop.

Bộ nhớ flash của bo được chia sẵn **hai khe chương trình**, `app0` và `app1`, cùng một ô nhỏ
(`otadata`) ghi "lần khởi động tới chạy khe nào":

```text
Dang chay app0  ->  ban moi ghi vao app1 (app0 khong bi dung toi)
                ->  kiem MD5 xong moi sua otadata tro sang app1  ->  khoi dong lai, chay app1
Nap hong giua chung (dut mang, file sai)  ->  otadata khong doi  ->  khoi dong lai, van chay app0
```

Nhờ vậy nạp hỏng không làm "chết" bo: bản cũ vẫn nằm nguyên ở khe kia. Điều OTA **không** cứu được:
bản mới khởi động được nhưng không vào được Wi-Fi (ví dụ sai mật khẩu) — khi đó không còn đường mạng
để nạp lại, phải cắm USB.

OTA phải có khoá: ai trong mạng hotspot cũng gửi được file tới bo, nên firmware chỉ nhận khi kèm đúng
một **token** bí mật (nằm trong `secrets.h`, không lên git). Lệnh và chi tiết:
`firmware/camera/README.md` mục "Nạp qua Wi-Fi".
