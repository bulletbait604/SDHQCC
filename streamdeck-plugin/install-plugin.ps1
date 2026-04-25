# StreamDeck KICK Live Plugin Installation Script
# Run this as Administrator

$ErrorActionPreference = "Stop"

# Plugin info
$pluginName = "com.sdhqcreator.kicklive.sdPlugin"
$sourceFolder = Split-Path -Parent $MyInvocation.MyCommand.Path
$destFolder = Join-Path $env:APPDATA "Elgato\StreamDeck\Plugins\$pluginName"

Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "KICK Live Plugin Installer" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""

# Check if icons are PNG (not SVG)
$iconsFolder = Join-Path $sourceFolder "icons"
$pngIcons = Get-ChildItem -Path $iconsFolder -Filter "*.png" -ErrorAction SilentlyContinue
$svgIcons = Get-ChildItem -Path $iconsFolder -Filter "*.svg" -ErrorAction SilentlyContinue

if ($svgIcons -and -not $pngIcons) {
    Write-Host "WARNING: Icons are SVG format. StreamDeck requires PNG images." -ForegroundColor Yellow
    Write-Host "Please open 'convert-icons.html' in a browser and save the PNG files first." -ForegroundColor Yellow
    Write-Host ""
    Read-Host "Press Enter to exit"
    exit 1
}

# Kill StreamDeck process
Write-Host "Stopping StreamDeck..." -ForegroundColor Yellow
$streamDeck = Get-Process "StreamDeck" -ErrorAction SilentlyContinue
if ($streamDeck) {
    Stop-Process -Name "StreamDeck" -Force
    Start-Sleep -Seconds 2
    Write-Host "StreamDeck stopped." -ForegroundColor Green
} else {
    Write-Host "StreamDeck not running." -ForegroundColor Green
}

# Remove old plugin if exists
if (Test-Path $destFolder) {
    Write-Host "Removing old plugin..." -ForegroundColor Yellow
    Remove-Item -Path $destFolder -Recurse -Force
}

# Copy plugin
Write-Host "Installing plugin to: $destFolder" -ForegroundColor Cyan
Copy-Item -Path $sourceFolder -Destination $destFolder -Recurse -Force

# Rename folder to have .sdPlugin extension if needed
$currentFolderName = Split-Path -Leaf $sourceFolder
if ($currentFolderName -ne $pluginName) {
    # Already copied with correct name
}

Write-Host ""
Write-Host "=========================================" -ForegroundColor Green
Write-Host "Plugin installed successfully!" -ForegroundColor Green
Write-Host "=========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Please start StreamDeck now." -ForegroundColor Cyan
Write-Host "The plugin will appear in the 'SDHQ Creator Corner' category." -ForegroundColor Cyan
Write-Host ""
Read-Host "Press Enter to exit"
