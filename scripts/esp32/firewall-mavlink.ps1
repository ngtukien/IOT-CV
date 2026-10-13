# Mo cong UDP 14550 (MAVLink tu ESP32 DroneBridge ve laptop) tren tuong lua Windows.
#
#   powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\esp32\firewall-mavlink.ps1 [-Remove]
#
# Can quyen Administrator: script tu bat hop UAC, nguoi dung bam "Yes" (secure desktop, khong
# cong cu nao bam thay duoc). Rule mo cho MOI profile mang, ke ca Public: o quan ca phe / mang
# truong thi chay lai voi -Remove sau khi dung.
param([switch] $Remove)
$ErrorActionPreference = 'Stop'
$RuleName = 'IOTCV MAVLink UDP 14550'

$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole(
    [Security.Principal.WindowsBuiltInRole]::Administrator)
$existing = Get-NetFirewallRule -DisplayName $RuleName -ErrorAction SilentlyContinue
$needChange = if ($Remove) { [bool]$existing } else { -not $existing }

if ($needChange -and -not $isAdmin) {
    "Can quyen Administrator -> bam 'Yes' tren hop UAC vua hien."
    $argList = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', "`"$PSCommandPath`"")
    if ($Remove) { $argList += '-Remove' }
    $proc = Start-Process powershell.exe -Verb RunAs -ArgumentList $argList -Wait -PassThru
    if ($proc.ExitCode -ne 0) { throw "Tien trinh Administrator loi (ma $($proc.ExitCode))." }
} elseif ($needChange) {
    if ($Remove) {
        Remove-NetFirewallRule -DisplayName $RuleName
    } else {
        New-NetFirewallRule -DisplayName $RuleName -Direction Inbound -Protocol UDP -LocalPort 14550 `
            -Action Allow -Profile Any | Out-Null
    }
}

# Doc lai tu tuong lua - day moi la bang chung, khong phai viec lenh tren khong bao loi.
$rule = Get-NetFirewallRule -DisplayName $RuleName -ErrorAction SilentlyContinue
if ($Remove) {
    if ($rule) { throw "Rule '$RuleName' van con." }
    "Da xoa rule '$RuleName'."
} else {
    if (-not $rule) { throw "Khong thay rule '$RuleName' (UAC bi tu choi?)." }
    $port = $rule | Get-NetFirewallPortFilter
    "Rule '$RuleName': Enabled=$($rule.Enabled) $($rule.Direction) $($rule.Action) Profile=$($rule.Profile) $($port.Protocol) $($port.LocalPort)"
}
