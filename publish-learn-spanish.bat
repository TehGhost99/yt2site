@echo off
cd /d "%~dp0"
echo.
echo Publishing Practice updates to LearnSpanishForAll (live GitHub Pages)...
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\publish-to-learn-spanish.ps1"
echo.
pause
