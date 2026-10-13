# Nap firmware camera vao bo ESP32-S3 N16R8 + OV3660 bang MOT lenh, khong bam nut nao.
#
#   powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\esp32\nap_camera.ps1 [-Port COM7] [-NoUpload]
#
# 1. Sinh firmware/camera/include/secrets.h tu Mobile Hotspot (camera-secrets.ps1).
# 2. Tim cong USB-UART cua bo (chip CH343P, VID 1A86 PID 55D3) - khong bao gio nap nham ESP32
#    DroneBridge (CP210x) hay FC (0483/1209) dang cam cung luc.
# 3. pio run -t upload. Cong USB-UART co mach tu reset nen khong can giu BOOT.
# 4. Reset bo, doc log toi dong "URL stream=" va in IP. Khong toi duoc trong 40 s -> ma thoat 1.
# -NoUpload: chi build (khong can bo).
param(
    [string] $Port,
    [switch] $NoUpload
)
$ErrorActionPreference = 'Stop'
$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot '..\..')
$Pio = 'D:\DevCache\tools\platformio\penv\Scripts\pio.exe'
$env:PLATFORMIO_CORE_DIR = 'D:\DevCache\tools\platformio'
$BoardVidPid = 'VID_1A86&PID_55D3'
$BootTimeoutS = 40

if (-not (Test-Path $Pio)) { throw "Khong thay $Pio. Cai PlatformIO theo plans/phase-00 (PLATFORMIO_CORE_DIR tren o D)." }

& (Join-Path $PSScriptRoot 'camera-secrets.ps1')

if (-not $Port -and -not $NoUpload) {
    $dev = @(Get-CimInstance Win32_PnPEntity | Where-Object { $_.DeviceID -match $BoardVidPid -and $_.Name -match '\((COM\d+)\)' })
    if ($dev.Count -ne 1) {
        throw "Tim thay $($dev.Count) cong CH343P. Cam cap vao cong ghi 'USB-UART' o mat duoi bo camera (khong phai 'USB-OTG'), hoac chi ro -Port."
    }
    [void]($dev[0].Name -match '\((COM\d+)\)')
    $Port = $Matches[1]
}

Push-Location (Join-Path $RepoRoot 'firmware\camera')
try {
    if ($NoUpload) {
        & $Pio run -e esp32s3_n16r8
    } else {
        "Nap vao $Port ..."
        & $Pio run -e esp32s3_n16r8 -t upload --upload-port $Port
    }
    if ($LASTEXITCODE -ne 0) {
        throw "pio loi (ma $LASTEXITCODE). Neu bao 'Failed to connect to ESP32-S3': giu BOOT, nhan-nha RST, nha BOOT roi chay lai."
    }
} finally {
    Pop-Location
}
if ($NoUpload) { return }

& py -3.13 (Join-Path $PSScriptRoot 'esp32_log.py') $Port --reset --until 'URL stream=' --seconds $BootTimeoutS
if ($LASTEXITCODE -ne 0) {
    throw "Bo khong bao IP trong $BootTimeoutS s. Kiem: hotspot da bat (hotspot-on.ps1)? log co 'camera init FAIL'?"
}
