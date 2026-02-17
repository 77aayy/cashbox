@echo off
chcp 65001 >nul
title نشر الموقع على GitHub Pages

cd /d "%~dp0"

echo ========================================
echo   نشر صندوق التقفيل على GitHub Pages
echo ========================================
echo.

echo [1] بناء المشروع...
call npm run build
if errorlevel 1 (
  echo.
  echo فشل البناء. راجع الأخطاء أعلاه.
  pause
  exit /b 1
)

echo.
echo [2] نشر مجلد dist إلى فرع gh-pages...
call npx gh-pages -d dist --dotfiles
if errorlevel 1 (
  echo.
  echo فشل النشر. تحقق من:
  echo   - الاتصال بالإنترنت
  echo   - صلاحيات Git/GitHub
  echo   - تنفيذ: git config user.name و git config user.email
  pause
  exit /b 1
)

echo.
echo ========================================
echo   تم النشر بنجاح
echo ========================================
echo.
echo الموقع: https://77aayy.github.io/cashbox/
echo.
echo إذا لم يظهر التحديث فوراً: انتظر 1-2 دقيقة أو حدّث الصفحة بـ Ctrl+Shift+R
echo.
echo ملاحظة: تأكد من إعداد GitHub Pages في المستودع:
echo   Settings ^> Pages ^> Source: Deploy from branch
echo   Branch: gh-pages   Folder: / (root)
echo.
pause
