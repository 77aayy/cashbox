/**
 * يتحقق من وجود التوكن، ويجلب اسم المستخدم
 * @returns {boolean} - إرجاع "صحيح" إذا تم تسجيل الدخول، و"خطأ" إذا لا
 */
function handleAuthCheck() {
  const token = localStorage.getItem("token");

  if (!token) {
    window.location.href = "index.html";
    return false;
  }

  // جلب بيانات المستخدم من التوكن
  const userData = decodeToken(token); // (هذه الدالة موجودة في utils.js)
  if (userData && userData.username) {
    document.getElementById("username").textContent = userData.username;
    localStorage.setItem("lastUser", userData.username);
  }
  
  return true; // المصادقة نجحت
}

/**
 * (تعديل) - دالة لمعالجة تسجيل الخروج مع نافذة تأكيد مخصصة
 */
function handleLogout() {
  // (جديد) - استخدام النافذة المخصصة (الموجودة في utils.js)
  showConfirmModal("هل أنت متأكد أنك تريد تسجيل الخروج؟", () => {
    // هذه الدالة ستنفذ فقط عند الضغط على "تأكيد"
    localStorage.removeItem("token");
    window.location.href = "index.html";
  });
}