// إنشاء صف جديد (دائماً في الأعلى)
function createNewRow() {
  const tableBody = document.getElementById("mainTableBody");
  
  // إزالة النشاط من الصفوف السابقة
  document.querySelectorAll(".active-row").forEach(row => {
      row.classList.remove("active-row");
  });

  const newRow = document.createElement("tr");
  newRow.className = "active-row";
  
  // استدعاء اسم الموظف من التخزين
  const empName = localStorage.getItem("username") || "موظف";

  // ترقيم الصفوف (الجديد هو 1)
  updateRowNumbers(2);

  newRow.innerHTML = `
    <td class="row-num">1</td>
    <td contenteditable="true" data-field="treasuryReserve">0</td>
    <td contenteditable="true" data-field="expense">0</td>
    <td class="emp-name">${empName}</td>
    <td class="time-cell">-</td>
    <td contenteditable="true" data-field="cash">0</td>
    <td contenteditable="true" data-field="network">0</td> <td contenteditable="true" data-field="bankTransfer">0</td>
    <td contenteditable="true" data-field="programRevenue">0</td>
    <td class="variance-neutral" data-field="variance">0</td>
    <td contenteditable="true" data-field="notes" class="notes-cell"></td> 
    <td class="status-cell"><span class="status-active">نشط 🟢</span></td>
  `;

  tableBody.prepend(newRow);
  
  // تصفير الأدوات
  handleClearCashCalc();
  clearCalc();
  document.getElementById("notesBox").value = "";

  // تحديث زر الإغلاق
  if(typeof updateCloseButtonState === 'function') updateCloseButtonState(newRow);
}

function updateRowNumbers(startFrom) {
    const rows = document.querySelectorAll("#mainTableBody tr");
    let counter = startFrom;
    for (let i = 0; i < rows.length; i++) {
        if(!rows[i].classList.contains("active-row")) {
             const numCell = rows[i].querySelector(".row-num") || rows[i].cells[0];
             if(numCell) numCell.textContent = counter++;
        }
    }
}

// --- منطق إزالة الصفر (UX) ---
function handleTableFocusIn(event) {
    const cell = event.target;
    if (cell.isContentEditable && cell.textContent === "0") {
        cell.textContent = ""; // مسح الصفر للكتابة فوراً
    }
}

function handleTableFocusOut(event) {
    const cell = event.target;
    if (cell.isContentEditable) {
        if (cell.textContent.trim() === "") {
            cell.textContent = "0"; // استعادة الصفر إذا ترك فارغاً
        }
        // إعادة الحساب عند الخروج
        if (cell.closest("tr")) recalculateRow(cell.closest("tr"));
    }
}

// دالة الحساب (المعدلة للشبكة الموحدة)
function recalculateRow(row) {
  const getVal = (field) => parseFloat(row.querySelector(`[data-field="${field}"]`).textContent) || 0;

  const expense = getVal("expense");
  const cash = getVal("cash");
  const network = getVal("network"); // حقل واحد للشبكة
  const bankTransfer = getVal("bankTransfer");
  const programRevenue = getVal("programRevenue");

  const actualTotal = cash + network + bankTransfer + expense;
  const variance = actualTotal - programRevenue;

  const varianceCell = row.querySelector('[data-field="variance"]');
  varianceCell.textContent = variance.toFixed(2);
  
  varianceCell.className = "";
  if (variance > 0) varianceCell.classList.add("variance-positive");
  else if (variance < 0) varianceCell.classList.add("variance-negative");
  else varianceCell.classList.add("variance-neutral");

  if(typeof updateCloseButtonState === 'function') updateCloseButtonState(row);
}

// تحديث الداشبورد (يقرأ من الصفوف المغلقة فقط)
function updateDashboardMetrics() {
    let totalRevenue = 0, totalCash = 0, totalNet = 0, totalVariance = 0;

    document.querySelectorAll("tr.closed-row").forEach(row => {
        const getVal = (field) => parseFloat(row.querySelector(`[data-field="${field}"]`).textContent) || 0;
        
        totalRevenue += getVal("programRevenue");
        totalCash += getVal("cash");
        totalNet += getVal("network") + getVal("bankTransfer");
        totalVariance += parseFloat(row.querySelector(`[data-field="variance"]`).textContent) || 0;
    });

    document.getElementById("metricTotalRevenue").textContent = totalRevenue.toLocaleString();
    document.getElementById("metricTotalCash").textContent = totalCash.toLocaleString();
    document.getElementById("metricTotalNet").textContent = totalNet.toLocaleString();
    
    const varEl = document.getElementById("metricTotalVariance");
    varEl.textContent = totalVariance.toLocaleString();
    varEl.style.color = totalVariance === 0 ? "#aaa" : (totalVariance > 0 ? "#2ecc71" : "#e74c3c");
}