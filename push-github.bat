@echo off
chcp 65001 >nul
title رفع على GitHub و Firebase

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
  echo فشل نشر GitHub Pages. تحقق من الاتصال أو صلاحيات GitHub.
) else (
  echo تم النشر على GitHub Pages: https://77aayy.github.io/cashbox/
)

echo.
echo نشر قواعد Firestore على Firebase...
call npx firebase deploy
if errorlevel 1 (
  echo فشل نشر Firebase. تحقق من تسجيل الدخول: firebase login
) else (
  echo تم نشر Firebase بنجاح.
)

echo.
echo تم تحديث Git و Firebase بنجاح.
