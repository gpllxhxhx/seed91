$ErrorActionPreference = 'Stop'

function Test-IsAdministrator {
  $currentIdentity = [Security.Principal.WindowsIdentity]::GetCurrent()
  $principal = New-Object Security.Principal.WindowsPrincipal($currentIdentity)
  return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

if (-not (Test-IsAdministrator)) {
  $escapedScriptPath = '"' + $PSCommandPath.Replace('"', '""') + '"'
  $argumentList = @(
    '-NoProfile'
    '-ExecutionPolicy'
    'Bypass'
    '-File'
    $escapedScriptPath
  )
  Start-Process -FilePath 'powershell.exe' -Verb RunAs -ArgumentList $argumentList | Out-Null
  Write-Output 'Elevation requested. Please approve the UAC prompt in the new PowerShell window.'
  exit 0
}

$machinePath = [Environment]::GetEnvironmentVariable('Path', 'Machine')
if (-not $machinePath) {
  Write-Error "Machine PATH is empty or unavailable."
}

$workspaceRoot = Split-Path -Parent $PSScriptRoot
$timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$backupPath = Join-Path $workspaceRoot "path-backup-machine-$timestamp.txt"
Set-Content -LiteralPath $backupPath -Value $machinePath -Encoding UTF8

$pathParts = New-Object System.Collections.Generic.List[string]
$nodeInsertIndex = $null

foreach ($part in ($machinePath -split ';')) {
  if ($part -ieq 'C:\P') {
    if ($null -eq $nodeInsertIndex) {
      $nodeInsertIndex = $pathParts.Count
    }
    continue
  }

  if ($part -ieq 'ogram Files\nodejs' -or $part -ieq 'ogram Files\nodejs\') {
    if ($null -eq $nodeInsertIndex) {
      $nodeInsertIndex = $pathParts.Count
    }
    continue
  }

  $pathParts.Add($part)
}

if ($null -eq $nodeInsertIndex) {
  $nodeInsertIndex = $pathParts.Count
}

$normalizedNodePath = 'C:\Program Files\nodejs\'
$hasNodePath = $false

foreach ($part in $pathParts) {
  if ($part.TrimEnd('\') -ieq $normalizedNodePath.TrimEnd('\')) {
    $hasNodePath = $true
    break
  }
}

if (-not $hasNodePath) {
  $pathParts.Insert($nodeInsertIndex, $normalizedNodePath)
}

$newMachinePath = $pathParts -join ';'
[Environment]::SetEnvironmentVariable('Path', $newMachinePath, 'Machine')
$savedMachinePath = [Environment]::GetEnvironmentVariable('Path', 'Machine')

if ($savedMachinePath -ne $newMachinePath) {
  Write-Error "Machine PATH verification failed after update."
}

Write-Output "Backup: $backupPath"
Write-Output "Machine PATH updated successfully."
($savedMachinePath -split ';') | ForEach-Object -Begin { $i = 0 } -Process {
  Write-Output ("[{0}] {1}" -f $i, $_)
  $i++
}
