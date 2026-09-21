<#
.SYNOPSIS
    Dồn cache dùng chung toàn máy sang D:\DevCache và app riêng của dự án IOT-CV
    sang D:\IOT_Tools, giải phóng ổ C:.

.DESCRIPTION
    Hai gốc tách biệt vì lý do khác nhau: -CacheRoot (mặc định D:\DevCache) chứa
    cache/tool của TOÀN MÁY (uv, pip, npm, pnpm, uv tool, uv python, platformio) —
    dùng chung cho mọi dự án, không bao giờ được xoá khi riêng dự án drone kết
    thúc. -AppRoot (mặc định D:\IOT_Tools) chỉ chứa app CÓ INSTALLER RIÊNG của dự
    án này (Arduino IDE, Mission Planner, MAVProxy, STM32CubeProgrammer).

    Idempotent: chạy lại nhiều lần không hỏng gì. Mặc định là DRY-RUN.
    Muốn thi hành thật thì thêm -Apply.

.EXAMPLE
    pwsh -File scripts/setup-d-drive.ps1
    pwsh -File scripts/setup-d-drive.ps1 -Apply
    pwsh -File scripts/setup-d-drive.ps1 -Apply -MoveExisting
#>
[CmdletBinding()]
param(
    [string] $CacheRoot = 'D:\DevCache',
    [string] $AppRoot = 'D:\IOT_Tools',
    [switch] $Apply,
    [switch] $MoveExisting,
    [switch] $ToolBinOnD
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

# ----------------------------------------------------------------------------
# Tiện ích
# ----------------------------------------------------------------------------

# KHÔNG dùng Get-PSDrive: nó nhớ đệm dung lượng từ lúc phiên PowerShell khởi động,
# nên bảng "trước / sau" luôn in ra chênh lệch 0.00 GB dù script vừa dời vài GB.
# Đó là một con số xanh vô nghĩa, tệ hơn không có số. DriveInfo đọc lại từ hệ thống
# mỗi lần gọi.
function Get-FreeSpaceTable {
    foreach ($letter in 'C', 'D') {
        try {
            $d = [System.IO.DriveInfo]::new("$letter`:\")
            if (-not $d.IsReady) { continue }
            [pscustomobject]@{
                Drive  = "$letter`:"
                FreeGB = [math]::Round($d.AvailableFreeSpace / 1GB, 2)
                UsedGB = [math]::Round(($d.TotalSize - $d.AvailableFreeSpace) / 1GB, 2)
            }
        }
        catch { }
    }
}

function Get-DirSizeMB {
    param([string] $Path)
    if (-not (Test-Path -LiteralPath $Path)) { return $null }
    $sum = (Get-ChildItem -LiteralPath $Path -Recurse -Force -ErrorAction SilentlyContinue |
            Measure-Object -Property Length -Sum).Sum
    if (-not $sum) { return 0 }
    return [math]::Round($sum / 1MB, 2)
}

function Write-Step {
    param([string] $Text)
    Write-Host ''
    Write-Host "== $Text" -ForegroundColor Cyan
}

function Write-Act {
    param([string] $Text, [string] $State = 'DO')
    $color = switch ($State) {
        'OK'   { 'Green' }
        'SKIP' { 'DarkGray' }
        'WARN' { 'Yellow' }
        'DRY'  { 'Magenta' }
        default { 'White' }
    }
    Write-Host ("  [{0,-4}] {1}" -f $State, $Text) -ForegroundColor $color
}

function Ensure-Dir {
    param([string] $Path)
    if (Test-Path -LiteralPath $Path) {
        Write-Act "thư mục đã có: $Path" 'SKIP'
        return
    }
    if ($Apply) {
        New-Item -ItemType Directory -Path $Path -Force | Out-Null
        Write-Act "tạo thư mục: $Path" 'OK'
    }
    else {
        Write-Act "sẽ tạo thư mục: $Path" 'DRY'
    }
}

# QUAN TRỌNG: KHÔNG dùng setx. setx cắt cụt giá trị ở 1024 ký tự.
# PATH của người dùng này dài 1552 ký tự -> setx PATH sẽ phá hỏng PATH.
function Set-UserEnv {
    param([string] $Name, [string] $Value)
    $current = [Environment]::GetEnvironmentVariable($Name, 'User')
    if ($current -eq $Value) {
        Write-Act "$Name đã đúng: $Value" 'SKIP'
        return
    }
    if ($Apply) {
        [Environment]::SetEnvironmentVariable($Name, $Value, 'User')
        Set-Item -Path "Env:$Name" -Value $Value   # có hiệu lực ngay trong phiên này
        Write-Act "$Name = $Value  (cũ: '$current')" 'OK'
    }
    else {
        Write-Act "sẽ đặt $Name = $Value  (cũ: '$current')" 'DRY'
    }
}

function Move-Tree {
    param([string] $From, [string] $To, [string] $Label)

    if (-not (Test-Path -LiteralPath $From)) {
        Write-Act "$Label - nguồn không tồn tại, bỏ qua: $From" 'SKIP'
        return
    }
    $sizeMB = Get-DirSizeMB -Path $From
    if ($sizeMB -eq 0) {
        Write-Act "$Label - nguồn rỗng, bỏ qua" 'SKIP'
        return
    }

    if (-not $MoveExisting) {
        Write-Act "$Label - có $sizeMB MB ở $From (thêm -MoveExisting để chuyển)" 'WARN'
        return
    }
    if (-not $Apply) {
        Write-Act "sẽ chuyển $Label ($sizeMB MB): $From -> $To" 'DRY'
        return
    }

    Ensure-Dir $To
    Write-Act "đang chuyển $Label ($sizeMB MB)..." 'DO'
    # robocopy chịu được đường dẫn dài và cây thư mục sâu, tốt hơn Move-Item
    $null = robocopy $From $To /E /MOVE /NFL /NDL /NJH /NJS /R:1 /W:1 /MT:16
    $rc = $LASTEXITCODE
    if ($rc -lt 8) {
        Write-Act "$Label đã chuyển xong (robocopy rc=$rc)" 'OK'
    }
    else {
        Write-Act "$Label CHUYỂN LỖI (robocopy rc=$rc) - dữ liệu cũ vẫn còn ở $From" 'WARN'
    }
}

# ----------------------------------------------------------------------------
# 0. Kiểm tra tiền đề
# ----------------------------------------------------------------------------

Write-Host ''
Write-Host '=============================================================' -ForegroundColor White
Write-Host ' setup-d-drive.ps1 - dồn cache/công cụ sang ổ D:' -ForegroundColor White
Write-Host '=============================================================' -ForegroundColor White
if (-not $Apply) {
    Write-Host ' CHE DO THU (dry-run). Them -Apply de thi hanh that.' -ForegroundColor Magenta
}

foreach ($r in $CacheRoot, $AppRoot) {
    $checkDrive = (Split-Path -Qualifier $r)
    if (-not (Test-Path -LiteralPath "$checkDrive\")) {
        throw "Không thấy ổ $checkDrive. Sửa tham số -CacheRoot / -AppRoot."
    }
}

Write-Step 'Dung lượng TRƯỚC khi chạy'
$before = Get-FreeSpaceTable
$before | Format-Table -AutoSize | Out-String | Write-Host

# ----------------------------------------------------------------------------
# 1. Tạo cây thư mục
# ----------------------------------------------------------------------------

Write-Step "1. Tạo cây thư mục dưới $CacheRoot (dùng chung toàn máy) và $AppRoot (riêng dự án)"

$dirCache = Join-Path $CacheRoot 'cache'
$dirTools = Join-Path $CacheRoot 'tools'
$dirBin   = Join-Path $CacheRoot 'bin'
$dirApps  = Join-Path $AppRoot 'apps'

Ensure-Dir $CacheRoot
Ensure-Dir $dirCache
Ensure-Dir $dirTools
Ensure-Dir $AppRoot
Ensure-Dir $dirApps
if ($ToolBinOnD) { Ensure-Dir $dirBin }

$pUvCache   = Join-Path $dirCache 'uv'
$pPipCache  = Join-Path $dirCache 'pip'
$pNpmCache  = Join-Path $dirCache 'npm'
$pPnpmStore = Join-Path $dirCache 'pnpm-store'
$pUvTools   = Join-Path $dirTools 'uv-tools'
$pUvPython  = Join-Path $dirTools 'uv-python'
$pPio       = Join-Path $dirTools 'platformio'

foreach ($p in $pUvCache, $pPipCache, $pNpmCache, $pPnpmStore, $pUvTools, $pUvPython, $pPio) {
    Ensure-Dir $p
}

# ----------------------------------------------------------------------------
# 2. Biến môi trường (User scope)
# ----------------------------------------------------------------------------

Write-Step '2. Đặt biến môi trường ở phạm vi User'

Set-UserEnv 'UV_CACHE_DIR'          $pUvCache
Set-UserEnv 'UV_TOOL_DIR'           $pUvTools
Set-UserEnv 'UV_PYTHON_INSTALL_DIR' $pUvPython
Set-UserEnv 'PIP_CACHE_DIR'         $pPipCache
Set-UserEnv 'NPM_CONFIG_CACHE'      $pNpmCache
Set-UserEnv 'PLATFORMIO_CORE_DIR'   $pPio

if ($ToolBinOnD) {
    Set-UserEnv 'UV_TOOL_BIN_DIR' $dirBin
    # Sửa PATH bằng .NET API, TUYỆT ĐỐI không dùng setx (cắt cụt ở 1024 ký tự)
    $userPath = [Environment]::GetEnvironmentVariable('PATH', 'User')
    if ($userPath -split ';' -contains $dirBin) {
        Write-Act "PATH đã chứa $dirBin" 'SKIP'
    }
    elseif ($Apply) {
        [Environment]::SetEnvironmentVariable('PATH', ($userPath.TrimEnd(';') + ';' + $dirBin), 'User')
        Write-Act "đã thêm $dirBin vào PATH (User), độ dài mới = $(($userPath + ';' + $dirBin).Length)" 'OK'
    }
    else {
        Write-Act "sẽ thêm $dirBin vào PATH (User)" 'DRY'
    }
}
else {
    $defaultBin = Join-Path $env:USERPROFILE '.local\bin'
    Write-Act "UV_TOOL_BIN_DIR giữ mặc định ($defaultBin) - đã nằm trong PATH, chỉ chứa shim vài trăm KB" 'SKIP'
}

# ----------------------------------------------------------------------------
# 3. pnpm store (không phải biến môi trường - là config của pnpm)
# ----------------------------------------------------------------------------

Write-Step '3. pnpm store — KHÔNG ép đường dẫn, chỉ kiểm tra'

# Kiểm chứng 21/09/2026: `pnpm config set store-dir` báo OK nhưng KHÔNG ghi được
# (lỗi "global bin directory is not in PATH" chặn nó), và `pnpm config get store-dir`
# vẫn trả về `undefined`.
#
# Quan trọng hơn: đó là hành vi ĐÚNG, không phải lỗi. Khi store-dir để trống, pnpm
# tự tạo MỘT kho cho MỖI Ổ ĐĨA, vì hardlink chỉ hoạt động trong cùng một ổ. Project
# ở ổ D dùng kho ở ổ D. Ép nó về một đường dẫn cứng sẽ phá cơ chế đó ngay khi có
# project nằm ở ổ khác. Vì vậy script chỉ BÁO CÁO, không đụng vào.
if (Get-Command pnpm -ErrorAction SilentlyContinue) {
    $realStore = (pnpm store path 2>$null)
    if ($realStore) {
        $drive = ($realStore -split ':')[0]
        if ($drive -eq 'C') {
            Write-Act "pnpm đang dùng kho trên ổ C: $realStore" 'WARN'
            Write-Act "  project ở ổ D sẽ tự sinh kho riêng trên D, không cần làm gì" 'WARN'
        }
        else {
            Write-Act "pnpm dùng kho $realStore (đúng ổ, không cần đổi)" 'OK'
        }
    }
    # Kho cũ trên ổ C là mồ côi khi mọi project đã nằm ở ổ D.
    $cStore = Join-Path $env:LOCALAPPDATA 'pnpm\store'
    $cMB = Get-DirSizeMB -Path $cStore
    if ($null -ne $cMB -and $cMB -gt 1) {
        Write-Act "kho pnpm cũ trên ổ C còn $cMB MB tại $cStore" 'WARN'
        Write-Act "  chạy 'pnpm store prune' trước; nếu vẫn còn thì xoá tay (node_modules đã cài vẫn chạy nhờ hardlink)" 'WARN'
    }
}
else {
    Write-Act 'không tìm thấy pnpm, bỏ qua' 'SKIP'
}

# ----------------------------------------------------------------------------
# 4. Chuyển dữ liệu cũ
# ----------------------------------------------------------------------------

Write-Step '4. Chuyển cache đang nằm trên ổ C:'

$running = Get-Process -Name node, npm, pnpm, python, py, uv, Code, platformio -ErrorAction SilentlyContinue
if ($running) {
    $names = ($running | Select-Object -ExpandProperty Name -Unique) -join ', '
    Write-Act "Đang có tiến trình chạy: $names -- đóng hết trước khi chuyển, nếu không robocopy sẽ bỏ sót file đang bị khoá." 'WARN'
}

# uv cache: tài liệu uv KHÔNG mô tả quy trình move. Chuyển thư mục thường chạy tốt
# (cache là content-addressed). Nếu sau đó uv báo lỗi cache -> chạy: uv cache clean
Move-Tree (Join-Path $env:LOCALAPPDATA 'uv\cache')  $pUvCache   'uv cache'
Move-Tree (Join-Path $env:LOCALAPPDATA 'pip\Cache') $pPipCache  'pip cache'
Move-Tree (Join-Path $env:LOCALAPPDATA 'npm-cache') $pNpmCache  'npm cache'

# pnpm: KHÔNG chuyển store bằng tay. pnpm store là content-addressable,
# cách an toàn là để store cũ lại rồi prune, store mới tự đầy lên khi cài.
$oldPnpmStore = Join-Path $env:LOCALAPPDATA 'pnpm\store'
$oldPnpmMB = Get-DirSizeMB -Path $oldPnpmStore
if ($oldPnpmMB) {
    Write-Act "store pnpm cũ trên C: còn $oldPnpmMB MB tại $oldPnpmStore" 'WARN'
    Write-Act "  giải phóng bằng: pnpm store prune   (rồi xoá tay thư mục trên nếu vẫn còn)" 'WARN'
}

# ----------------------------------------------------------------------------
# 5. uv tool - vá shim hỏng sau khi dời UV_TOOL_DIR + báo cáo tool mồ côi
# ----------------------------------------------------------------------------

Write-Step '5. uv tool: vá shim + báo cáo tool mồ côi'

# Shim của "uv tool install" (trong UV_TOOL_BIN_DIR) nướng cứng đường dẫn tuyệt
# đối tới venv của tool trong UV_TOOL_DIR cũ. Dời UV_TOOL_DIR mà không reinstall
# thì gặp lỗi "uv trampoline failed to canonicalize script path" (đã gặp thật
# với esptool khi dời D:\IOT_Tools\tools\uv-tools -> D:\DevCache\tools\uv-tools).
$oldUvToolDir = [Environment]::GetEnvironmentVariable('UV_TOOL_DIR', 'User')
$haveUv = [bool](Get-Command uv -ErrorAction SilentlyContinue)
if ($oldUvToolDir -and ($oldUvToolDir -ne $pUvTools) -and (Test-Path -LiteralPath $oldUvToolDir) -and $haveUv) {
    $toolDirs = Get-ChildItem -LiteralPath $oldUvToolDir -Directory -ErrorAction SilentlyContinue
    if ($toolDirs) {
        foreach ($t in $toolDirs) {
            if ($Apply) {
                Write-Act "đang vá shim cho tool '$($t.Name)' (uv tool install $($t.Name) --reinstall)..." 'DO'
                uv tool install $t.Name --reinstall 2>&1 | Out-Null
                Write-Act "'$($t.Name)' đã reinstall xong, shim đã trỏ đúng chỗ mới" 'OK'
            }
            else {
                Write-Act "sẽ chạy: uv tool install $($t.Name) --reinstall  (shim của '$($t.Name)' sẽ hỏng sau khi UV_TOOL_DIR đổi)" 'DRY'
            }
        }
    }
    else {
        Write-Act "$oldUvToolDir không có tool nào, bỏ qua" 'SKIP'
    }
}
else {
    Write-Act 'UV_TOOL_DIR chưa đổi hoặc chưa có uv, không cần vá shim' 'SKIP'
}

# Tool mồ côi: cài từ TRƯỚC khi UV_TOOL_DIR từng được đặt, nên vẫn nằm ở vị trí
# mặc định %APPDATA%\uv\tools. "uv tool list" không còn thấy nó (đang đọc
# UV_TOOL_DIR mới) dù tool vẫn chạy được bình thường. Chỉ báo cáo, không tự sửa
# (script không biết lúc chạy MCP server nào đang giữ tool đó). Ví dụ đã gặp:
# cua-driver 76 MB - MCP server của nó khoá file venv, reinstall giữa chừng sẽ hỏng.
$defaultUvToolDir = Join-Path $env:APPDATA 'uv\tools'
if ((Test-Path -LiteralPath $defaultUvToolDir) -and ($defaultUvToolDir -ne $pUvTools)) {
    $orphans = Get-ChildItem -LiteralPath $defaultUvToolDir -Directory -ErrorAction SilentlyContinue
    foreach ($o in $orphans) {
        # --force là bắt buộc: shim cũ trong ~/.local/bin vẫn còn, thiếu cờ này
        # uv báo 'Executable already exists' và không làm gì.
        Write-Act ("tool mồ côi: '{0}' vẫn nằm ở {1} - lệnh 'uv tool list' không thấy (tool vẫn chạy được). Đóng hẳn phần mềm đang giữ nó rồi chạy: uv tool install {0} --reinstall --force" -f $o.Name, $defaultUvToolDir) 'WARN'
    }
}

# ----------------------------------------------------------------------------
# 6. PlatformIO - trường hợp đặc biệt
# ----------------------------------------------------------------------------

Write-Step '6. PlatformIO core dir'

$oldPio = Join-Path $env:USERPROFILE '.platformio'
$oldPioMB = Get-DirSizeMB -Path $oldPio

if ($null -eq $oldPioMB) {
    Write-Act 'chưa có ~/.platformio, sẽ tự tạo trên D: ở lần chạy đầu' 'SKIP'
}
else {
    Write-Act "~/.platformio hiện $oldPioMB MB" 'DO'
    # penv là virtualenv chứa ĐƯỜNG DẪN TUYỆT ĐỐI -> copy sang chỗ khác là hỏng.
    # (platformio/platformio-core#3554: "bad interpreter"). Cách sạch: đổi tên, để PIO dựng lại.
    if ($Apply -and $MoveExisting) {
        $backup = "$oldPio.old"
        if (Test-Path -LiteralPath $backup) {
            Write-Act "đã có $backup - xoá tay nếu chắc chắn không cần" 'WARN'
        }
        else {
            Rename-Item -LiteralPath $oldPio -NewName '.platformio.old'
            Write-Act "đổi tên $oldPio -> $backup ; PlatformIO sẽ dựng lại trên D:" 'OK'
            Write-Act "  mở lại VS Code, đợi PlatformIO tải lại, chạy thử 1 project, rồi xoá $backup" 'WARN'
        }
    }
    else {
        Write-Act "sẽ đổi tên $oldPio -> $oldPio.old (KHÔNG copy: penv chứa đường dẫn tuyệt đối)" 'DRY'
    }
}

# ----------------------------------------------------------------------------
# 7. Kết quả
# ----------------------------------------------------------------------------

Write-Step 'Dung lượng SAU khi chạy'
$after = Get-FreeSpaceTable

$rows = foreach ($b in $before) {
    $a = $after | Where-Object { $_.Drive -eq $b.Drive }
    [pscustomobject]@{
        'Ổ'           = $b.Drive
        'Trống trước' = '{0:N2} GB' -f $b.FreeGB
        'Trống sau'   = '{0:N2} GB' -f $a.FreeGB
        'Chênh lệch'  = '{0:+0.00;-0.00;0.00} GB' -f ($a.FreeGB - $b.FreeGB)
    }
}
$rows | Format-Table -AutoSize | Out-String | Write-Host

Write-Host ''
Write-Host 'XONG.' -ForegroundColor Green
if ($Apply) {
    Write-Host 'PHẢI MỞ CỬA SỔ POWERSHELL MỚI thì biến môi trường mới có hiệu lực.' -ForegroundColor Yellow
    Write-Host 'Kiểm chứng bằng:' -ForegroundColor Yellow
    Write-Host '    uv cache dir; uv tool dir; uv python dir; pnpm store path; npm config get cache' -ForegroundColor Yellow
}
else {
    Write-Host 'Đây mới chỉ là chạy thử. Thêm -Apply (và -MoveExisting nếu muốn chuyển dữ liệu cũ).' -ForegroundColor Magenta
}
