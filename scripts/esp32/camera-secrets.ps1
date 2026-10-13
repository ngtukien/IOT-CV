# Tao firmware/camera/include/secrets.h tu secrets.example.h, dien SSID + mat khau Mobile Hotspot
# va token OTA.
#
#   powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\esp32\camera-secrets.ps1
#
# secrets.h da .gitignore. Mat khau va token khong in ra man hinh. Cac hang so tinh chinh khac (chat
# luong JPEG, framesize, cong HTTP) lay nguyen tu secrets.example.h - muon doi thi sua file mau do roi
# chay lai script, dung sua tay secrets.h (lan chay sau se ghi de).
#
# Token OTA (plans/phase-12 §12.9): sinh 32 ky tu hex ngau nhien bang bo sinh so mat ma o lan dau,
# cac lan sau GIU NGUYEN token dang co trong secrets.h - firmware tren chip chi nhan dung token no da
# duoc build cung. Xoa secrets.h thi token moi duoc sinh, va phai nap USB mot lan.
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'hotspot.ps1')

$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot '..\..')
$Template = Join-Path $RepoRoot 'firmware\camera\include\secrets.example.h'
$Out = Join-Path $RepoRoot 'firmware\camera\include\secrets.h'
$TokenPattern = '(?m)^#define OTA_TOKEN\s+"([0-9a-f]{32})"'
$TokenBytes = 16

function ConvertTo-CString([string] $Value) {
    if ($Value -match '[^\x20-\x7E]') { throw 'SSID/mat khau co ky tu ngoai ASCII in duoc; doi lai trong Mobile Hotspot.' }
    $Value.Replace('\', '\\').Replace('"', '\"')
}

function Get-OtaToken {
    if (Test-Path $Out) {
        $m = [regex]::Match((Get-Content $Out -Raw), $TokenPattern)
        if ($m.Success) { return $m.Groups[1].Value }
    }
    $bytes = New-Object byte[] $TokenBytes
    $rng = [Security.Cryptography.RandomNumberGenerator]::Create()
    try { $rng.GetBytes($bytes) } finally { $rng.Dispose() }
    ($bytes | ForEach-Object { $_.ToString('x2') }) -join ''
}

$hotspot = Get-IotcvHotspot
$token = Get-OtaToken
$text = Get-Content $Template -Raw
$lines = [ordered]@{
    '(?m)^#define WIFI_SSID .*$'     = '#define WIFI_SSID      "' + (ConvertTo-CString $hotspot.Ssid) + '"'
    '(?m)^#define WIFI_PASSWORD .*$' = '#define WIFI_PASSWORD  "' + (ConvertTo-CString $hotspot.Passphrase) + '"'
    '(?m)^#define OTA_TOKEN .*$'     = '#define OTA_TOKEN             "' + $token + '"'
}
$filled = $text
foreach ($pattern in $lines.Keys) {
    # Kiem "co dong khop khong", KHONG kiem "co doi khong": SSID mau trung SSID that thi dong thay
    # giong het dong cu.
    if (-not [regex]::IsMatch($filled, $pattern)) { throw "Khong tim thay dong khop '$pattern' trong $Template." }
    $replacement = $lines[$pattern]
    $filled = [regex]::Replace($filled, $pattern, { $replacement })
}
$header = "// TAO TU DONG boi scripts/esp32/camera-secrets.ps1 - KHONG commit, KHONG sua tay.`n"
[IO.File]::WriteAllText($Out, $header + $filled.Replace("`r`n", "`n"), (New-Object Text.UTF8Encoding $false))
"Da ghi $Out (SSID hotspot: $($hotspot.Ssid); token OTA da co san trong file, khong in ra)"
