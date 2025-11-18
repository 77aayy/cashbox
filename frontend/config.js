// ===============================
//   API CONFIG (GLOBAL)
// ===============================

// 1. توجيه الرابط للسيرفر المحلي
const API_BASE_URL = "https://cashbox-backend.onrender.com/api";

async function apiRequest(endpoint, method = "GET", data = null) {
    // جلب التوكن (لاحظ: في صفحة الدخول سميناه 'token' وليس 'authToken')
    const token = localStorage.getItem("token"); 

    const options = {
        method,
        headers: {
            "Content-Type": "application/json",
        }
    };

    // إضافة التوكن للهيدر
    if (token) {
        options.headers["x-auth-token"] = token;
    }

    if (data) {
        options.body = JSON.stringify(data);
    }

    try {
        const res = await fetch(API_BASE_URL + endpoint, options);
        // إذا انتهت صلاحية التوكن
        if (res.status === 401) {
            localStorage.clear();
            window.location.href = "index.html";
            return null;
        }
        return await res.json();
    } catch (err) {
        console.error("API Error:", err);
        return { message: "تعذر الاتصال بالسيرفر", error: err.message };
    }
}