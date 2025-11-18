// ===============================
//   TOAST MESSAGES (نظام التنبيهات الحديث)
// ===============================
function showToast(msg, type = "info") {
    // البحث عن الحاوية في الصفحة
    let container = document.getElementById("toastContainer");
    
    // إذا لم تكن موجودة (كما في صفحة الدخول)، نستخدم التنبيه العادي كبديل
    if (!container) {
        // محاولة البحث عن عنصر الرسائل في صفحة الدخول
        const loginMsg = document.getElementById("loginMsg");
        if (loginMsg && !loginMsg.classList.contains("hidden")) {
             loginMsg.textContent = msg;
             return;
        }
        alert(msg); 
        return;
    }

    // إنشاء عنصر التنبيه
    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;
    
    // تحديد الأيقونة حسب النوع
    let icon = "";
    switch (type) {
        case "success": icon = "✅"; break;
        case "error": icon = "❌"; break;
        case "warning": icon = "⚠️"; break;
        default: icon = "ℹ️";
    }

    toast.innerHTML = `
        <span class="toast-icon">${icon}</span>
        <span class="toast-msg">${msg}</span>
    `;

    // إضافة التنبيه للحاوية
    container.appendChild(toast);

    // حذف التنبيه تلقائياً بعد 3 ثواني
    setTimeout(() => {
        toast.style.animation = "fadeOut 0.3s forwards";
        toast.addEventListener("animationend", () => {
            toast.remove();
        });
    }, 3000);
}


// ===============================
//   LANGUAGE SYSTEM
// ===============================

const translations = {
    ar: {
        heroTitle: "نظام آمن لتقفيل الصندوق للفنادق",
        heroSubtitle: "حل سريع، قابل للمراجعة، ويعمل بدون إنترنت لتقفيل الصندوق.",
        loginTitle: "مرحباً بعودتك",
        loginSubtitle: "سجل الدخول إلى حسابك",
        registerTitle: "إنشاء حساب جديد",
        registerSubtitle: "اختر اسم مستخدم وكلمة مرور",
    },
    en: {
        heroTitle: "Secure Cash Box System for Hotels",
        heroSubtitle: "Fast, auditable and works offline for cash closing.",
        loginTitle: "Welcome Back",
        loginSubtitle: "Login to your account",
        registerTitle: "Create New Account",
        registerSubtitle: "Choose username and password",
    }
};

// تغيير اللغة (يعمل بشكل أساسي في صفحة الدخول)
function switchLanguage(lang) {
    localStorage.setItem("lang", lang);
    
    // تطبيق النصوص إذا كانت العناصر موجودة
    const updateText = (id, text) => {
        const el = document.getElementById(id);
        if (el) el.textContent = text;
    };

    updateText("heroTitle", translations[lang].heroTitle);
    updateText("heroSubtitle", translations[lang].heroSubtitle);

    const loginTitle = document.querySelector("#loginView .title");
    if (loginTitle) loginTitle.textContent = translations[lang].loginTitle;

    const loginSub = document.querySelector("#loginView .muted");
    if (loginSub) loginSub.textContent = translations[lang].loginSubtitle;

    const regTitle = document.querySelector("#registerView .title");
    if (regTitle) regTitle.textContent = translations[lang].registerTitle;

    const regSub = document.querySelector("#registerView .muted");
    if (regSub) regSub.textContent = translations[lang].registerSubtitle;
}