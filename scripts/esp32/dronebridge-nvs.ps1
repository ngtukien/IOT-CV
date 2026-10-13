# Ghi cau hinh DroneBridge vao ESP32 qua cap USB (phan vung NVS), KHONG can doi mang Wi-Fi.
#
#   powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\esp32\dronebridge-nvs.ps1 [-Port COM4] [-NoFlash]
#
# Chay bang Windows PowerShell 5.1 (can WinRT de doc cau hinh Mobile Hotspot).
# Mau cau hinh: firmware/dronebridge/db_params.iotcv.csv. SSID + mat khau lay tu Mobile Hotspot
# cua Windows luc chay, khong bao gio ghi vao git va khong in ra man hinh.
param(
    [string] $Port = 'COM4',
    [switch] $NoFlash
)
$ErrorActionPreference = 'Stop'

$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot '..\..')
$Template = Join-Path $RepoRoot 'firmware\dronebridge\db_params.iotcv.csv'
$OutDir = Join-Path $RepoRoot 'firmware\dronebridge\bin\config'   # da .gitignore
$NvsOffset = '0x9000'   # bang phan vung DroneBridge v2.4.1: nvs @ 0x9000, dai 0x6000
$NvsSize = '0x6000'
$Baud = 115200          # board CP2102 cua du an hong du lieu o 460800 / 921600

function Assert-SafeCsvValue([string] $Name, [string] $Value) {
    if ($Value -match '[,"\r\n]') { throw "$Name chua ky tu lam vo CSV (dau phay, ngoac kep, xuong dong). Doi $Name roi chay lai." }
}

# 1. Cong phai dung la chip CP210x, khong phai FC hay thiet bi khac dang cam cung luc.
$dev = Get-CimInstance Win32_PnPEntity | Where-Object { $_.Name -like "*($Port)" }
if (-not $dev) { throw "Khong thay $Port. Cam ESP32 roi xem cong bang: Get-CimInstance Win32_SerialPort" }
if ($dev.DeviceID -notmatch 'VID_10C4') { throw "$Port la '$($dev.Name)', khong phai CP210x cua ESP32. Dung -Port dung." }

# 2. Doc cau hinh Mobile Hotspot (bang tan phai la 2,4 GHz: ESP32 khong bat duoc 5 GHz).
. (Join-Path $PSScriptRoot 'hotspot.ps1')
$hotspot = Get-IotcvHotspot
Assert-SafeCsvValue 'SSID hotspot' $hotspot.Ssid
Assert-SafeCsvValue 'Mat khau hotspot' $hotspot.Passphrase

# 3. Dien mau -> CSV tam -> nvs.bin, roi xoa CSV tam (no chua mat khau dang chu thuong).
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
$csv = Join-Path $OutDir 'db_params.filled.csv'
$bin = Join-Path $OutDir 'nvs.bin'
try {
    (Get-Content $Template -Raw).Replace('__HOTSPOT_SSID__', $hotspot.Ssid).Replace('__HOTSPOT_PASS__', $hotspot.Passphrase) |
        Set-Content -Path $csv -Encoding ASCII -NoNewline
    & uvx --from esp-idf-nvs-partition-gen python -m esp_idf_nvs_partition_gen generate $csv $bin $NvsSize
    if ($LASTEXITCODE -ne 0) { throw "nvs_partition_gen loi (ma $LASTEXITCODE)." }
} finally {
    Remove-Item -LiteralPath $csv -ErrorAction SilentlyContinue
}
"Da tao $bin (SSID hotspot: $($hotspot.Ssid))"

if ($NoFlash) { return }

# 4. Ghi rieng phan vung NVS; firmware DroneBridge giu nguyen.
& esptool --chip esp32 -p $Port -b $Baud --before default-reset --after hard-reset write-flash $NvsOffset $bin
if ($LASTEXITCODE -ne 0) { throw "esptool loi (ma $LASTEXITCODE)." }
"Xong. ESP32 khoi dong lai o che do STA, bat hotspot '$($hotspot.Ssid)', day MAVLink UDP toi 192.168.137.1:14550."
