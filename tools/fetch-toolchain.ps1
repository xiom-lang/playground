# Copyright (c) 2026 Eleftherios Notas and The XIOM Authors
# SPDX-License-Identifier: MIT OR Apache-2.0
#
# Fetch the XIOM toolchain pinned in TOOLCHAIN_VERSION into .toolchain\.
# Verifies the release SHA256SUMS before extracting.
#
# Usage: pwsh tools/fetch-toolchain.ps1
$ErrorActionPreference = 'Stop'

$Repo = Split-Path -Parent $PSScriptRoot
if ($env:TOOLCHAIN_TAG) {
  $Tag = $env:TOOLCHAIN_TAG.Trim()
} else {
  $Tag = (Get-Content -LiteralPath (Join-Path $Repo 'TOOLCHAIN_VERSION') -Raw).Trim()
}
$Version = $Tag.TrimStart('v')
$Asset = "xiom-$Version-windows-x64.zip"
$BaseUrl = "https://dl.xiom-lang.org/releases/$Tag"
$GitHubUrl = "https://github.com/xiom-lang/xiom/releases/download/$Tag"
$Dest = Join-Path $Repo '.toolchain'
$Stage = Join-Path $Repo '.toolchain.stage'

# The mirror is the preferred source, but a fresh release may not be
# published there yet; fall back to the GitHub release. Hash verification
# below is unchanged, so both sources are equally trusted.
function Get-ReleaseAsset([string]$Name, [string]$OutFile) {
  try {
    Invoke-WebRequest -Uri "$BaseUrl/$Name" -OutFile $OutFile -UseBasicParsing
  } catch {
    Write-Output "mirror missing $Name; falling back to the GitHub release"
    Invoke-WebRequest -Uri "$GitHubUrl/$Name" -OutFile $OutFile -UseBasicParsing
  }
}

Remove-Item -Recurse -Force $Stage -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force -Path $Stage | Out-Null
Write-Output "toolchain: $Tag ($Asset)"

Get-ReleaseAsset 'SHA256SUMS' (Join-Path $Stage 'SHA256SUMS')
Get-ReleaseAsset $Asset (Join-Path $Stage $Asset)

$sumLine = Get-Content -LiteralPath (Join-Path $Stage 'SHA256SUMS') | Where-Object { $_ -match [regex]::Escape($Asset) } | Select-Object -First 1
if (-not $sumLine) { throw "SHA256SUMS has no entry for $Asset" }
$expected = ($sumLine -split '\s+')[0].ToLowerInvariant()
$actual = (Get-FileHash -LiteralPath (Join-Path $Stage $Asset) -Algorithm SHA256).Hash.ToLowerInvariant()
if ($actual -ne $expected) { throw "checksum mismatch for ${Asset}: expected $expected, got $actual" }

$extract = Join-Path $Stage 'extract'
Remove-Item -Recurse -Force $extract -ErrorAction SilentlyContinue
Expand-Archive -LiteralPath (Join-Path $Stage $Asset) -DestinationPath $extract -Force

if (-not (Test-Path -LiteralPath (Join-Path $extract 'bin\xiom.exe'))) {
  throw 'archive did not contain bin\xiom.exe'
}

Remove-Item -Recurse -Force $Dest -ErrorAction SilentlyContinue
Move-Item -LiteralPath $extract -Destination $Dest
Remove-Item -Recurse -Force $Stage -ErrorAction SilentlyContinue

Write-Output "XIOM_BIN=$Dest\bin\xiom.exe"
Write-Output "XIOM_STDLIB=$Dest\lib"
