@echo off
cd /d "%~dp0"
echo.
echo Opening Netlify Drop...
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\publish-netlify-drop.ps1"
echo.
pause
