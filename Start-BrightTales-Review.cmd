@echo off
setlocal
title BrightTales P8-P11 Review Launcher
echo BrightTales P8-P11 Review Launcher
echo This checks the active workspaces, then starts or safely reuses Studio and Unity.
echo.
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\review\Start-BrightTalesReview.ps1" %*
set "reviewExit=%ERRORLEVEL%"
echo.
if not "%reviewExit%"=="0" echo Launcher stopped. Read the BLOCK items above and the latest log under %%LOCALAPPDATA%%\BrightTales\ReviewLauncher.
pause
exit /b %reviewExit%
