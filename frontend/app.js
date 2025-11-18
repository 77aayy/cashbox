document.addEventListener("DOMContentLoaded", () => {
    const token = localStorage.getItem("token");
    const username = localStorage.getItem("username");

    if (!token) { window.location.href = "index.html"; return; }

    // رسالة الترحيب
    if (username) {
        const userElem = document.getElementById("username");
        if (userElem) userElem.textContent = username;
    }

    // زر الخروج
    const logoutBtn = document.getElementById("logoutBtn");
    if(logoutBtn) {
        logoutBtn.addEventListener("click", () => {
            localStorage.removeItem("token");
            localStorage.removeItem("username");
            window.location.href = "index.html";
        });
    }

    // ربط أحداث الجدول (بما في ذلك إزالة الصفر)
    const mainTable = document.getElementById("mainTableBody"); // أو الجدول نفسه
    const tableParent = document.querySelector("table");
    
    if(tableParent) {
        tableParent.addEventListener("input", handleTableInput);
        tableParent.addEventListener("focusin", handleTableFocusIn); // لإزالة الصفر
        tableParent.addEventListener("focusout", handleTableFocusOut); // لاستعادة الصفر
        tableParent.addEventListener("keydown", handleTableKeyDown); // لمنع الحروف
    }

    // ربط حاسبة الكاش (للتجميع)
    const cashTable = document.getElementById("cashCalcTable");
    if(cashTable) {
        cashTable.addEventListener("input", handleCashCalcInput);
        cashTable.addEventListener("keydown", handleTableKeyDown);
        // إضافة خاصية إزالة الصفر لحاسبة الكاش أيضاً
        cashTable.addEventListener("focusin", handleTableFocusIn);
        cashTable.addEventListener("focusout", handleTableFocusOut);
    }

    // تشغيل آلة الحاسبة
    const calcGrid = document.querySelector(".calc-grid");
    if(calcGrid) calcGrid.addEventListener("click", handleCalcClick);

    // إنشاء صف أولي إذا كان فارغاً
    if (mainTable && mainTable.children.length === 0) {
        createNewRow();
    }
});