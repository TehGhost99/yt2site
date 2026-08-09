# Fastest way to get a public link — no GitHub account required.
# Run: .\scripts\publish-netlify-drop.ps1
#
# This opens Netlify Drop and your output folder. Drag the folder onto the page.

$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$Output = Join-Path $Root "output"

if (-not (Test-Path (Join-Path $Output "index.html"))) {
    Write-Host "Building site first..." -ForegroundColor Yellow
    Set-Location $Root
    py -m pip install -r requirements.txt -q
    py scripts/build_site.py
}

Write-Host ""
Write-Host "=== Netlify Drop (about 30 seconds) ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. A browser tab will open to Netlify Drop" -ForegroundColor White
Write-Host "2. A File Explorer window will open to your 'output' folder" -ForegroundColor White
Write-Host "3. Drag the entire 'output' folder onto the Netlify page" -ForegroundColor White
Write-Host "4. Netlify gives you a link like https://something.netlify.app" -ForegroundColor White
Write-Host ""

Start-Process "https://app.netlify.com/drop"
Start-Process explorer.exe $Output
