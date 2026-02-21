@echo off
cd /d "%~dp0"
echo Starting Development Server and opening local preview...
npm run dev -- --open
pause
