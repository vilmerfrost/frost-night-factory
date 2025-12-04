@echo off
echo Starting Frost Night Factory Remote Server...
cd /d %~dp0
python webhook-server.py
pause

