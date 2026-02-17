@echo off
chcp 65001 >nul
title رفع على GitHub

cd /d "%~dp0"

echo إضافة التغييرات...
git add .

echo حالة الملفات:
git status --short

echo.
git commit -m "تحديث المشروع"
if errorlevel 1 (
  echo لا توجد تغييرات جديدة للرفع، أو فشل الـ commit.
  exit /b 1
)

echo رفع الكود إلى GitHub (main)...
git push origin
if errorlevel 1 (
  echo فشل الـ push. تحقق من الاتصال أو صلاحيات GitHub.
  exit /b 1
)

echo.
echo نشر الموقع على GitHub Pages...
call npm run deploy
if errorlevel 1 (
  echo فشل النشر. تحقق من الاتصال أو صلاحيات GitHub.
) else (
  echo تم النشر — الموقع محدّث: https://77aayy.github.io/cashbox/
)

echo.
echo تم رفع المشروع إلى GitHub بنجاح.
