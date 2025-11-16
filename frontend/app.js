// دالة لتطبيق الثيم (تلقائي أو يدوي)
function applyInitialTheme() {
  const savedTheme = localStorage.getItem("theme");
  const toggleBtn = document.getElementById("themeToggleBtn");

  if (savedTheme) {
    document.documentElement.setAttribute("data-theme", savedTheme);
    if (toggleBtn) {
      toggleBtn.textContent = savedTheme === "dark" ? "☀️" : "🌙";
    }
  } else {
    const hour = new Date().getHours();
    if (hour >= 19 || hour < 6) { 
      document.documentElement.setAttribute("data-theme", "dark");
      if (toggleBtn) {
        toggleBtn.textContent = "☀️";
      }
    } else {
      document.documentElement.removeAttribute("data-theme");
      if (toggleBtn) {
        toggleBtn.textContent = "🌙";
      }
    }
  }
}

applyInitialTheme();


// متغير عام لتخزين القيمة القديمة للخلية
let activeCellOldValue = null;

// متغيرات عامة لتخزين إجماليات الداشبورد
let dashboardTotals = {
  revenue: 0,
  cash: 0,
  net: 0,
  variance: 0,
};

// متغير عام لتخزين مؤقتات التراجع
const undoTimers = {};


// --- (جديد) متغيرات حالة الجدول والترقيم ---
let closedEntriesData = []; // يخزن جميع السجلات المحفوظة (JSON)
let currentPage = 1;
const ITEMS_PER_PAGE = 5; // (الحد الأقصى لعدد الصفوف المعروضة)


/**
 * (تعديل) - دالة لتحميل البيانات المحفوظة عند فتح الصفحة (خاصة بالمستخدم)
 * تم تعديلها لدعم الترقيم
 */
function loadFromLocalStorage() {
  const currentUser = localStorage.getItem("lastUser");
  if (!currentUser) return;

  const savedTotals = JSON.parse(localStorage.getItem(currentUser + "_dashboardTotals"));
  if (savedTotals) {
    dashboardTotals = savedTotals;
    updateDashboardUI(); 
  }

  const savedEntries = JSON.parse(localStorage.getItem(currentUser + "_closedEntries")) || [];
  
  // (تعديل رئيسي) - تخزين البيانات في متغير عام بدلاً من رسمها مباشرة
  closedEntriesData = savedEntries; 

  // (جديد) - استدعاء دالة العرض والترقيم بعد تحميل البيانات
  applyFiltersAndRender(currentPage);
}


// --- المشغل الرئيسي للتطبيق ---
document.addEventListener("DOMContentLoaded", () => {
  // 1. حارس المصادقة
  if (!handleAuthCheck()) {
    return;
  }

  // 2. منطق الترحيب
  const hour = new Date().getHours();
  let greeting = "حياك الله،";
  if (hour >= 5 && hour < 12) {
    greeting = "صباح الخير،"; 
  } else if (hour >= 12 && hour < 18) {
    greeting = "مساء الخير،"; 
  }
  document.getElementById("userGreeting").textContent = greeting + " ";


  // 3. ربط زر تسجيل الخروج
  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", handleLogout);
  }

  // 4. ربط زر "صف جديد"
  const newRowBtn = document.getElementById("newRowBtn");
  if (newRowBtn) {
    newRowBtn.addEventListener("click", createNewRow);
  }

  // 5. ربط الجدول الرئيسي
  const tableBody = document.getElementById("mainTableBody");
  tableBody.addEventListener("click", handleTableClick);
  tableBody.addEventListener("focusin", handleTableFocusIn);
  tableBody.addEventListener("focusout", handleTableFocusOut);
  tableBody.addEventListener("keydown", handleTableKeyDown);
  tableBody.addEventListener("input", handleTableInput);

  // 6. تحميل البيانات المحفوظة أولاً
  loadFromLocalStorage();

  // 7. إنشاء صف جديد (نشط) تلقائياً
  createNewRow();

  // 8. ربط حاسبة الكاش
  const cashCalcTable = document.getElementById("cashCalcTable");
  cashCalcTable.addEventListener("input", handleCashCalcInput);
  cashCalcTable.addEventListener("keydown", handleTableKeyDown);

  // 9. ربط الآلة الحاسبة العادية
  const calcGrid = document.querySelector(".calc-grid");
  calcGrid.addEventListener("click", handleCalcClick);

  // 10. ربط زر "تصفير حاسبة الكاش"
  const clearCashBtn = document.getElementById("clearCashCalc");
  clearCashBtn.addEventListener("click", handleClearCashCalc);

  // 11. ربط زر "إغلاق الصندوق"
  const closeFundBtn = document.getElementById("closeFundBtn");
  closeFundBtn.addEventListener("click", handleCloseFund);

  // 12. ربط شاشة الآلة الحاسبة
  const calcDisplay = document.getElementById("calcDisplay");
  calcDisplay.addEventListener("keydown", handleCalcDisplayKeyDown);
  calcDisplay.addEventListener("input", handleCalcDisplayInput);
  calcDisplay.addEventListener("focusin", handleCalcDisplayFocusIn);

  // 13. ربط زر تبديل الثيم
  const themeToggleBtn = document.getElementById("themeToggleBtn");
  if (themeToggleBtn) {
    themeToggleBtn.addEventListener("click", () => {
      const currentTheme = document.documentElement.getAttribute("data-theme");
      if (currentTheme === "dark") {
        document.documentElement.removeAttribute("data-theme");
        localStorage.setItem("theme", "light"); 
        themeToggleBtn.textContent = "🌙";
      } else {
        document.documentElement.setAttribute("data-theme", "dark");
        localStorage.setItem("theme", "dark"); 
        themeToggleBtn.textContent = "☀️";
      }
    });
  }

  // 14. ربط زر "استخدام الإجمالي"
  const applyCashBtn = document.getElementById("applyCashTotalBtn");
  if (applyCashBtn) {
    applyCashBtn.addEventListener("click", applyCashTotalToRow);
  }

  // 15. ربط أزرار الطباعة
  const printLastBtn = document.getElementById("printLastBtn");
  if (printLastBtn) {
    printLastBtn.addEventListener("click", () => printReport(false));
  }
  
  const printAllBtn = document.getElementById("printAllBtn");
  if (printAllBtn) {
    printAllBtn.addEventListener("click", () => printReport(true));
  }

  // 16. ربط زر المقارنة
  const compareBtn = document.getElementById("compareBtn");
  if (compareBtn) {
    compareBtn.addEventListener("click", showClosureComparison); // (الدالة في printing.js)
  }

  // 17. (تم حذف) - أزرار النسخ الاحتياطي

  // 18. (تعديل) - ربط أدوات الفلترة (الآن هي للبحث البسيط)
  document.getElementById("filterSearch").addEventListener("input", () => applyFiltersAndRender(1));
  document.getElementById("filterClearBtn").addEventListener("click", clearFilters);

  // 19. (جديد) - ربط زر "تحديد الكل" للمقارنة
  document.getElementById("selectAllCompare").addEventListener("change", (e) => {
    const isChecked = e.target.checked;
    // نحدد فقط مربعات الاختيار الظاهرة (التي ليست في صفوف مفلترة)
    document.querySelectorAll('tr:not(.row-hidden) .compare-checkbox').forEach(checkbox => {
      if (!checkbox.disabled) {
        checkbox.checked = isChecked;
      }
    });
  });

});
// --- نهاية المشغل الرئيسي ---


// --- (تم حذف) - دوال النسخ الاحتياطي ---

// --- (جديد) دوال الفلترة والترقيم ---

/**
 * (جديد) - الدالة الرئيسية لتطبيق الفلترة والعرض
 * @param {number} page - رقم الصفحة المراد عرضها
 */
function applyFiltersAndRender(page) {
  // 1. جلب قيم الفلتر (البحث البسيط فقط)
  const filterSearch = document.getElementById("filterSearch").value.toLowerCase();
  
  // 2. تطبيق الفلترة على البيانات المخزنة
  filteredEntries = closedEntriesData.filter(entry => {
    
    // فلتر البحث العام (الملاحظات، الانحراف، الموظف، إلخ)
    const textContent = entry.username.toLowerCase() + entry.notes.toLowerCase() + entry.variance;
    const generalMatch = !filterSearch || textContent.includes(filterSearch);

    return generalMatch;
  });
  
  // 3. تطبيق الترقيم والعرض
  currentPage = page;
  renderPagination(filteredEntries.length);
  renderTablePage(page, filteredEntries);
}


/**
 * (جديد) - عرض الصفوف في الجدول (الترقيم)
 * @param {number} page - رقم الصفحة
 * @param {Array} entriesToShow - مصفوفة الإدخالات المفلترة
 */
function renderTablePage(page, entriesToShow) {
    const tableBody = document.getElementById("mainTableBody");
    
    // إزالة الصفوف المغلقة فقط
    tableBody.querySelectorAll('tr.closed-row, tr.undo-pending').forEach(row => row.remove());
    
    const start = (page - 1) * ITEMS_PER_PAGE;
    const end = page * ITEMS_PER_PAGE;
    const pageEntries = entriesToShow.slice(start, end);
    
    pageEntries.forEach((entry, index) => {
        // Index + 1 يستخدم للـ "م" في الجدول فقط
        createRowFromData(entry, (index + start) + 1); 
    });
}


/**
 * (جديد) - إنشاء أزرار ترقيم الصفحات
 * @param {number} totalItems - العدد الكلي للعناصر بعد الفلترة
 */
function renderPagination(totalItems) {
    const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);
    const paginationControls = document.getElementById("paginationControls");
    const pageButtons = document.getElementById("pageButtons");
    const pageInfo = document.getElementById("pageInfo");
    
    pageButtons.innerHTML = "";
    
    // إظهار أو إخفاء حاوية الترقيم
    if (totalItems > ITEMS_PER_PAGE) {
        paginationControls.style.display = 'flex';
    } else {
        paginationControls.style.display = 'none';
    }

    // تحديث معلومات الصفحة
    const endCount = Math.min(totalItems, currentPage * ITEMS_PER_PAGE);
    const startCount = (currentPage - 1) * ITEMS_PER_PAGE + 1;
    
    pageInfo.textContent = `عرض ${startCount} إلى ${endCount} من ${totalItems} سجلات`;
    
    if (totalPages <= 1) {
        pageInfo.textContent = `عرض ${totalItems} سجلات`;
        paginationControls.style.display = 'none';
        return;
    }
    
    // توليد الأزرار
    for (let i = 1; i <= totalPages; i++) {
        const button = document.createElement("button");
        button.className = `page-button ${i === currentPage ? 'active' : ''}`;
        button.textContent = i.toString();
        button.addEventListener("click", () => {
            applyFiltersAndRender(i);
        });
        pageButtons.appendChild(button);
    }
}


/**
 * (تعديل) - دالة لمسح الفلاتر
 */
function clearFilters() {
  document.getElementById("filterSearch").value = "";
  
  // (تعديل) - إعادة تطبيق الفلاتر والبدء من الصفحة الأولى
  applyFiltersAndRender(1);
  
  // إلغاء تحديد "تحديد الكل"
  document.getElementById("selectAllCompare").checked = false;
}

/**
 * (جديد) - دالة لتحديث حالة زر الإغلاق (لإصلاح العطل)
 * @param {HTMLTableRowElement} row - الصف النشط
 */
function updateCloseButtonState(row) {
    if (!row) {
        document.getElementById("closeFundBtn").disabled = true;
        return;
    }
    
    // الفهرس 13 هو خلية الإيراد (البرنامج) في الصف النشط
    const revenueCell = row.cells[13];
    const revenue = parseFloat(revenueCell.textContent) || 0; 
    const button = document.getElementById("closeFundBtn");
    
    // يتم تفعيل الزر فقط إذا كان الإيراد أكبر من الصفر
    button.disabled = (revenue <= 0);
}