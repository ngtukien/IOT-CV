# In thoi diem card Wi-Fi cua laptop quet xong, de doi chieu voi luc ESP32 mat song.
#
#   powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\esp32\wifi_scan_watch.ps1 [-Seconds 3600]
#
# Thuong khong goi tay: scripts/esp32/wifi_ping_check.py tu chay script nay song song roi DUNG no
# khi do xong (nen mac dinh chay toi da mot gio). Moi dong duoc ghi va day ra ngay, nen bi dung
# giua chung khong mat dong nao. Dau ra (moi dong mot su kien, de may doc):
#   ACCESS <Allowed|...>   quyen doc thong tin Wi-Fi
#   BASE <unix_ms>         lan quet gan nhat truoc khi bat dau theo doi
#   SCAN <unix_ms>         mot lan quet vua xong (bat ke chuong trinh nao yeu cau quet)
#
# Vi sao can: card cua laptop vua noi mang nha vua phat hotspot; moi lan no quet, radio roi kenh
# hotspot vai giay va CA HAI ESP32 mat goi cung luc. Do 13/10/2026: ep quet bang ScanAsync -> hai bo
# mat goi 3-6 s; mot chuong trinh nao do tung bat quet moi ~15,5 s (so tay 12-hotspot-laptop muc 6).
# Da kiem script nay THAY duoc quet: hai lan ep quet hien dung hai dong SCAN.
param([int] $Seconds = 3600)
$ErrorActionPreference = 'Stop'
$PollMs = 250

function Write-Event([string] $Line) {
    [Console]::Out.WriteLine($Line)
    [Console]::Out.Flush()
}

Add-Type -AssemblyName System.Runtime.WindowsRuntime
[void][Windows.Devices.WiFi.WiFiAdapter, Windows.Devices.WiFi, ContentType = WindowsRuntime]
$asTask = [System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
    $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1'
} | Select-Object -First 1
function Wait-Op($Operation, [Type] $ResultType) {
    $task = $asTask.MakeGenericMethod($ResultType).Invoke($null, @($Operation))
    [void]$task.Wait(-1)
    $task.Result
}

$access = Wait-Op ([Windows.Devices.WiFi.WiFiAdapter]::RequestAccessAsync()) ([Windows.Devices.WiFi.WiFiAccessStatus])
Write-Event "ACCESS $access"
if ("$access" -ne 'Allowed') { exit 2 }
$adapters = Wait-Op ([Windows.Devices.WiFi.WiFiAdapter]::FindAllAdaptersAsync()) ([System.Collections.Generic.IReadOnlyList[Windows.Devices.WiFi.WiFiAdapter]])
if ($adapters.Count -lt 1) { throw 'Khong thay card Wi-Fi nao.' }
$adapter = $adapters[0]

$last = $adapter.NetworkReport.Timestamp
Write-Event "BASE $($last.ToUnixTimeMilliseconds())"
$deadline = [DateTime]::UtcNow.AddSeconds($Seconds)
while ([DateTime]::UtcNow -lt $deadline) {
    Start-Sleep -Milliseconds $PollMs
    $ts = $adapter.NetworkReport.Timestamp
    if ($ts -ne $last) {
        Write-Event "SCAN $($ts.ToUnixTimeMilliseconds())"
        $last = $ts
    }
}
