# Sổ tay 12 — Hotspot Wi-Fi trên laptop và cổng tường lửa

Cả ESP32 DroneBridge (telemetry) lẫn bo camera đều **nối vào laptop**, không tự phát Wi-Fi. Lý do
là một ràng buộc cứng: **một card Wi-Fi laptop chỉ nối được một điểm truy cập tại một thời điểm**,
mà dự án cần telemetry và video cùng lúc. Nếu mỗi ESP32 tự làm AP thì phải chọn một trong hai.

Nên laptop phát **Mobile Hotspot** (laptop là AP), hai ESP32 là STA nối vào. Card MediaTek RZ616 của
máy dự án vẫn giữ được mạng có internet ở 5 GHz trong lúc phát hotspot 2,4 GHz, nên không phải rời
internet.

## 1. Bật hotspot — một lệnh

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\esp32\hotspot-on.ps1
```

Script không cần quyền Administrator. Nó:

- ép băng tần **2,4 GHz** — ESP32 **không nhìn thấy** mạng 5 GHz. Để `Auto` thì Windows bám theo
  băng của mạng đang nối (thường là 5 GHz) và ESP32 không bao giờ thấy hotspot;
- bật hotspot nếu đang tắt;
- tắt chế độ "tự tắt hotspot khi không có thiết bị nào nối vào" (bẫy 1 bên dưới);
- in IP của laptop trên mạng hotspot và danh sách thiết bị đang nối (MAC, tên, IP).

Lần đầu dùng `-Ssid IOTCV-HOTSPOT` để đặt tên cố định (đã làm ngày 13/10/2026). Mật khẩu giữ nguyên
cái Windows đã sinh; script không in nó ra.

Cách làm tay (khi script hỏng): Settings → Network & internet → Mobile hotspot → Edit: SSID
`IOTCV-HOTSPOT`, Band **2.4 GHz** → bật. Mục chọn Band trên một số driver chỉ hiện sau khi đã bật
hotspot một lần.

**Giữ SSID và mật khẩu không đổi.** Mỗi lần đổi là phải chạy lại
`scripts\esp32\dronebridge-nvs.ps1` (ESP32 DroneBridge) và `scripts\esp32\nap_camera.ps1` (bo
camera). Cả hai không có màn hình để báo "sai mật khẩu" — chúng chỉ im lặng không vào mạng.

## 2. Số thật trên máy dự án (13/10/2026)

```text
SSID         : IOTCV-HOTSPOT   bang 2,4 GHz   (truoc 13/10 la ten mac dinh cua Windows)
IP laptop    : 192.168.137.1   (interface "Local Area Connection* ...")
ESP32 bridge : ten DroneBridgeESP32.mshome.net   (IP DHCP, doi moi lan hotspot khoi dong lai)
Bo camera    : ten iotcv-camera.mshome.net       (nhu tren)
Laptop dong thoi noi "The One 2" o 5 GHz kenh 128 (con internet).
```

IP của hai ESP32 do DHCP cấp và **có thể đổi** (đổi SSID đã làm ESP32 bridge nhảy từ `.9` sang
`.60`). Dùng tên `*.mshome.net` — dịch vụ chia sẻ kết nối của Windows tự phân giải tên máy của
thiết bị nối vào hotspot. IP **của laptop** (`192.168.137.1`) thì cố định; con số này nằm trong cấu
hình DroneBridge (`udp_client_ip`) và là `MAVLINK_ENDPOINT` của backend ở Phase 17.

Lệnh xem IP laptop:

```powershell
Get-NetIPAddress -AddressFamily IPv4 |
  Where-Object { $_.InterfaceAlias -like "*Local Area Connection*" -or $_.InterfaceAlias -like "*Wi-Fi*" } |
  Format-Table InterfaceAlias, IPAddress
```

## 3. Mở cổng UDP 14550 trên tường lửa

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\esp32\firewall-mavlink.ps1
```

Cần quyền Administrator: script tự bật hộp UAC, **bạn bấm "Yes"** (hộp UAC nằm trên màn hình bảo mật
riêng, không công cụ nào bấm thay được). Rồi nó đọc lại rule từ tường lửa và in ra — đó mới là bằng
chứng, không phải việc lệnh tạo rule không báo lỗi. Tương đương tay (PowerShell Run as
Administrator):

```powershell
New-NetFirewallRule -DisplayName "IOTCV MAVLink UDP 14550" `
  -Direction Inbound -Protocol UDP -LocalPort 14550 -Action Allow -Profile Any
```

Kiểm: `Get-NetFirewallRule -DisplayName "IOTCV*"`. Đã tạo ngày 13/10/2026.

**AN TOÀN (mức dữ liệu):** rule mở cổng cho **mọi** profile mạng, kể cả Public. Ở nhà thì chấp nhận
được; ở quán cà phê hay mạng trường thì xoá sau khi dùng:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\esp32\firewall-mavlink.ps1 -Remove
```

Camera **không** cần rule: laptop chủ động mở kết nối tới camera (chiều ra), tường lửa không chặn
chiều đó.

## 4. Ba cái bẫy

```text
1. Windows TU TAT Mobile hotspot sau vai phut neu khong co thiet bi nao noi vao.
   hotspot-on.ps1 da tat che do nay. Lam tay thi: bat hotspot TRUOC, cap dien drone SAU.

2. UDP khong co khai niem "ket noi". Neu ESP32 KHONG biet dia chi laptop, GCS phai gui goi
   truoc (heartbeat) thi ESP32 moi biet tra loi ve dau. Du an da dat udp_client_ip =
   192.168.137.1 nen ESP32 TU DAY goi ve laptop. Mo GCS ma khong thay gi -> nghi pham so mot
   la udp_client_ip / IP laptop sai, roi den tuong lua.

3. Tuong lua Windows nuot goi UDP IM LANG - khong bao loi gi ca. Kiem rule tuong lua TRUOC
   khi nghi board hong. (Python nghe 14550 van nhan duoc goi khi chua co rule; Mission
   Planner thi khong chac - nen van tao rule.)
```

## 5. Kiểm nhanh cả hệ (không cần FC)

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\esp32\hotspot-on.ps1   # thay 2 thiet bi
uv run python scripts\esp32\camera_check.py                                             # camera: PASS
```

Telemetry: nghe UDP 14550 trên laptop phải thấy HEARTBEAT (msg 0) và RADIO_STATUS (msg 109) từ
sys 1 comp 68, 1 Hz — gói của chính DroneBridge. Gói của FC chỉ có khi đã đấu dây ở Phase 17.

## 6. Nếu lỗi

- **Mục Mobile hotspot xám, không bật được** → driver Wi-Fi không hỗ trợ, hoặc card đang tiết kiệm
  điện. Phương án hai: điện thoại phát hotspot 2,4 GHz, laptop nối vào đó; IP laptop lấy bằng cùng
  lệnh trên nhưng ở interface Wi-Fi, và phải sửa `udp_client_ip` trong
  `firmware/dronebridge/db_params.iotcv.csv` rồi chạy lại script NVS.
- **`hotspot-on.ps1` báo "Laptop chưa có mạng internet nào"** → Mobile Hotspot của Windows chỉ bật
  được khi laptop có một kết nối để chia sẻ. Nối mạng trước.
- **Mất sóng tuần hoàn — CHƯA CHỮA, rủi ro cho Phase 17.** Đo 13/10/2026 bằng
  `py -3.13 scripts\esp32\wifi_ping_check.py` (ping đồng thời cả hai bo 150 s): **cả hai bo mất gói
  cùng giây, đều đặn mỗi ~15,5 s, mỗi lần 1–3 s** (16–27 giây mất / 150). Hai bo khác nhau mà mất
  cùng lúc theo chu kỳ → lỗi phía laptop: có thứ gì đó kéo radio rời kênh hotspot. Hệ quả: luồng
  camera đứng 1,2–2,7 s (log bo: `STREAM slow frame … send_ms=…`, khâu lấy khung chỉ 17–101 ms),
  thỉnh thoảng đứt hẳn; telemetry MAVLink hụt cùng lúc; **dead-man 300 ms của web sẽ dừng drone
  mỗi ~15 s khi lái tay**.
  - Đã loại: `Roaming Aggressiveness` của card RZ616 (đặt `Disabled` vẫn y chu kỳ — đã trả về
    `Medium-Low`); WLAN-AutoConfig không ghi sự kiện nào theo chu kỳ đó.
  - Thử tiếp ở Phase 17, mỗi lần đổi một biến, đo lại bằng script trên: (1) laptop lấy internet
    bằng dây LAN và ngắt Wi-Fi "The One 2", để card chỉ còn phát hotspot; (2) USB Wi-Fi riêng làm
    hotspot; (3) điện thoại phát hotspot 2,4 GHz (cách ở mục trên).
  - Ping giật thường ngày (p50 ~6–14 ms, p95 ~100 ms) không phải nút thắt băng thông: camera đạt
    ~295 KB/s khi bỏ nhiễu XCLK (`firmware/camera/README.md`, bẫy 1).
- **IP DHCP đổi mỗi lần hotspot khởi động lại** (13/10/2026 đổi ba lần: `.60/.102` → `.67/.97` →
  `.150/.41`). Luôn dùng tên `*.mshome.net`, đừng ghi cứng IP của bo vào đâu.
