@echo off
chcp 65001 >nul
title رفع المشروع إلى GitHub

cd /d "%~dp0"

echo إضافة التغييرات...
git add .

echo حالة الملفات:
git status --short

echo.
set /p MSG="رسالة الـ commit (اتركها فارغة = تحديث المشروع): "
if "%MSG%"=="" set MSG=تحديث المشروع

git commit -m "%MSG%"
if errorlevel 1 (
  echo لا توجد تغييرات جديدة للرفع، أو فشل الـ commit.
  pause
  exit /b 1
)

echo رفع إلى GitHub...
git push origin
if errorlevel 1 (
  echo فشل الـ push. تحقق من الاتصال أو صلاحيات GitHub.
  pause
  exit /b 1
)

echo.
echo تم رفع المشروع إلى GitHub بنجاح.
pause
