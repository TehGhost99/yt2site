# Publish yt2site to GitHub Pages (free public URL).
# Run from the project root in PowerShell:
#   .\scripts\publish-github.ps1
#
# First time only: you will be asked to log into GitHub in the browser.

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $Root

Write-Host ""
Write-Host "=== Publish to GitHub Pages ===" -ForegroundColor Cyan
Write-Host ""

# 1. Check tools
foreach ($cmd in @("git", "gh", "py")) {
    if (-not (Get-Command $cmd -ErrorAction SilentlyContinue)) {
        Write-Host "Missing '$cmd'. Install it, then run this script again." -ForegroundColor Red
        exit 1
    }
}

# 2. GitHub login (opens browser first time)
Write-Host "Checking GitHub login..." -ForegroundColor Yellow
$auth = gh auth status 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "Opening GitHub login in your browser..." -ForegroundColor Yellow
    gh auth login -h github.com -p https -w
}

# 3. Build locally so you can preview before pushing
Write-Host "Building site..." -ForegroundColor Yellow
py -m pip install -r requirements.txt -q
py scripts/build_site.py

# 4. Git init / commit if needed
if (-not (Test-Path ".git")) {
    git init
    git branch -M main
}

# Git needs a name/email for commits (repo-only; does not change global settings)
$userName = git config user.name 2>$null
$userEmail = git config user.email 2>$null
if (-not $userName -or -not $userEmail) {
    $ghUser = gh api user --jq ".login"
    $ghName = gh api user --jq ".name"
    if (-not $ghName -or $ghName -eq "null") { $ghName = $ghUser }
    git config user.name $ghName
    git config user.email "$ghUser@users.noreply.github.com"
    Write-Host "Set git author to $ghName <$ghUser@users.noreply.github.com> (this repo only)" -ForegroundColor DarkGray
}

git add -A
$status = git status --porcelain
if ($status) {
    git commit -m "Publish The Effective Learner site"
} else {
    Write-Host "No new changes to commit." -ForegroundColor DarkGray
}

# 5. Create repo on GitHub (skip if remote already exists)
$prevEAP = $ErrorActionPreference
$ErrorActionPreference = "SilentlyContinue"
$remote = git remote get-url origin 2>$null
$ErrorActionPreference = $prevEAP
if ($LASTEXITCODE -ne 0) { $remote = $null }
if (-not $remote) {
    Write-Host ""
    Write-Host "Creating public GitHub repo 'yt2site'..." -ForegroundColor Yellow
    gh repo create yt2site --public --source=. --remote=origin --push
} else {
    Write-Host "Pushing to $remote ..." -ForegroundColor Yellow
    git push -u origin main
}

# 6. Enable GitHub Pages (GitHub Actions as source)
Write-Host ""
Write-Host "Enabling GitHub Pages..." -ForegroundColor Yellow
$user = gh api user --jq ".login"
$prevEAP = $ErrorActionPreference
$ErrorActionPreference = "SilentlyContinue"
gh api "repos/$user/yt2site/pages" -X POST -f build_type=workflow 2>$null | Out-Null
if ($LASTEXITCODE -ne 0) {
    gh api "repos/$user/yt2site/pages" -X PUT -f build_type=workflow 2>$null | Out-Null
}
$ErrorActionPreference = $prevEAP
if ($LASTEXITCODE -ne 0) {
    Write-Host "Enable Pages manually (one time):" -ForegroundColor Yellow
    Write-Host "  https://github.com/$user/yt2site/settings/pages" -ForegroundColor White
    Write-Host "  Set Source to 'GitHub Actions', save, then re-run this script." -ForegroundColor Yellow
}

Start-Sleep -Seconds 2
$prevEAP = $ErrorActionPreference
$ErrorActionPreference = "SilentlyContinue"
$pages = gh api "repos/$user/yt2site/pages" --jq ".html_url" 2>$null
$ErrorActionPreference = $prevEAP

Write-Host ""
Write-Host "Done!" -ForegroundColor Green
Write-Host ""
if ($pages) {
    Write-Host "Your site URL:" -ForegroundColor Green
    Write-Host "  $pages" -ForegroundColor White
} else {
    Write-Host "Your site will be live in 1-2 minutes at:" -ForegroundColor Green
    Write-Host "  https://$user.github.io/yt2site/" -ForegroundColor White
}
Write-Host ""
Write-Host "Tip: after you edit content, run this script again (or push to GitHub)" -ForegroundColor DarkGray
Write-Host "      and the site will rebuild automatically." -ForegroundColor DarkGray
Write-Host ""
