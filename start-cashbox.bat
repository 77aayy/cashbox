@echo off
chcp 65001 >nul
title صندوق التقفيل — سيرفر محلي

cd /d "%~dp0cashbox-new"

echo تشغيل السيرفر...
start "سيرفر Vite" cmd /k "npm run dev"

echo انتظار تشغيل السيرفر 4 ثوانٍ...
timeout /t 4 /nobreak >nul

echo فتح صفحة الدخول في المتصفح...
start "" "http://localhost:5173/cashbox/"

echo تم. نافذة السيرفر مفتوحة — لا تغلقها لإبقاء التطبيق يعمل.
