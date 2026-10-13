# Thu vien Mobile Hotspot cua Windows cho cac script ESP32 (dot-source, khong chay truc tiep):
#   . (Join-Path $PSScriptRoot 'hotspot.ps1')
#
# Chi chay duoc tren Windows PowerShell 5.1 (powershell.exe): can WinRT. pwsh 7 khong nap duoc.
# Mat khau hotspot chi tra ve trong doi tuong, KHONG BAO GIO in ra man hinh.

Add-Type -AssemblyName System.Runtime.WindowsRuntime
[void][Windows.Networking.Connectivity.NetworkInformation, Windows.Networking.Connectivity, ContentType = WindowsRuntime]
[void][Windows.Networking.NetworkOperators.NetworkOperatorTetheringManager, Windows.Networking.NetworkOperators, ContentType = WindowsRuntime]
[void][Windows.Networking.NetworkOperators.NetworkOperatorTetheringAccessPointConfiguration, Windows.Networking.NetworkOperators, ContentType = WindowsRuntime]

$script:AsTaskOfT = [System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
    $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1'
} | Select-Object -First 1
# PowerShell 5.1 khong tu chon duoc overload AsTask(IAsyncAction) cho doi tuong COM -> goi qua reflection.
$script:AsTaskAction = [System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
    $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncAction'
} | Select-Object -First 1

function Wait-WinRtOperation($Operation, [Type] $ResultType) {
    $task = $script:AsTaskOfT.MakeGenericMethod($ResultType).Invoke($null, @($Operation))
    [void]$task.Wait(-1)
    $task.Result
}

function Wait-WinRtAction($Action) {
    [void]$script:AsTaskAction.Invoke($null, @($Action)).Wait(-1)
}

function Get-IotcvTetheringManager {
    $connection = [Windows.Networking.Connectivity.NetworkInformation]::GetInternetConnectionProfile()
    if (-not $connection) { throw 'Laptop chua co mang internet nao; Mobile Hotspot can mot ket noi de chia se.' }
    [Windows.Networking.NetworkOperators.NetworkOperatorTetheringManager]::CreateFromConnectionProfile($connection)
}

# Cau hinh hotspot hien tai (Ssid, Passphrase, Band). Dung lai neu bang tan khong phai 2,4 GHz.
function Get-IotcvHotspot {
    $config = (Get-IotcvTetheringManager).GetCurrentAccessPointConfiguration()
    if ($config.Band -ne 'TwoPointFourGigahertz') {
        throw "Mobile Hotspot dang o bang '$($config.Band)'. ESP32 khong bat duoc 5 GHz: chay scripts\esp32\hotspot-on.ps1 (tu dat 2,4 GHz) roi chay lai."
    }
    $config
}

# Doi SSID va/hoac ep bang 2,4 GHz. Giu nguyen mat khau hien co.
function Set-IotcvHotspotConfig([string] $Ssid) {
    $manager = Get-IotcvTetheringManager
    $current = $manager.GetCurrentAccessPointConfiguration()
    $wantSsid = if ($Ssid) { $Ssid } else { $current.Ssid }
    if ($current.Ssid -eq $wantSsid -and $current.Band -eq 'TwoPointFourGigahertz') { return $false }
    $config = New-Object Windows.Networking.NetworkOperators.NetworkOperatorTetheringAccessPointConfiguration
    $config.Ssid = $wantSsid
    $config.Passphrase = $current.Passphrase
    $config.Band = 'TwoPointFourGigahertz'
    Wait-WinRtAction ($manager.ConfigureAccessPointAsync($config))
    $true
}

# Bat hotspot (neu dang tat) va tat che do "tu tat khi khong co thiet bi nao noi vao".
function Start-IotcvHotspot {
    $manager = Get-IotcvTetheringManager
    if ($manager.TetheringOperationalState -ne 'On') {
        $result = Wait-WinRtOperation ($manager.StartTetheringAsync()) ([Windows.Networking.NetworkOperators.NetworkOperatorTetheringOperationResult])
        if ($result.Status -ne 'Success') { throw "Khong bat duoc Mobile Hotspot: $($result.Status) $($result.AdditionalErrorMessage)" }
    }
    Wait-WinRtAction ([Windows.Networking.NetworkOperators.NetworkOperatorTetheringManager]::DisableNoConnectionsTimeoutAsync())
    $manager
}

# IP cua chinh laptop tren mang hotspot (Windows thuong dat 192.168.137.1).
function Get-IotcvHotspotIp {
    $ip = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
        Where-Object { $_.InterfaceAlias -like 'Local Area Connection*' -and $_.IPAddress -like '192.168.137.*' } |
        Select-Object -First 1
    if ($ip) { $ip.IPAddress } else { $null }
}
