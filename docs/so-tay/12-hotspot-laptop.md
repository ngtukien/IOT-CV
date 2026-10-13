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
- **Mất sóng khi laptop quét Wi-Fi — đã rõ cơ chế, rủi ro cho Phase 17.** Card của laptop vừa nối
  mạng nhà vừa phát hotspot trên **một** radio. Mỗi lần nó quét Wi-Fi, radio rời kênh hotspot vài
  giây và **cả hai bo mất gói cùng lúc**. Đo 13/10/2026:
  - Hai lần đo đầu (chiều tối): cả hai bo mất gói cùng giây, đều đặn mỗi ~15,5 s, mỗi lần 1–3 s (16–27 giây mất /
    150) — tức có chương trình nào đó bắt card quét mỗi ~15,5 s. Luồng camera đứng 1,2–2,7 s (log
    bo: `STREAM slow frame … send_ms=…`, lấy khung chỉ 17–101 ms), có lần đứt hẳn.
  - Các lần đo sau (20:18–20:24), không đổi cài đặt gì: **0 giây mất** trong 90 s và 150 s, và card không quét lần
    nào. Chương trình kia đã thôi chạy.
  - Ép quét bằng `WiFiAdapter.ScanAsync()` hai lần: cả hai bo mất 3–6 s **đúng lúc** quét. Đã
    chứng minh cơ chế.
  - Đã loại: `Roaming Aggressiveness` của card RZ616 (đặt `Disabled` vẫn y chu kỳ — đã trả về
    `Medium-Low`).

  **Chẩn đoán khi gặp lại — một lệnh:** `py -3.13 scripts\esp32\wifi_ping_check.py`. Nó tự chạy
  `scripts\esp32\wifi_scan_watch.ps1` song song và in "Giây mất chung TRÙNG lúc laptop quét: k/n".
  k = n → do quét. Khi đó tìm chương trình đang bắt quét: đóng danh sách Wi-Fi ở góc màn hình và
  trang Settings → Wi-Fi; tắt Location cho ứng dụng desktop (Settings → Privacy & security → Location); đóng
  lần lượt app đang mở rồi đo lại. (Bộ theo dõi chỉ thấy lần quét có kết quả; một lần đo còn 3/13
  giây mất không trùng lần quét nào nó thấy.)

  **Hệ quả cho Phase 17/21:** telemetry hụt cùng lúc với video; **dead-man 300 ms của web sẽ dừng
  drone** mỗi lần như vậy khi lái tay. Hướng chữa, chưa thử, mỗi lần đổi một biến rồi đo lại bằng
  lệnh trên: (1) không mở danh sách Wi-Fi / app dùng vị trí trong lúc bay; (2) USB Wi-Fi riêng chỉ
  để phát hotspot (radio không phải chia); (3) điện thoại phát hotspot 2,4 GHz (cách ở mục trên);
  (4) `netsh wlan set autoconfig enabled=no interface="Wi-Fi"` (cần admin) chặn quét nền — nhưng
  laptop cũng thôi tự nối lại mạng; chưa biết Mobile Hotspot có còn chạy không.
- **Luồng camera vẫn khựng 1,2–2,2 s vài lần mỗi phút** ngay cả khi ping không mất gói nào
  (20:20, stream 150 s: 10 lần, rải rác, 0 khung hỏng, 0 lần đứt). Đó là TCP phải chờ gửi lại gói
  bị mất: bộ đệm gửi của lwIP trong core Arduino chỉ 4 gói nên hiếm khi gửi lại nhanh được.
  `CAMERA_STALE_S=2.0` của backend có thể chớp "CAMERA OFFLINE" một nhịp. Phase 17 đo lại trên đúng
  cấu hình bay; nếu khó chịu thì hạ framesize xuống QVGA (mốc thiết kế của `docs/hop-dong-mjpeg.md`).
- Ping giật thường ngày (p50 ~4–40 ms, p95 ~66–145 ms) không phải nút thắt băng thông: camera đạt
  ~295 KB/s khi bỏ nhiễu XCLK (`firmware/camera/README.md`, bẫy 1).
- **IP DHCP đổi mỗi lần hotspot khởi động lại** (13/10/2026 đổi ba lần: `.60/.102` → `.67/.97` →
  `.150/.41`). Luôn dùng tên `*.mshome.net`, đừng ghi cứng IP của bo vào đâu.
