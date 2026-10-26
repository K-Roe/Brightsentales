@echo off
setlocal
title BrightTales Review Preflight
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\review\Test-BrightTalesReviewPreflight.ps1"
set "reviewExit=%ERRORLEVEL%"
echo.
pause
exit /b %reviewExit%
