# Publish Practice updates from yt2site → LearnSpanishForAll (live GitHub Pages).
#
# Run from ANY folder in PowerShell (you must be logged into GitHub as TehGhost99):
#   irm https://raw.githubusercontent.com/TehGhost99/yt2site/cursor/practice-back-test-calendar-llm-e84d/scripts/publish-to-learn-spanish.ps1 | iex
# Or clone yt2site, then:
#   .\scripts\publish-to-learn-spanish.ps1
#
# What it does:
# 1. Clones/updates LearnSpanishForAll
# 2. Cherry-picks the Practice feature commit from yt2site
# 3. Pushes to main → Actions builds and updates gh-pages
# 4. Prints the live URL

$ErrorActionPreference = "Stop"

$SourceRepo = "TehGhost99/yt2site"
$SourceBranch = "cursor/practice-back-test-calendar-llm-e84d"
$TargetRepo = "TehGhost99/LearnSpanishForAll"
$CommitMsgMatch = "spaced tests, grades, calendar, and Llama tutor"
$WorkRoot = Join-Path $env:TEMP "learn-spanish-publish"
$TargetDir = Join-Path $WorkRoot "LearnSpanishForAll"

Write-Host ""
Write-Host "=== Publish to LearnSpanishForAll (live site) ===" -ForegroundColor Cyan
Write-Host ""

foreach ($cmd in @("git", "gh")) {
    if (-not (Get-Command $cmd -ErrorAction SilentlyContinue)) {
        Write-Host "Missing '$cmd'. Install GitHub CLI (gh) and Git, then re-run." -ForegroundColor Red
        exit 1
    }
}

Write-Host "Checking GitHub login..." -ForegroundColor Yellow
gh auth status 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Host "Opening GitHub login..." -ForegroundColor Yellow
    gh auth login -h github.com -p https -w
}

$login = gh api user --jq ".login"
if ($login -ne "TehGhost99") {
    Write-Host "Logged in as '$login'. You need to be TehGhost99 (or a collaborator with push on LearnSpanishForAll)." -ForegroundColor Yellow
}

if (Test-Path $TargetDir) {
    Remove-Item -Recurse -Force $TargetDir
}
New-Item -ItemType Directory -Force -Path $WorkRoot | Out-Null

Write-Host "Cloning $TargetRepo ..." -ForegroundColor Yellow
gh repo clone $TargetRepo $TargetDir
Set-Location $TargetDir

Write-Host "Fetching feature branch from $SourceRepo ..." -ForegroundColor Yellow
git remote add yt2site "https://github.com/$SourceRepo.git" 2>$null
git fetch yt2site $SourceBranch

# Prefer the named feature commit; fall back to branch tip.
$featureSha = git log -1 --format=%H "yt2site/$SourceBranch" --grep $CommitMsgMatch
if (-not $featureSha) {
    $featureSha = git rev-parse "yt2site/$SourceBranch"
}
Write-Host "Using commit $featureSha" -ForegroundColor DarkGray

$onMain = git merge-base --is-ancestor $featureSha HEAD
if ($LASTEXITCODE -eq 0) {
    Write-Host "That commit is already on main. Pushing main anyway to trigger deploy..." -ForegroundColor DarkGray
} else {
    Write-Host "Cherry-picking onto LearnSpanishForAll main..." -ForegroundColor Yellow
    git cherry-pick $featureSha
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Cherry-pick failed. Resolve conflicts, then: git cherry-pick --continue && git push origin main" -ForegroundColor Red
        exit 1
    }
}

Write-Host "Pushing to origin/main (triggers Pages deploy)..." -ForegroundColor Yellow
git push origin main

Write-Host ""
Write-Host "Done. Actions will rebuild gh-pages in ~1-2 minutes." -ForegroundColor Green
Write-Host "Live site: https://tehghost99.github.io/LearnSpanishForAll/practice.html" -ForegroundColor White
Write-Host ""
Write-Host "Hard-refresh the page (Ctrl+F5). Sign in to use grading + tutor." -ForegroundColor DarkGray
Write-Host ""
Write-Host "If you rotated GROQ_API_KEY, also update it in Appwrite:" -ForegroundColor Yellow
Write-Host "  Functions → grade-check → Settings → Environment variables → GROQ_API_KEY" -ForegroundColor White
Write-Host "  Or re-run:  `$env:APPWRITE_API_KEY='...'; `$env:GROQ_API_KEY='...'; py scripts/deploy_grade_function.py" -ForegroundColor White
Write-Host ""
