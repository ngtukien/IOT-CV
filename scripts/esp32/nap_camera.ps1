# Nap firmware camera vao bo ESP32-S3 N16R8 + OV3660 bang MOT lenh, khong bam nut nao.
#
#   powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\esp32\nap_camera.ps1 [-Port COM7] [-NoUpload] [-Ota [-Force]]
#
# 1. Sinh firmware/camera/include/secrets.h tu Mobile Hotspot + token OTA (camera-secrets.ps1).
# 2. Qua USB (mac dinh): tim cong USB-UART cua bo (chip CH343P, VID 1A86 PID 55D3) - khong bao gio
#    nap nham ESP32 DroneBridge (CP210x) hay FC (0483/1209) dang cam cung luc; pio run -t upload
#    (cong USB-UART co mach tu reset nen khong can giu BOOT); reset bo, doc log toi dong
#    "URL stream=". Khong toi duoc trong 40 s -> ma thoat 1.
# 3. -Ota: nap qua Wi-Fi, khong can cap USB (plans/phase-12 §12.9). Build roi goi ota_camera.py: gui
#    firmware.bin toi POST /update, cho bo khoi dong lai, kiem chip chay dung ban vua nap.
#    Lan dau dung OTA thi bo phai dang chay firmware CO /update - tuc la da nap USB it nhat mot lan
#    sau khi them OTA. -Force: nap ca khi chip da chay dung ban nay.
# -NoUpload: chi build (khong can bo).
param(
    [string] $Port,
    [switch] $NoUpload,
    [switch] $Ota,
    [switch] $Force
)
$ErrorActionPreference = 'Stop'
$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot '..\..')
$Pio = 'D:\DevCache\tools\platformio\penv\Scripts\pio.exe'
$env:PLATFORMIO_CORE_DIR = 'D:\DevCache\tools\platformio'
$BoardVidPid = 'VID_1A86&PID_55D3'
$BootTimeoutS = 40

if (-not (Test-Path $Pio)) { throw "Khong thay $Pio. Cai PlatformIO theo plans/phase-00 (PLATFORMIO_CORE_DIR tren o D)." }

& (Join-Path $PSScriptRoot 'camera-secrets.ps1')

$viaUsb = -not $NoUpload -and -not $Ota
if ($viaUsb -and -not $Port) {
    $dev = @(Get-CimInstance Win32_PnPEntity | Where-Object { $_.DeviceID -match $BoardVidPid -and $_.Name -match '\((COM\d+)\)' })
    if ($dev.Count -ne 1) {
        throw "Tim thay $($dev.Count) cong CH343P. Cam cap vao cong ghi 'USB-UART' o mat duoi bo camera (khong phai 'USB-OTG'), hoac chi ro -Port. Bo da gan len drone thi dung -Ota."
    }
    [void]($dev[0].Name -match '\((COM\d+)\)')
    $Port = $Matches[1]
}

Push-Location (Join-Path $RepoRoot 'firmware\camera')
try {
    if ($viaUsb) {
        "Nap qua USB vao $Port ..."
        & $Pio run -e esp32s3_n16r8 -t upload --upload-port $Port
    } else {
        & $Pio run -e esp32s3_n16r8
    }
    if ($LASTEXITCODE -ne 0) {
        throw "pio loi (ma $LASTEXITCODE). Neu bao 'Failed to connect to ESP32-S3': giu BOOT, nhan-nha RST, nha BOOT roi chay lai."
    }
} finally {
    Pop-Location
}
if ($NoUpload) { return }

if ($Ota) {
    $otaArgs = @((Join-Path $PSScriptRoot 'ota_camera.py'))
    if ($Force) { $otaArgs += '--force' }
    & py -3.13 @otaArgs
    if ($LASTEXITCODE -ne 0) { throw "Nap qua Wi-Fi khong dat (ma $LASTEXITCODE) - xem dong FAIL o tren. Ban cu van chay." }
    return
}

& py -3.13 (Join-Path $PSScriptRoot 'esp32_log.py') $Port --reset --until 'URL stream=' --seconds $BootTimeoutS
if ($LASTEXITCODE -ne 0) {
    throw "Bo khong bao IP trong $BootTimeoutS s. Kiem: hotspot da bat (hotspot-on.ps1)? log co 'camera init FAIL'?"
}
