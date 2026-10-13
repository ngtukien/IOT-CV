# Bat Mobile Hotspot cua laptop cho ca hai ESP32 (DroneBridge + camera) noi vao. Khong can admin.
#
#   powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\esp32\hotspot-on.ps1 [-Ssid IOTCV-HOTSPOT]
#
# - Ep bang 2,4 GHz (ESP32 khong thay 5 GHz), giu nguyen mat khau dang co.
# - Tat che do "tu tat hotspot khi khong co thiet bi nao noi vao" (bay 1 cua so tay 12-hotspot).
# - -Ssid: doi ten mang. Doi xong PHAI chay lai dronebridge-nvs.ps1 va camera-secrets.ps1 + nap lai
#   camera, vi ca hai ESP32 dang nho ten cu.
# - In IP laptop tren mang hotspot va danh sach thiet bi dang noi (MAC, ten, IP).
param([string] $Ssid)
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'hotspot.ps1')

$changed = Set-IotcvHotspotConfig -Ssid $Ssid
$manager = Start-IotcvHotspot
$config = $manager.GetCurrentAccessPointConfiguration()

# Hotspot vua bat thi card ao can vai giay moi co IP.
$ip = $null
for ($i = 0; $i -lt 20 -and -not $ip; $i++) { $ip = Get-IotcvHotspotIp; if (-not $ip) { Start-Sleep -Milliseconds 500 } }

"Hotspot : $($manager.TetheringOperationalState)  SSID '$($config.Ssid)'  bang $($config.Band)"
"IP laptop tren hotspot: $(if ($ip) { $ip } else { 'CHUA CO (cho them vai giay roi chay lai)' })"
if ($changed) { 'Da doi cau hinh hotspot -> chay lai dronebridge-nvs.ps1 va camera-secrets.ps1 roi nap lai camera.' }

$neighbors = @(Get-NetNeighbor -AddressFamily IPv4 -ErrorAction SilentlyContinue | Where-Object { $_.IPAddress -like '192.168.137.*' })
"Thiet bi dang noi: $($manager.ClientCount)/$($manager.MaxClientCount)"
foreach ($client in $manager.GetTetheringClients()) {
    $mac = $client.MacAddress
    $names = ($client.HostNames | ForEach-Object { $_.DisplayName }) -join ','
    $hit = $neighbors | Where-Object { $_.LinkLayerAddress -replace '-', ':' -eq $mac } | Select-Object -First 1
    "  $mac  $names  $(if ($hit) { $hit.IPAddress } else { '' })"
}
