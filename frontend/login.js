// --- (جديد) قاموس الترجمة ---
const translations = {
  ar: {
    pageTitle: "CashBox Secure — تسجيل الدخول",
    heroTitle: "نظام آمن لتقفيل الصندوق للفنادق",
    heroSubtitle: "حل سريع، قابل للمراجعة، ويعمل بدون انترنت لتقفيل الصندوق.",
    loginTitle: "مرحباً بعودتك",
    loginSubtitle: "سجل الدخول إلى حسابك",
    usernamePlaceholder: "اسم المستخدم",
    passwordPlaceholder: "كلمة المرور",
    loginBtn: "تسجيل الدخول",
    showRegisterBtn: "إنشاء حساب",
    registerTitle: "إنشاء حساب جديد",
    registerSubtitle: "اختر اسم مستخدم وكلمة مرور",
    registerBtn: "إنشاء الحساب",
    showLoginBtn: "العودة لتسجيل الدخول",
    errorUser: "الرجاء إدخال اسم المستخدم.",
    errorPass: "كلمة المرور غير صحيحة.",
  },
  en: {
    pageTitle: "CashBox Secure — Login",
    heroTitle: "Secure Cash Closing for Hotels",
    heroSubtitle: "Fast, auditable, and offline-friendly cash closing solution.",
    loginTitle: "Welcome Back",
    loginSubtitle: "Sign in to your account",
    usernamePlaceholder: "Username",
    passwordPlaceholder: "Password",
    loginBtn: "Sign In",
    showRegisterBtn: "Create account",
    registerTitle: "Create New Account",
    registerSubtitle: "Choose a username and password",
    registerBtn: "Create Account",
    showLoginBtn: "Back to Sign In",
    errorUser: "Please enter a username.",
    errorPass: "Incorrect password.",
  },
};

// --- (جديد) دالة تطبيق اللغة ---
function setLanguage(lang) {
  // 1. تحديث اتجاه الصفحة
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';

  // 2. حفظ اختيار اللغة
  localStorage.setItem('language', lang);

  // 3. تحديث أزرار اللغة
  document.getElementById('langArBtn').classList.toggle('active', lang === 'ar');
  document.getElementById('langEnBtn').classList.toggle('active', lang === 'en');

  // 4. ترجمة كل العناصر (بما فيها العنوان)
  document.querySelectorAll('[data-lang]').forEach(el => {
    const key = el.dataset.lang;
    if (translations[lang][key]) {
      el.textContent = translations[lang][key];
    }
  });
  
  // 5. ترجمة العناصر التي تحتاج placeholder
  document.querySelectorAll('[data-lang-placeholder]').forEach(el => {
    const key = el.dataset.langPlaceholder;
    if (translations[lang][key]) {
      el.placeholder = translations[lang][key];
    }
  });
  
  // 6. (إصلاح) - ترجمة عنوان الصفحة
  document.title = translations[lang].pageTitle;
}

// --- (جديد) دالة تبديل اللوحات (تسجيل/دخول) ---
function showView(viewId) {
  const loginView = document.getElementById('loginView');
  const registerView = document.getElementById('registerView');
  
  if (viewId === 'login') {
    loginView.classList.remove('view-hidden');
    registerView.classList.add('view-hidden');
  } else {
    loginView.classList.add('view-hidden');
    registerView.classList.remove('view-hidden');
  }
}

// --- (جديد) دالة تبديل رؤية كلمة المرور ---
function togglePasswordVisibility(inputId, toggleBtnId) {
  const input = document.getElementById(inputId);
  const toggleBtn = document.getElementById(toggleBtnId);
  if (input.type === 'password') {
    input.type = 'text';
    toggleBtn.textContent = '🙈';
  } else {
    input.type = 'password';
    toggleBtn.textContent = '👁';
  }
}

// --- (تعديل) - دالة تسجيل الدخول (بكلمة مرور رئيسية) ---
function handleLogin(event) {
  event.preventDefault(); // منع إرسال الفورم
  
  // --- (جديد) كلمة المرور الرئيسية ---
  // يمكنك تغييرها إلى أي كلمة مرور تريدها
  const MASTER_PASS = "12345";
  // ---------------------------------

  const username = document.getElementById('username').value;
  const password = document.getElementById('password').value;
  const msgEl = document.getElementById('loginMsg');
  const currentLang = localStorage.getItem('language') || 'ar';

  
  if (!username) {
    msgEl.textContent = translations[currentLang].errorUser;
    msgEl.className = "msg error";
    return;
  }
  
  // (جديد) - التحقق من كلمة المرور
  if (password !== MASTER_PASS) {
    msgEl.textContent = translations[currentLang].errorPass;
    msgEl.className = "msg error";
    return;
  }
  
  // (منطق وهمي) - إنشاء توكن
  const dummyTokenPayload = btoa(JSON.stringify({ username: username, role: "user" }));
  const dummyToken = `header.${dummyTokenPayload}.signature`;
  
  localStorage.setItem("token", dummyToken);
  
  msgEl.textContent = currentLang === 'ar' ? "تم بنجاح! جاري التوجيه..." : "Success! Redirecting...";
  msgEl.className = "msg success";
  
  // التوجيه إلى لوحة التحكم
  setTimeout(() => {
    window.location.href = "dashboard.html";
  }, 1000);
}

// --- (جديد) دالة إنشاء حساب (وهمية حالياً) ---
function handleRegister(event) {
    event.preventDefault();
    const msgEl = document.getElementById('regMsg');
    const currentLang = localStorage.getItem('language') || 'ar';

    msgEl.textContent = currentLang === 'ar' ? "تم إنشاء الحساب بنجاح! يمكنك تسجيل الدخول الآن." : "Account created! You can now sign in.";
    msgEl.className = "msg success";
    
    // العودة لواجهة الدخول
    setTimeout(() => {
        showView('login');
        msgEl.textContent = ""; // مسح الرسالة
    }, 1500);
}


// --- المشغل الرئيسي ---
document.addEventListener('DOMContentLoaded', () => {
  // 1. ربط أزرار تبديل اللغة
  document.getElementById('langArBtn').addEventListener('click', () => setLanguage('ar'));
  document.getElementById('langEnBtn').addEventListener('click', () => setLanguage('en'));

  // 2. ربط أزرار تبديل اللوحات
  document.getElementById('showRegisterBtn').addEventListener('click', () => showView('register'));
  document.getElementById('showLoginBtn').addEventListener('click', () => showView('login'));

  // 3. ربط أزرار رؤية كلمة المرور
  document.getElementById('togglePassLogin').addEventListener('click', () => togglePasswordVisibility('password', 'togglePassLogin'));
  document.getElementById('togglePassReg').addEventListener('click', () => togglePasswordVisibility('regPassword', 'togglePassReg'));

  // 4. ربط الفورم (تسجيل الدخول والإنشاء)
  document.getElementById('loginForm').addEventListener('submit', handleLogin);
  document.getElementById('registerForm').addEventListener('submit', handleRegister);
  
  // 5. تطبيق اللغة المحفوظة (أو الافتراضية)
  const savedLang = localStorage.getItem('language') || 'ar';
  setLanguage(savedLang);
});