/**
 * (تعديل) - دالة لإنشاء صف جديد في الجدول
 */
function createNewRow() {
  const tableBody = document.getElementById("mainTableBody");
  const rowCount = tableBody.rows.length;

  const currentActive = document.querySelector(".active-row");
  if (currentActive) {
    currentActive.classList.remove("active-row", "active-row-z", "active-row-p", "active-row-n");
    if (currentActive.cells[0].textContent !== "1") {
      const actionCell = currentActive.cells[currentActive.cells.length - 1];
      // (جديد) - إضافة زر التكرار
      actionCell.innerHTML = `
        <div class="action-cell-buttons">
          <button class="btn btn-danger btn-sm" data-action="delete-row">🗑️ حذف</button>
          <button class="btn btn-secondary btn-sm" data-action="duplicate-row">📄 تكرار</button>
        </div>
      `;
    }
  }

  const newRow = document.createElement("tr");
  newRow.dataset.rowId = `row-${Date.now()}`;
  newRow.classList.add("active-row", "active-row-z");
  newRow.classList.add("new-row-animation"); 

  const actionCellHtml = "<td>-</td>";

  newRow.innerHTML = `
    <td class="col-checkbox"></td> <td>${rowCount + 1}</td>
    <td contenteditable="true" data-field="treasuryReserve">0</td>
    <td contenteditable="true" data-field="expense">0</td>
    <td>${document.getElementById("username").textContent}</td>
    <td>-</td>
    <td contenteditable="true" data-field="cash">0</td>
    <td contenteditable="true" data-field="visa">0</td>
    <td contenteditable="true" data-field="masterCard">0</td>
    <td contenteditable="true" data-field="american">0</td>
    <td contenteditable="true" data-field="mada">0</td>
    <td contenteditable="true" data-field="bankTransfer">0</td>
    <td contenteditable="true" data-field="programRevenue">0</td>
    <td class="variance-neutral" data-field="variance">0</td>
    <td data-field="notes"></td> 
    ${actionCellHtml}
  `;

  tableBody.prepend(newRow);

  handleClearCashCalc();
  clearCalc();
  document.getElementById("notesBox").value = "";

  const messageEl = document.getElementById("varianceMessage");
  if (messageEl) {
    messageEl.style.display = "none";
  }
  
  // (إصلاح العطل الجوهري) - تأمين حالة الزر فوراً عند إنشاء صف جديد
  updateCloseButtonState(newRow); 
}

/**
 * (جديد) - دالة استنساخ صف لملء صف جديد
 * @param {HTMLTableRowElement} rowToDuplicate - الصف المراد نسخه
 */
function duplicateRow(rowToDuplicate) {
  // 1. أنشئ صفاً جديداً (سيصبح هو النشط)
  createNewRow();
  
  // 2. جلب الصف النشط الجديد (الفارغ)
  const newActiveRow = document.querySelector(".active-row");
  if (!newActiveRow) return;

  // 3. نسخ البيانات (ما عدا البيانات الخاصة بالإغلاق)
  newActiveRow.querySelector('[data-field="treasuryReserve"]').textContent = rowToDuplicate.querySelector('[data-field="treasuryReserve"]').textContent;
  newActiveRow.querySelector('[data-field="expense"]').textContent = rowToDuplicate.querySelector('[data-field="expense"]').textContent;
  newActiveRow.querySelector('[data-field="cash"]').textContent = rowToDuplicate.querySelector('[data-field="cash"]').textContent;
  newActiveRow.querySelector('[data-field="visa"]').textContent = rowToDuplicate.querySelector('[data-field="visa"]').textContent;
  newActiveRow.querySelector('[data-field="masterCard"]').textContent = rowToDuplicate.querySelector('[data-field="masterCard"]').textContent;
  newActiveRow.querySelector('[data-field="american"]').textContent = rowToDuplicate.querySelector('[data-field="american"]').textContent;
  newActiveRow.querySelector('[data-field="mada"]').textContent = rowToDuplicate.querySelector('[data-field="mada"]').textContent;
  newActiveRow.querySelector('[data-field="bankTransfer"]').textContent = rowToDuplicate.querySelector('[data-field="bankTransfer"]').textContent;
  // (ملاحظة: لا ننسخ الإيراد أو الملاحظات أو الانحراف)

  // 4. أعد حساب الصف الجديد
  recalculateRow(newActiveRow);
  
  showToast("تم استنساخ بيانات الصف بنجاح.", "info");
}


/**
 * دالة لإنشاء صف مغلق من البيانات المحفوظة
 */
function createRowFromData(entryData, index) {
  const tableBody = document.getElementById("mainTableBody");
  const newRow = document.createElement("tr");
  
  let varianceClass = "variance-neutral";
  if (entryData.variance > 0) varianceClass = "variance-positive";
  if (entryData.variance < 0) varianceClass = "variance-negative";

  newRow.className = "closed-row";
  
  // (تعديل) - إضافة مربع الاختيار
  newRow.innerHTML = `
    <td class="col-checkbox">
      <input type="checkbox" class="compare-checkbox" data-entry-index="${index - 1}" title="تحديد للمقارنة">
    </td>
    <td>${index}</td>
    <td data-field="treasuryReserve">${entryData.treasuryReserve}</td>
    <td data-field="expense">${entryData.expense}</td>
    <td>${entryData.username}</td>
    <td>${entryData.timestamp}</td>
    <td data-field="cash">${entryData.cash}</td>
    <td data-field="visa">${entryData.visa}</td>
    <td data-field="masterCard">${entryData.masterCard}</td>
    <td data-field="american">${entryData.american}</td>
    <td data-field="mada">${entryData.mada}</td>
    <td data-field="bankTransfer">${entryData.bankTransfer}</td>
    <td data-field="programRevenue">${entryData.programRevenue}</td>
    <td class="${varianceClass}" data-field="variance">${entryData.variance}</td>
    <td data-field="notes">${entryData.notes}</td>
    <td><span class="status-closed">مغلق نهائياً</span></td>
  `;

  tableBody.append(newRow);
}


/**
 * (تعديل) - دالة لمعالجة أي ضغطة زر داخل الجدول
 */
function handleTableClick(event) {
  const target = event.target;
  
  // --- 1. التعامل مع الأزرار ---
  if (target.dataset.action === "delete-row") {
    showConfirmModal("هل أنت متأكد من حذف هذا الصف؟ لا يمكن التراجع عن هذا الإجراء.", () => {
      const rowToDelete = target.closest("tr");
      if (rowToDelete) {
        rowToDelete.remove();
      }
    });
    return; 
  }

  // (جديد) - ربط زر التكرار
  if (target.dataset.action === "duplicate-row") {
    const rowToDuplicate = target.closest("tr");
    if (rowToDuplicate) {
      duplicateRow(rowToDuplicate);
    }
    return;
  }

  if (target.dataset.action === "undo-close") {
    const rowToUndo = target.closest("tr");
    if (rowToUndo) {
      undoClose(rowToUndo);
    }
    return; 
  }

  // --- 2. التعامل مع تحديد الصف ---
  // (تجاهل الضغط على مربع الاختيار)
  if (target.classList.contains('compare-checkbox')) {
    return;
  }
  
  const row = target.closest("tr");
  if (row && !row.classList.contains("active-row")) {
    
    const actionCellNew = row.cells[row.cells.length - 1];
    const hasDeleteButton = actionCellNew.querySelector('[data-action="delete-row"]');
    
    const currentActive = document.querySelector(".active-row");
    if (currentActive) {
      currentActive.classList.remove("active-row", "active-row-z", "active-row-p", "active-row-n");
      if (currentActive.cells[0].textContent !== "1") {
        const actionCellOld = currentActive.cells[currentActive.cells.length - 1];
        // (جديد) - إضافة زر التكرار
        actionCellOld.innerHTML = `
          <div class="action-cell-buttons">
            <button class="btn btn-danger btn-sm" data-action="delete-row">🗑️ حذف</button>
            <button class="btn btn-secondary btn-sm" data-action="duplicate-row">📄 تكرار</button>
          </div>
        `;
      }
    }
    
    row.classList.add("active-row", "active-row-z");
    recalculateRow(row); 

    if (hasDeleteButton) {
        actionCellNew.innerHTML = "<td>-</td>";
    }
  }
}


/**
 * المسح الذكي عند الدخول للخلية
 */
function handleTableFocusIn(event) {
  const cell = event.target;
  if (cell.isContentEditable) {
    activeCellOldValue = cell.textContent;
    if (cell.textContent === "0") {
      cell.textContent = "";
    }
  }
}

/**
 * إعادة التنسيق الذكي عند الخروج
 */
function handleTableFocusOut(event) {
  const cell = event.target;
  if (cell.isContentEditable) {
    if (cell.textContent.trim() === "") {
      cell.textContent = activeCellOldValue || "0";
    }

    const value = parseFloat(cell.textContent) || 0;
    cell.textContent = value.toString();

    if (cell.closest("#mainTableBody")) {
      recalculateRow(cell.closest("tr"));
    }
  }
  activeCellOldValue = null;
}

/**
 * (أرقام فقط) - للجدول وحاسبة الكاش
 */
function handleTableKeyDown(event) {
  const cell = event.target;
  const key = event.key;

  if (!cell.isContentEditable) return;

  const allowedKeys = [
    "Backspace",
    "Delete",
    "ArrowLeft",
    "ArrowRight",
    "Tab",
    "Enter",
  ];
  if (allowedKeys.includes(key)) {
    if (key === "Enter") event.preventDefault();
    return;
  }

  const arabicNumerals = "٠١٢٣٤٥٦٧٨٩";
  const englishNumerals = "0123456789";
  const arabicIndex = arabicNumerals.indexOf(key);
  if (arabicIndex > -1) {
    event.preventDefault();
    document.execCommand("insertText", false, englishNumerals[arabicIndex]);
    return;
  }

  if (key >= "0" && key <= "9") {
    return;
  }

  if (key === "." && !cell.textContent.includes(".")) {
    return;
  }

  event.preventDefault();
}

/**
 * دالة لمعالجة أي إدخال (كتابة) داخل الجدول الرئيسي
 */
function handleTableInput(event) {
  const cell = event.target;
  const row = cell.closest("tr");
  if (row) {
    recalculateRow(row);
  }
}

// دالة مساعدة لقراءة الأرقام من الصف (تُستخدم في دالتين)
function getRowNumbers(row) {
  const getNum = (field) => {
    const cell = row.querySelector(`[data-field="${field}"]`);
    return parseFloat(cell.textContent) || 0;
  };

  const expense = getNum("expense");
  const cash = getNum("cash");
  const visa = getNum("visa");
  const masterCard = getNum("masterCard");
  const american = getNum("american");
  const mada = getNum("mada");
  const bankTransfer = getNum("bankTransfer");
  const programRevenue = getNum("programRevenue");

  const totalNet = visa + masterCard + american + mada + bankTransfer;

  return { expense, cash, totalNet, programRevenue };
}

/**
 * دالة الحساب الرئيسية
 */
function recalculateRow(row) {
  if (!row) return;

  const { expense, cash, totalNet, programRevenue } = getRowNumbers(row);

  const actualTotal = cash + totalNet + expense;
  const variance = actualTotal - programRevenue;

  const varianceCell = row.querySelector('[data-field="variance"]');
  varianceCell.textContent = variance.toString();

  varianceCell.className = "";
  
  if (row.classList.contains("active-row")) {
    row.classList.remove("active-row-z", "active-row-p", "active-row-n");
    if (variance > 0) {
      row.classList.add("active-row-p"); 
    } else if (variance < 0) {
      row.classList.add("active-row-n"); 
    } else {
      row.classList.add("active-row-z"); 
    }
  }

  if (variance > 0) {
    varianceCell.classList.add("variance-positive");
  } else if (variance < 0) {
    varianceCell.classList.add("variance-negative");
  } else {
    //
  }

  updateVarianceMessage(variance, row); // (تعديل) - تمرير الصف
  
  // (إصلاح العطل الجوهري) - تأمين حالة الزر عند كل عملية حساب
  updateCloseButtonState(row); 
}

/**
 * (جديد) - كاشف الأخطاء الذكي
 * يتم استدعاؤه بواسطة updateVarianceMessage
 */
let errorToastTimer = null; // لمنع تكرار الرسائل
function detectSmartErrors(variance, row) {
  // إذا كان هناك مؤقت يعمل، لا ترسل رسالة جديدة
  if (errorToastTimer) return;

  if (variance > 0) {
    const cash = parseFloat(row.querySelector('[data-field="cash"]').textContent) || 0;
    if (cash === 0) {
      showToast("🤨 يوجد فائض، هل نسيت إدخال الكاش؟", "warning");
    }
  } else if (variance < 0) {
    const expense = parseFloat(row.querySelector('[data-field="expense"]').textContent) || 0;
    if (expense === 0) {
      showToast("😅 يوجد عجز، هل نسيت إدخال المصروف؟", "warning");
    }
  }
  
  // منع الرسائل المكررة لمدة 3 ثوان
  errorToastTimer = setTimeout(() => {
    errorToastTimer = null;
  }, 3000);
}


/**
 * (تعديل) - دالة لتحديث رسالة الانحراف الديناميكية
 */
function updateVarianceMessage(variance, row) { // (تعديل) - استقبال الصف
  const messageEl = document.getElementById("varianceMessage");
  if (!messageEl) return;

  messageEl.className = "variance-message"; 
  
  if (variance > 0) {
    messageEl.innerHTML = `🤨 يوجد فائض: ${variance.toFixed(2)}. الرجاء مراجعة الإيرادات والمدخلات.`;
    messageEl.classList.add("neutral"); 
    messageEl.style.display = "block";
  } else if (variance < 0) {
    messageEl.innerHTML = `😅 يوجد عجز: ${variance.toFixed(2)}. الرجاء مراجعة الإيراد والمصروفات.`;
    messageEl.classList.add("negative"); 
    messageEl.style.display = "block";
  } else {
    messageEl.innerHTML = `🏆 عمل رائع! الانحراف: 0.00. الصندوق متطابق 100%.`;
    messageEl.classList.add("positive"); 
    messageEl.style.display = "block";
  }
  
  // (جديد) - استدعاء كاشف الأخطاء
  detectSmartErrors(variance, row);
}