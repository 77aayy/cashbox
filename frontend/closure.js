let activeTimer = null;

function updateCloseButtonState(row) {
    // الزر أصبح فقط للبدء، الحالة الحقيقية تظهر في الجدول
    const btn = document.getElementById("closeFundBtn");
    if(!row) { if(btn) btn.disabled = true; return; }
    if(btn) btn.disabled = false;
}

// بدء الإغلاق
function initiateClosure() {
    const activeRow = document.querySelector(".active-row");
    if (!activeRow) return showToast("لا يوجد صف نشط", "error");

    // 1. التحقق من إيراد البرنامج
    const revenue = parseFloat(activeRow.querySelector('[data-field="programRevenue"]').textContent) || 0;
    if (revenue <= 0) {
        showToast("⚠️ لا يمكن الإغلاق! يجب إدخال إيراد البرنامج أولاً.", "warning");
        return;
    }

    // 2. نقل الملاحظات للصف
    const notes = document.getElementById("notesBox").value;
    activeRow.querySelector('[data-field="notes"]').textContent = notes;

    // 3. بدء العداد داخل الصف
    const statusCell = activeRow.querySelector(".status-cell");
    let timeLeft = 30;
    
    // تعطيل زر الإغلاق الرئيسي لمنع التكرار
    const mainBtn = document.getElementById("closeFundBtn");
    mainBtn.disabled = true;
    mainBtn.querySelector("span").textContent = "⏳ جاري العد...";

    // مسح أي عداد سابق
    if (activeTimer) clearInterval(activeTimer);

    activeTimer = setInterval(() => {
        statusCell.innerHTML = `<span class="status-timer">⏳ ${timeLeft} ثانية...</span>`;
        timeLeft--;

        if (timeLeft < 0) {
            clearInterval(activeTimer);
            finalizeClosure(activeRow);
        }
    }, 1000);
}

// الإغلاق النهائي
function finalizeClosure(row) {
    // تحويل الصف لمغلق
    row.classList.remove("active-row");
    row.classList.add("closed-row");
    
    // قفل الخلايا
    row.querySelectorAll('[contenteditable]').forEach(cell => {
        cell.contentEditable = "false";
        cell.style.backgroundColor = "rgba(0,0,0,0.2)";
        cell.style.color = "#aaa";
    });

    // تحديث الوقت
    const now = new Date();
    row.cells[4].textContent = now.toLocaleTimeString('ar-EG');

    // تغيير الحالة لقفل أحمر
    const statusCell = row.querySelector(".status-cell");
    statusCell.innerHTML = '<span class="status-closed">🔒 تم الإغلاق</span>';

    // تحديث الداشبورد
    updateDashboardMetrics();

    // إعادة ضبط الزر الرئيسي
    const mainBtn = document.getElementById("closeFundBtn");
    mainBtn.disabled = false;
    mainBtn.querySelector("span").textContent = "🔒 إغلاق الصندوق";

    // إنشاء صف جديد
    createNewRow();
    
    showToast("تم إغلاق الصندوق نهائياً", "success");
}

// ربط الزر
document.addEventListener("DOMContentLoaded", () => {
    const closeBtn = document.getElementById("closeFundBtn");
    if(closeBtn) closeBtn.addEventListener("click", initiateClosure);
});