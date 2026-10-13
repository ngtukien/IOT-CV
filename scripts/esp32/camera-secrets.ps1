# Tao firmware/camera/include/secrets.h tu secrets.example.h, dien SSID + mat khau Mobile Hotspot.
#
#   powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\esp32\camera-secrets.ps1
#
# secrets.h da .gitignore. Mat khau khong in ra man hinh. Cac hang so tinh chinh khac (chat luong
# JPEG, framesize, cong HTTP) lay nguyen tu secrets.example.h - muon doi thi sua file mau do roi
# chay lai script, dung sua tay secrets.h (lan chay sau se ghi de).
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'hotspot.ps1')

$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot '..\..')
$Template = Join-Path $RepoRoot 'firmware\camera\include\secrets.example.h'
$Out = Join-Path $RepoRoot 'firmware\camera\include\secrets.h'

function ConvertTo-CString([string] $Value) {
    if ($Value -match '[^\x20-\x7E]') { throw 'SSID/mat khau co ky tu ngoai ASCII in duoc; doi lai trong Mobile Hotspot.' }
    $Value.Replace('\', '\\').Replace('"', '\"')
}

$hotspot = Get-IotcvHotspot
$text = Get-Content $Template -Raw
$ssidLine = '#define WIFI_SSID      "' + (ConvertTo-CString $hotspot.Ssid) + '"'
$passLine = '#define WIFI_PASSWORD  "' + (ConvertTo-CString $hotspot.Passphrase) + '"'
$filled = [regex]::Replace($text, '(?m)^#define WIFI_SSID .*$', { $ssidLine })
$filled = [regex]::Replace($filled, '(?m)^#define WIFI_PASSWORD .*$', { $passLine })
if ($filled -eq $text) { throw "Khong tim thay dong WIFI_SSID / WIFI_PASSWORD trong $Template." }
$header = "// TAO TU DONG boi scripts/esp32/camera-secrets.ps1 - KHONG commit, KHONG sua tay.`n"
[IO.File]::WriteAllText($Out, $header + $filled.Replace("`r`n", "`n"), (New-Object Text.UTF8Encoding $false))
"Da ghi $Out (SSID hotspot: $($hotspot.Ssid))"
