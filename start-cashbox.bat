@echo off
chcp 65001 >nul
title صندوق التقفيل — تشغيل وتحديث

cd /d "%~dp0"

echo [1/5] تحديث مستودع GitHub (main)...
git add .
git commit -m "تحديث المشروع" 2>nul
git push origin 2>nul
if errorlevel 1 (
  echo      لا توجد تغييرات للرفع أو فشل الـ push — متابعة...
) else (
  echo      تم تحديث المستودع.
)

echo.
echo [2/5] نشر الموقع على GitHub Pages...
call npm run deploy 2>nul
if errorlevel 1 (
  echo      فشل النشر — تحقق من الاتصال أو صلاحيات GitHub.
) else (
  echo      تم النشر بنجاح — الموقع محدّث على https://77aayy.github.io/cashbox/
)

echo.
echo [3/5] تشغيل السيرفر المحلي...
start "سيرفر Vite" cmd /k "npm run dev"

echo [4/5] انتظار السيرفر 4 ثوانٍ...
timeout /t 4 /nobreak >nul

echo [5/5] فتح النسخة المحلية ونسخة GitHub في المتصفح...
start "" "http://localhost:5173/cashbox/"
start "" "https://77aayy.github.io/cashbox/"

echo.
echo تم: السيرفر يعمل — النسخة المحلية ونسخة GitHub مفتوحتان في المتصفح.
pause
