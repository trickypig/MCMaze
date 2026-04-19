# Symlinks the BP and RP into Minecraft's development pack folders.
# Must be run as administrator OR with Developer Mode enabled in Windows.

$ErrorActionPreference = "Stop"

$comMojang = Join-Path $env:LOCALAPPDATA "Packages\Microsoft.MinecraftUWP_8wekyb3d8bbwe\LocalState\games\com.mojang"
$devBP = Join-Path $comMojang "development_behavior_packs\TrickyMazeBP"
$devRP = Join-Path $comMojang "development_resource_packs\TrickyMazeRP"

$repoBP = Resolve-Path ".\behavior_pack"
$repoRP = Resolve-Path ".\resource_pack"

if (Test-Path $devBP) { Remove-Item $devBP -Recurse -Force }
if (Test-Path $devRP) { Remove-Item $devRP -Recurse -Force }

New-Item -ItemType SymbolicLink -Path $devBP -Target $repoBP | Out-Null
New-Item -ItemType SymbolicLink -Path $devRP -Target $repoRP | Out-Null

Write-Host "Linked:"
Write-Host "  BP -> $devBP"
Write-Host "  RP -> $devRP"
