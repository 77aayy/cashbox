@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo حذف مجلد cashbox القديم (غير مستخدم)...
if not exist "cashbox" (
  echo المجلد غير موجود — لا يوجد شيء للحذف.
  pause
  exit /b 0
)
rd /s /q "cashbox" 2>nul
if exist "cashbox" (
  echo فشل الحذف: المجلد مستخدم من برنامج آخر.
  echo أغلق Cursor وجميع نوافذ الطرفية ثم شغّل هذا الملف مرة أخرى.
) else (
  echo تم حذف المجلد بنجاح.
)
pause
