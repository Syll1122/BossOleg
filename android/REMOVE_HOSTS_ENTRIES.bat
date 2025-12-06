@echo off
echo ========================================
echo Remove Google Hosts File Entries
echo ========================================
echo.
echo This script will help you remove the hosts file entries blocking Android development.
echo You need to run this as Administrator.
echo.
pause

echo Opening hosts file in Notepad as Administrator...
echo Please remove or comment out these lines:
echo   127.0.0.1 dl.google.com 
echo   127.0.0.1 tools.google.com
echo.
echo Then save the file and run: ipconfig /flushdns
echo.

powershell -Command "Start-Process notepad -ArgumentList 'C:\Windows\System32\drivers\etc\hosts' -Verb RunAs"

pause

