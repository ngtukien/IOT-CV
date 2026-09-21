<#
.SYNOPSIS
  Dieu khien giao dien do hoa tren Windows cho Claude Code (thay cho computer-use,
  vi computer-use cua Claude Code CLI chi chay tren macOS).

.DESCRIPTION
  Ba nang luc:
    1. NHIN  - chup man hinh hoac chup rieng mot cua so, thu nho cho de doc.
    2. DOC   - liet ke cay control bang UIAutomation (chinh xac hon toa do).
    3. BAM   - goi Invoke/SetValue qua UIAutomation, hoac bam theo toa do khi can.

  UIAutomation lam viec tot voi WinForms/WPF (Mission Planner, STM32CubeProgrammer,
  Arduino IDE 2 thi kem hon vi la Electron - dung -Action shot + click toa do).

.NOTES
  AN TOAN - luat cung cua du an:
    - KHONG dung script nay de ARM drone, chay Motor Test, hay bat ky thao tac nao
      lam motor quay. Nguoi van hanh tu bam, tay luon cam RC. Xem SAFETY.md.
    - Mac dinh TU CHOI go phim vao cua so Terminal/IDE (tranh chay lenh vong qua
      lop phe duyet cua Claude Code). Muon ghi de: them -AllowTerminal.

.EXAMPLE
  pwsh -File scripts/gui/gui.ps1 -Action windows
  pwsh -File scripts/gui/gui.ps1 -Action shot -Monitor 0
  pwsh -File scripts/gui/gui.ps1 -Action shot -Window "Mission Planner"
  pwsh -File scripts/gui/gui.ps1 -Action tree -Window "Mission Planner" -Depth 4
  pwsh -File scripts/gui/gui.ps1 -Action invoke -Window "Mission Planner" -Name "Connect"
  pwsh -File scripts/gui/gui.ps1 -Action click -X 640 -Y 480
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [ValidateSet('windows', 'monitors', 'shot', 'focus', 'tree', 'invoke', 'setvalue', 'select', 'click', 'type', 'key', 'move', 'wait')]
    [string]$Action,

    [string]$Window,          # khop mot phan tieu de cua so, khong phan biet hoa thuong
    [int]$Monitor = -1,       # chi so man hinh cho -Action shot
    [string]$Name,            # Name hoac AutomationId cua control
    [string]$ControlType,     # loc theo loai: Button, Edit, ComboBox, Tab, ...
    [string]$Text,            # noi dung cho type / setvalue / select
    [string]$Keys,            # SendKeys, vd "^s" = Ctrl+S, "{ENTER}", "%{F4}"
    [int]$X = -1,
    [int]$Y = -1,
    [int]$Depth = 3,
    [int]$Ms = 500,
    [int]$MaxWidth = 1500,    # be ngang toi da cua anh xuat ra
    [string]$Out,             # duong dan file PNG; mac dinh vao scratchpad
    [switch]$AllowTerminal,
    [switch]$UseSendKeys,     # go tung phim thay vi dan clipboard (co the bi IME lam hong)
    [switch]$Force,           # bo qua rao "cua so co thay doi chua luu"
    [switch]$Raw              # khong thu nho anh
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Windows.Forms, System.Drawing
Add-Type -AssemblyName UIAutomationClient, UIAutomationTypes

Add-Type @'
using System;
using System.Text;
using System.Runtime.InteropServices;
public class Win32 {
    [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
    [DllImport("user32.dll")] public static extern bool SetCursorPos(int X, int Y);
    [DllImport("user32.dll")] public static extern void mouse_event(uint f, uint dx, uint dy, uint d, IntPtr e);
    [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
    [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int n);
    [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr h);
    [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);
    [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")] public static extern int GetClassName(IntPtr h, StringBuilder s, int max);
    [StructLayout(LayoutKind.Sequential)] public struct RECT { public int Left, Top, Right, Bottom; }
    public const uint MOUSEEVENTF_LEFTDOWN = 0x02, MOUSEEVENTF_LEFTUP = 0x04;
    public const uint MOUSEEVENTF_RIGHTDOWN = 0x08, MOUSEEVENTF_RIGHTUP = 0x10;
}
'@ -ErrorAction SilentlyContinue

[void][Win32]::SetProcessDPIAware()

# ---------------------------------------------------------------- helpers ----

function Get-Scratch {
    $d = Join-Path $env:TEMP "claude\gui"
    New-Item -ItemType Directory -Force -Path $d | Out-Null
    return $d
}

function Resolve-Proc {
    param([string]$TitlePart)
    if (-not $TitlePart) { throw "Thieu -Window." }
    $procs = @(Get-Process | Where-Object {
            $_.MainWindowTitle -and $_.MainWindowTitle -like "*$TitlePart*"
        })
    if ($procs.Count -eq 0) {
        $have = (Get-Process | Where-Object { $_.MainWindowTitle } |
            ForEach-Object { "  - [$($_.ProcessName)] $($_.MainWindowTitle)" }) -join "`n"
        throw "Khong thay cua so khop '$TitlePart'. Dang mo:`n$have"
    }
    if ($procs.Count -gt 1) {
        $list = ($procs | ForEach-Object { "  - [$($_.ProcessName)] $($_.MainWindowTitle)" }) -join "`n"
        Write-Warning "Nhieu cua so khop '$TitlePart', dung cai dau tien:`n$list"
    }
    return $procs[0]
}

# Terminal / IDE: chi bam, khong go phim (tranh chay lenh vong qua lop phe duyet)
$TerminalNames = @('WindowsTerminal', 'cmd', 'powershell', 'pwsh', 'conhost', 'Code',
    'devenv', 'wt', 'alacritty', 'wezterm', 'mintty', 'putty')

function Assert-TypingAllowed {
    $fg = [Win32]::GetForegroundWindow()
    $pid2 = 0
    $p = Get-Process | Where-Object { $_.MainWindowHandle -eq $fg } | Select-Object -First 1
    if ($p -and $TerminalNames -contains $p.ProcessName -and -not $AllowTerminal) {
        throw (("TU CHOI go phim vao '{0}' (Terminal/IDE). Day la rao an toan: " +
                "go lenh vao shell se di vong qua lop phe duyet cua Claude Code. " +
                "Neu that su can, chay lai voi -AllowTerminal.") -f $p.ProcessName)
    }
}

# Rao an toan hoc duoc tu su co 21/09/2026: mot lenh `type` da go nham 54 ky tu
# vao tai lieu dang mo cua nguoi dung. Hai nguyen nhan: (1) khong chi dinh cua so,
# (2) cua so do dang co thay doi chua luu nen khong the phat hien bang mat.
function Assert-SafeTarget {
    param([string]$TitlePart)
    $p = Resolve-Proc $TitlePart
    $t = $p.MainWindowTitle
    if ($t -match '^\s*[\*•]' -and -not $Force) {
        throw (("TU CHOI thao tac: cua so '{0}' dang co THAY DOI CHUA LUU. " +
                "Go/dan vao day co the pha tai lieu cua ban. Luu hoac dong no truoc, " +
                "hoac chay lai voi -Force neu ban chac chan.") -f $t)
    }
    return $p
}

function Save-Bitmap {
    param([System.Drawing.Bitmap]$Bmp, [string]$Path)
    $w = $Bmp.Width; $h = $Bmp.Height
    if (-not $Raw -and $w -gt $MaxWidth) {
        $nh = [int]($h * $MaxWidth / $w)
        $small = New-Object System.Drawing.Bitmap $MaxWidth, $nh
        $g = [System.Drawing.Graphics]::FromImage($small)
        $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $g.DrawImage($Bmp, 0, 0, $MaxWidth, $nh)
        $g.Dispose()
        $small.Save($Path, [System.Drawing.Imaging.ImageFormat]::Png)
        $small.Dispose()
        return "$w x $h  ->  $MaxWidth x $nh"
    }
    $Bmp.Save($Path, [System.Drawing.Imaging.ImageFormat]::Png)
    return "$w x $h (nguyen goc)"
}

function Capture-Region {
    param([int]$L, [int]$T, [int]$W, [int]$H)
    $bmp = New-Object System.Drawing.Bitmap $W, $H
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.CopyFromScreen($L, $T, 0, 0, (New-Object System.Drawing.Size($W, $H)))
    $g.Dispose()
    return $bmp
}

$auto = [System.Windows.Automation.AutomationElement]
function Get-Root {
    param([string]$TitlePart)
    $p = Resolve-Proc $TitlePart
    $cond = New-Object System.Windows.Automation.PropertyCondition(
        $auto::ProcessIdProperty, $p.Id)
    $el = $auto::RootElement.FindFirst(
        [System.Windows.Automation.TreeScope]::Children, $cond)
    if (-not $el) { throw "UIAutomation khong doc duoc cua so cua '$($p.ProcessName)'." }
    return $el
}

function Find-Element {
    param($Root, [string]$NameOrId, [string]$Type)
    $walker = [System.Windows.Automation.TreeWalker]::ControlViewWalker
    $stack = New-Object System.Collections.Stack
    $stack.Push(@($Root, 0))
    while ($stack.Count -gt 0) {
        $cur, $d = $stack.Pop()
        if ($d -gt 12) { continue }
        try {
            $n = $cur.Current.Name; $aid = $cur.Current.AutomationId
            $ct = $cur.Current.ControlType.ProgrammaticName -replace '^ControlType\.', ''
            $okName = ($n -and $n -like "*$NameOrId*") -or ($aid -and $aid -eq $NameOrId)
            $okType = (-not $Type) -or ($ct -eq $Type)
            if ($okName -and $okType -and $cur.Current.IsEnabled) { return $cur }
        }
        catch { }
        $c = $walker.GetFirstChild($cur)
        while ($c) { $stack.Push(@($c, $d + 1)); $c = $walker.GetNextSibling($c) }
    }
    return $null
}

function Show-Tree {
    param($El, [int]$Lvl, [int]$Max)
    if ($Lvl -gt $Max) { return }
    $walker = [System.Windows.Automation.TreeWalker]::ControlViewWalker
    $c = $walker.GetFirstChild($El)
    while ($c) {
        try {
            $ct = $c.Current.ControlType.ProgrammaticName -replace '^ControlType\.', ''
            $n = $c.Current.Name; $aid = $c.Current.AutomationId
            $r = $c.Current.BoundingRectangle
            $pad = '  ' * $Lvl
            $idPart = if ($aid) { " id=$aid" } else { '' }
            $en = if ($c.Current.IsEnabled) { '' } else { ' [disabled]' }
            $pos = if ($r.Width -gt 0) {
                (" @({0},{1}) {2}x{3}" -f [int]$r.X, [int]$r.Y, [int]$r.Width, [int]$r.Height)
            } else { '' }
            "$pad<$ct> '$n'$idPart$pos$en"
        }
        catch { }
        Show-Tree $c ($Lvl + 1) $Max
        $c = $walker.GetNextSibling($c)
    }
}

# ------------------------------------------------------------------ main ----

switch ($Action) {

    'monitors' {
        $i = 0
        foreach ($s in [System.Windows.Forms.Screen]::AllScreens) {
            "[{0}] {1} {2}x{3} tai ({4},{5}) primary={6}" -f $i, $s.DeviceName,
            $s.Bounds.Width, $s.Bounds.Height, $s.Bounds.X, $s.Bounds.Y, $s.Primary
            $i++
        }
    }

    'windows' {
        Get-Process | Where-Object { $_.MainWindowTitle } |
        Select-Object Id, ProcessName, MainWindowTitle |
        Sort-Object ProcessName | Format-Table -AutoSize | Out-String -Width 200
    }

    'shot' {
        if (-not $Out) { $Out = Join-Path (Get-Scratch) ("shot-{0}.png" -f (Get-Date -f 'HHmmss')) }
        if ($Window) {
            $p = Resolve-Proc $Window
            [void][Win32]::ShowWindow($p.MainWindowHandle, 9)   # SW_RESTORE
            [void][Win32]::SetForegroundWindow($p.MainWindowHandle)
            Start-Sleep -Milliseconds 400
            $r = New-Object Win32+RECT
            [void][Win32]::GetWindowRect($p.MainWindowHandle, [ref]$r)
            $bmp = Capture-Region $r.Left $r.Top ($r.Right - $r.Left) ($r.Bottom - $r.Top)
            $info = Save-Bitmap $bmp $Out; $bmp.Dispose()
            "cua so : $($p.MainWindowTitle)"
            "goc man hinh: ($($r.Left),$($r.Top))   << cong vao toa do trong anh de bam"
            "kich thuoc  : $info"
        }
        else {
            $screens = [System.Windows.Forms.Screen]::AllScreens
            $idx = if ($Monitor -ge 0) { $Monitor } else { 0 }
            if ($idx -ge $screens.Count) { throw "Chi co $($screens.Count) man hinh." }
            $b = $screens[$idx].Bounds
            $bmp = Capture-Region $b.X $b.Y $b.Width $b.Height
            $info = Save-Bitmap $bmp $Out; $bmp.Dispose()
            "man hinh [$idx] $($screens[$idx].DeviceName)"
            "goc man hinh: ($($b.X),$($b.Y))   << cong vao toa do trong anh de bam"
            "kich thuoc  : $info"
        }
        "file: $Out"
    }

    'focus' {
        $p = Resolve-Proc $Window
        if ([Win32]::IsIconic($p.MainWindowHandle)) { [void][Win32]::ShowWindow($p.MainWindowHandle, 9) }
        [void][Win32]::SetForegroundWindow($p.MainWindowHandle)
        Start-Sleep -Milliseconds 300
        "da focus: $($p.MainWindowTitle)"
    }

    'tree' {
        $root = Get-Root $Window
        "== cay control: $($root.Current.Name) (depth $Depth) =="
        Show-Tree $root 0 $Depth
    }

    'invoke' {
        $root = Get-Root $Window
        $el = Find-Element $root $Name $ControlType
        if (-not $el) { throw "Khong thay control '$Name'. Chay '-Action tree' de xem ten dung." }
        $n = $el.Current.Name
        $ct = $el.Current.ControlType.ProgrammaticName -replace '^ControlType\.', ''
        try {
            $pat = $el.GetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern)
            $pat.Invoke()
            "da Invoke <$ct> '$n'"
        }
        catch {
            try {
                $pat = $el.GetCurrentPattern([System.Windows.Automation.TogglePattern]::Pattern)
                $pat.Toggle(); "da Toggle <$ct> '$n'"
            }
            catch {
                $r = $el.Current.BoundingRectangle
                $cx = [int]($r.X + $r.Width / 2); $cy = [int]($r.Y + $r.Height / 2)
                [void][Win32]::SetCursorPos($cx, $cy); Start-Sleep -Milliseconds 120
                [Win32]::mouse_event([Win32]::MOUSEEVENTF_LEFTDOWN, 0, 0, 0, [IntPtr]::Zero)
                [Win32]::mouse_event([Win32]::MOUSEEVENTF_LEFTUP, 0, 0, 0, [IntPtr]::Zero)
                "khong co Invoke/Toggle -> da bam chuot tai ($cx,$cy) tren <$ct> '$n'"
            }
        }
    }

    'setvalue' {
        $root = Get-Root $Window
        $el = Find-Element $root $Name $ControlType
        if (-not $el) { throw "Khong thay control '$Name'." }
        $pat = $el.GetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern)
        $pat.SetValue($Text)
        "da dat '$($el.Current.Name)' = '$Text'"
    }

    'select' {
        $root = Get-Root $Window
        $el = Find-Element $root $Name $ControlType
        if (-not $el) { throw "Khong thay muc '$Name'." }
        $pat = $el.GetCurrentPattern([System.Windows.Automation.SelectionItemPattern]::Pattern)
        $pat.Select()
        "da chon '$($el.Current.Name)'"
    }

    'click' {
        if ($X -lt 0 -or $Y -lt 0) { throw "Can -X va -Y (toa do man hinh tuyet doi)." }
        [void][Win32]::SetCursorPos($X, $Y); Start-Sleep -Milliseconds 120
        [Win32]::mouse_event([Win32]::MOUSEEVENTF_LEFTDOWN, 0, 0, 0, [IntPtr]::Zero)
        [Win32]::mouse_event([Win32]::MOUSEEVENTF_LEFTUP, 0, 0, 0, [IntPtr]::Zero)
        "da bam tai ($X,$Y)"
    }

    'move' {
        if ($X -lt 0 -or $Y -lt 0) { throw "Can -X va -Y." }
        [void][Win32]::SetCursorPos($X, $Y); "con tro tai ($X,$Y)"
    }

    'type' {
        # BAT BUOC chi dinh cua so. Go vao "cua so dang focus" la cach chac chan
        # go nham vao tai lieu cua nguoi dung (da xay ra that, 21/09/2026).
        if (-not $Window) { throw "-Action type BAT BUOC co -Window. Khong bao gio go vao cua so dang focus mot cach mu quang." }
        $p = Assert-SafeTarget $Window
        & $PSCommandPath -Action focus -Window $Window | Out-Null
        Assert-TypingAllowed

        if ($UseSendKeys) {
            # SendKeys coi + ^ % ~ ( ) [ ] { } la ky tu dieu khien -> boc trong {}
            # CANH BAO: SendKeys di qua tang IME. Voi bo go tieng Viet dang bat,
            # chu bi bien dang ("test" -> "tet"). Chi dung khi that su can.
            $esc = $Text -replace '([+^%~(){}\[\]])', '{$1}'
            [System.Windows.Forms.SendKeys]::SendWait($esc)
            "da go bang SendKeys (co the bi IME lam bien dang): $Text"
        }
        else {
            # Mac dinh: dan qua clipboard. Khong di qua IME nen khong bi bien dang.
            $old = $null
            try { $old = Get-Clipboard -Raw -ErrorAction SilentlyContinue } catch { }
            Set-Clipboard -Value $Text
            Start-Sleep -Milliseconds 150
            [System.Windows.Forms.SendKeys]::SendWait('^v')
            Start-Sleep -Milliseconds 250
            if ($null -ne $old) { try { Set-Clipboard -Value $old } catch { } }
            "da dan (clipboard, an toan voi IME): $Text"
        }
    }

    'key' {
        if (-not $Window) { throw "-Action key BAT BUOC co -Window." }
        [void](Assert-SafeTarget $Window)
        & $PSCommandPath -Action focus -Window $Window | Out-Null
        Assert-TypingAllowed
        [System.Windows.Forms.SendKeys]::SendWait($Keys)
        "da gui phim: $Keys"
    }

    'wait' { Start-Sleep -Milliseconds $Ms; "doi ${Ms}ms" }
}
