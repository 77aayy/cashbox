// --- دوال إغلاق الصندوق (المرحلة 5) ---

/**
 * دالة لمعالجة الضغط على زر "إغلاق الصندوق"
 */
function handleCloseFund() {
  const activeRow = document.querySelector(".active-row");
  if (!activeRow) {
    showToast("لا يوجد صف نشط لإغلاقه.", "warning");
    return;
  }

  const { programRevenue } = getRowNumbers(activeRow);
  if (programRevenue <= 0) {
    showToast("الرجاء إدخال 'الإيراد (البرنامج)' قبل إغلاق الصندوق.", "warning");
    return;
  }

  const closeBtn = document.getElementById("closeFundBtn");
  const progress = document.getElementById("closeProgress");
  const btnLabel = document.getElementById("closeBtnLabel");

  closeBtn.disabled = true;
  closeBtn.classList.add("is-loading");
  btnLabel.textContent = "جاري الإغلاق... 0%";
  progress.style.width = "0%";

  let percent = 0;
  const interval = setInterval(() => {
    percent += 25;
    progress.style.width = `${percent}%`;
    btnLabel.textContent = `جاري الإغلاق... ${percent}%`;

    if (percent >= 100) {
      clearInterval(interval);
      lockRowForUndo(activeRow);
      btnLabel.textContent = "🔒 إغلاق الصندوق";
      progress.style.width = "0%";
      closeBtn.disabled = false;
      closeBtn.classList.remove("is-loading");
    }
  }, 300);
}

/**
 * تجميد الصف وبدء مؤقت التراجع (30 ثانية)
 */
function lockRowForUndo(row) {
  const rowId = row.dataset.rowId;
  
  row.classList.remove("active-row");
  row.classList.add("undo-pending"); 

  row.querySelectorAll('[contenteditable="true"]').forEach(cell => {
    cell.setAttribute("contenteditable", "false");
  });

  // (تعديل) - الخلية رقم 5 هي خلية التاريخ (بدءاً من 0)
  const timeCell = row.cells[5];
  timeCell.textContent = new Date().toLocaleString("ar-EG");

  const notes = document.getElementById("notesBox").value;
  const notesCell = row.querySelector('[data-field="notes"]');
  if (notesCell) {
    notesCell.textContent = notes;
  }

  // (جديد) - إضافة مربع اختيار غير مفعل
  const checkboxCell = row.cells[0];
  checkboxCell.innerHTML = `<input type="checkbox" class="compare-checkbox" disabled title="لا يمكن التحديد قبل الإغلاق النهائي">`;

  const actionCell = row.cells[row.cells.length - 1];
  actionCell.innerHTML = `
    <button class="btn btn-warning btn-sm" data-action="undo-close">
      تراجع (<span id="timer-${rowId}">30</span>)
    </button>
  `;

  let timeLeft = 30;
  const timerSpan = document.getElementById(`timer-${rowId}`);
  
  const timerId = setInterval(() => {
    timeLeft--;
    if (timerSpan) { 
        timerSpan.textContent = timeLeft;
    }

    if (timeLeft <= 0) {
      clearInterval(undoTimers[rowId]);
      delete undoTimers[rowId];
      finalizeClosure(row);
    }
  }, 1000);

  undoTimers[rowId] = timerId;

  // (نقطة 3) - هذه الدالة تقوم بتصفير الحقول
  createNewRow();
}

/**
 * (تعديل) - دالة الإغلاق النهائي (بعد 30 ثانية)
 */
function finalizeClosure(row) {
  row.classList.remove("undo-pending");
  row.classList.add("closed-row");
  
  const actionCell = row.cells[row.cells.length - 1];
  actionCell.innerHTML = `<span class="status-closed">مغلق نهائياً</span>`;
  
  // (تعديل) - حفظ الصف في localStorage وجلب الفهرس
  const savedIndex = saveEntryToLocalStorage(row);

  // (جديد) - تفعيل مربع الاختيار مع الفهرس الصحيح
  const checkboxCell = row.cells[0];
  checkboxCell.innerHTML = `<input type="checkbox" class="compare-checkbox" data-entry-index="${savedIndex}" title="تحديد للمقارنة">`;

  // تحديث إحصائيات الداشبورد
  updateDashboardMetrics(row, "add");
}

/**
 * دالة التراجع عن الإغلاق
 */
function undoClose(rowToUndo) {
  const rowId = rowToUndo.dataset.rowId;

  if (undoTimers[rowId]) {
    clearInterval(undoTimers[rowId]);
    delete undoTimers[rowId];
  }

  const currentActive = document.querySelector(".active-row");
  if (currentActive) {
    currentActive.remove();
  }

  rowToUndo.classList.add("active-row");
  rowToUndo.classList.remove("closed-row");
  rowToUndo.classList.remove("undo-pending");

  rowToUndo.querySelectorAll('td[data-field]').forEach(cell => {
    if(cell.dataset.field !== "notes") {
       cell.setAttribute("contenteditable", "true");
    }
  });

  // (تعديل) - الخلية رقم 5 هي خلية التاريخ
  rowToUndo.cells[5].textContent = "-";
  
  // (جديد) - إزالة مربع الاختيار
  rowToUndo.cells[0].innerHTML = "";

  const notesCell = rowToUndo.querySelector('[data-field="notes"]');
  if (notesCell) {
    document.getElementById("notesBox").value = notesCell.textContent;
    notesCell.textContent = ""; 
  }

  const actionCell = rowToUndo.cells[rowToUndo.cells.length - 1];
  actionCell.innerHTML = "<td>-</td>";
}

/**
 * (تعديل - نقطة 6) - دالة تحديث بطاقات الإحصائيات العلوية
 */
function updateDashboardMetrics(row, operation = "add") {
  const { programRevenue, cash, totalNet } = getRowNumbers(row);
  const variance = parseFloat(row.querySelector('[data-field="variance"]').textContent) || 0;
  
  const multiplier = (operation === "add") ? 1 : -1;

  // 1. تحديث الذاكرة
  dashboardTotals.revenue += (programRevenue * multiplier);
  dashboardTotals.cash += (cash * multiplier);
  dashboardTotals.net += (totalNet * multiplier);
  dashboardTotals.variance += (variance * multiplier);

  // 2. تحديث الواجهة (HTML)
  updateDashboardUI();
  
  // (جديد) - حفظ إجماليات الداشبورد الخاصة بالمستخدم الحالي
  const currentUser = localStorage.getItem("lastUser");
  if (!currentUser) {
    console.error("لا يمكن حفظ الإجماليات، المستخدم غير معروف.");
    return;
  }
  localStorage.setItem(currentUser + "_dashboardTotals", JSON.stringify(dashboardTotals));
}

/**
 * (جديد - نقطة 6) - دالة لتحديث واجهة الداشبورد بناءً على الذاكرة
 */
function updateDashboardUI() {
  document.getElementById("metricTotalRevenue").textContent = dashboardTotals.revenue.toFixed(2);
  document.getElementById("metricTotalCash").textContent = dashboardTotals.cash.toFixed(2);
  document.getElementById("metricTotalNet").textContent = dashboardTotals.net.toFixed(2);
  
  const varianceMetric = document.getElementById("metricTotalVariance");
  varianceMetric.textContent = dashboardTotals.variance.toFixed(2);
  
  varianceMetric.className = ""; // مسح التنسيقات القديمة
  if (dashboardTotals.variance > 0) {
    varianceMetric.classList.add("variance-positive");
  } else if (dashboardTotals.variance < 0) {
    varianceMetric.classList.add("variance-negative");
  } else {
    varianceMetric.classList.add("variance-neutral");
  }
}

/**
 * (تعديل) - دالة لحفظ الصف المغلق في الذاكرة (وإرجاع الفهرس)
 * @returns {number} - فهرس (index) السجل الذي تم حفظه
 */
function saveEntryToLocalStorage(row) {
  // 1. قراءة البيانات من خلايا الصف
  const entryData = {
    treasuryReserve: row.querySelector('[data-field="treasuryReserve"]').textContent,
    expense: row.querySelector('[data-field="expense"]').textContent,
    // (إصلاح الخطأ) - الفهرس الصحيح لاسم المستخدم هو 4
    username: row.cells[4].textContent,
    // (صحيح) - الفهرس الصحيح للتاريخ هو 5
    timestamp: row.cells[5].textContent, 
    cash: row.querySelector('[data-field="cash"]').textContent,
    visa: row.querySelector('[data-field="visa"]').textContent,
    masterCard: row.querySelector('[data-field="masterCard"]').textContent,
    american: row.querySelector('[data-field="american"]').textContent,
    mada: row.querySelector('[data-field="mada"]').textContent,
    bankTransfer: row.querySelector('[data-field="bankTransfer"]').textContent,
    programRevenue: row.querySelector('[data-field="programRevenue"]').textContent,
    variance: parseFloat(row.querySelector('[data-field="variance"]').textContent) || 0,
    notes: row.querySelector('[data-field="notes"]').textContent,
  };

  // 2. جلب السجلات القديمة (الخاصة بالمستخدم الحالي)
  const currentUser = localStorage.getItem("lastUser");
  if (!currentUser) {
    console.error("لا يمكن حفظ الصف، المستخدم غير معروف.");
    return -1; // إرجاع فهرس خاطئ
  }
  let entries = JSON.parse(localStorage.getItem(currentUser + "_closedEntries")) || [];
  
  // (جديد) - تحديد الفهرس
  const newIndex = entries.length;

  // 3. إضافة السجل الجديد
  entries.push(entryData);

  // 4. إعادة الحفظ
  localStorage.setItem(currentUser + "_closedEntries", JSON.stringify(entries));

  // (جديد) - إرجاع الفهرس
  return newIndex;
}