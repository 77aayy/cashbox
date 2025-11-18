// المتغيرات العامة
const API_URL = "https://cashbox-backend.onrender.com/api/auth";
let currentLang = "ar"; // اللغة الافتراضية

// قاموس الترجمة
const translations = {
    ar: {
        title: "CashBox",
        loginTitle: "تسجيل الدخول",
        userLabel: "اسم المستخدم",
        passLabel: "كلمة المرور",
        loginBtn: "دخول آمن",
        noAccount: "ليس لديك حساب؟",
        createLink: "إنشاء حساب موظف",
        regTitle: "مستخدم جديد",
        regSub: "إعداد حساب موظف جديد",
        regBtn: "إنشاء الحساب",
        backLink: "العودة لتسجيل الدخول",
        langBtn: "English",
        successLogin: "تم الدخول بنجاح! 🔓",
        successReg: "تم الإنشاء! سجل دخولك الآن ✅",
        errorFill: "الرجاء ملء جميع الحقول",
        wait: "لحظة من فضلك..."
    },
    en: {
        title: "CashBox",
        loginTitle: "User Login",
        userLabel: "Username",
        passLabel: "Password",
        loginBtn: "Secure Login",
        noAccount: "No account?",
        createLink: "Create Employee Account",
        regTitle: "New User",
        regSub: "Setup new employee account",
        regBtn: "Create Account",
        backLink: "Back to Login",
        langBtn: "العربية",
        successLogin: "Login Successful! 🔓",
        successReg: "Created! Login now ✅",
        errorFill: "Please fill all fields",
        wait: "Please wait..."
    }
};

document.addEventListener("DOMContentLoaded", () => {
    // العناصر
    const mainCard = document.getElementById("main-card");
    const flipToReg = document.getElementById("flip-to-register");
    const flipToLogin = document.getElementById("flip-to-login");
    const langBtn = document.getElementById("lang-btn");
    
    // --- منطق الحركة (Animation) ---
    // عند الضغط على "إنشاء حساب"، نقلب البطاقة
    flipToReg.addEventListener("click", (e) => {
        e.preventDefault();
        mainCard.classList.add("flipped");
        clearMessages();
    });

    // عند الضغط على "العودة"، نعيد البطاقة
    flipToLogin.addEventListener("click", (e) => {
        e.preventDefault();
        mainCard.classList.remove("flipped");
        clearMessages();
    });

    // --- منطق اللغة (Language) ---
    langBtn.addEventListener("click", () => {
        currentLang = currentLang === "ar" ? "en" : "ar";
        updateLanguage();
    });

    function updateLanguage() {
        const t = translations[currentLang];
        const html = document.documentElement;
        
        // 1. تغيير الاتجاه
        html.setAttribute("dir", currentLang === "ar" ? "rtl" : "ltr");
        html.setAttribute("lang", currentLang);

        // 2. تغيير النصوص
        document.querySelectorAll("[data-lang]").forEach(el => {
            const key = el.getAttribute("data-lang");
            if (t[key]) el.textContent = t[key];
        });
        
        // تغيير نص الزر نفسه
        langBtn.querySelector("span").textContent = t.langBtn;
    }

    // --- منطق API (Backend) ---
    
    // 1. تسجيل الدخول
    document.getElementById("loginForm").addEventListener("submit", async (e) => {
        e.preventDefault();
        const user = document.getElementById("username").value;
        const pass = document.getElementById("password").value;
        const msgBox = document.getElementById("loginMsg");

        if(!user || !pass) return showMsg(msgBox, translations[currentLang].errorFill, "error");
        
        showMsg(msgBox, translations[currentLang].wait, "info");

        try {
            const res = await fetch(`${API_URL}/login`, {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ username: user, password: pass })
            });
            const data = await res.json();

            if(res.ok) {
                localStorage.setItem("token", data.token);
                localStorage.setItem("username", user);
                showMsg(msgBox, translations[currentLang].successLogin, "success");
                setTimeout(() => window.location.href = "dashboard.html", 1500);
            } else {
                showMsg(msgBox, data.message || "Error", "error");
            }
        } catch (err) {
            showMsg(msgBox, "Server Error", "error");
        }
    });

    // 2. إنشاء حساب
    document.getElementById("registerForm").addEventListener("submit", async (e) => {
        e.preventDefault();
        const user = document.getElementById("regUsername").value;
        const pass = document.getElementById("regPassword").value;
        const msgBox = document.getElementById("regMsg");

        if(!user || !pass) return showMsg(msgBox, translations[currentLang].errorFill, "error");

        showMsg(msgBox, translations[currentLang].wait, "info");

        try {
            const res = await fetch(`${API_URL}/register`, {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ username: user, password: pass })
            });
            const data = await res.json();

            if(res.ok) {
                showMsg(msgBox, translations[currentLang].successReg, "success");
                setTimeout(() => flipToLogin.click(), 1500); // العودة للوجه الأمامي تلقائياً
            } else {
                showMsg(msgBox, data.message || "Error", "error");
            }
        } catch (err) {
            showMsg(msgBox, "Server Error", "error");
        }
    });

    function showMsg(el, text, type) {
        el.textContent = text;
        el.className = `msg-box ${type}`;
        el.classList.remove("hidden");
    }

    function clearMessages() {
        document.querySelectorAll(".msg-box").forEach(el => el.classList.add("hidden"));
    }

    // Toggle Password Eye
    document.getElementById("togglePassLogin").addEventListener("click", function() {
        const input = document.getElementById("password");
        if(input.type === "password") {
            input.type = "text";
            this.classList.remove("fa-eye");
            this.classList.add("fa-eye-slash");
        } else {
            input.type = "password";
            this.classList.remove("fa-eye-slash");
            this.classList.add("fa-eye");
        }
    });
});