@echo off
cd /d "%~dp0"
echo.
echo Running GitHub publish script...
echo (A terminal window will stay open so you can read the result.)
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\publish-github.ps1"
echo.
pause
