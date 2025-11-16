/**
 * (جديد) - دالة لنقل إجمالي حاسبة الكاش إلى الصف النشط
 */
function applyCashTotalToRow() {
  // 1. إيجاد الصف النشط
  const activeRow = document.querySelector(".active-row");
  if (!activeRow) {
    showToast("لا يوجد صف نشط لنقل الإجمالي إليه.", "warning");
    return;
  }
  
  // 2. إيجاد خلية "كاش" داخل هذا الصف
  const cashCell = activeRow.querySelector('[data-field="cash"]');
  if (!cashCell) {
    showToast("خطأ: لم يتم العثور على خانة الكاش.", "warning");
    return;
  }

  // 3. جلب الإجمالي من حاسبة الكاش
  const total = document.getElementById("cashCalcTotal").textContent;
  
  // 4. وضع القيمة في الخلية
  cashCell.textContent = total;
  
  // 5. (مهم جداً) - إعادة حساب الصف
  recalculateRow(activeRow);
  
  // 6. إعطاء رسالة تأكيد
  showToast(`تم نقل مبلغ ${total} إلى خانة الكاش.`, "info");
}


// --- دوال حاسبة الكاش (تبقى كما هي) ---
/**
 * دالة لحساب مجموع حاسبة الكاش
 */
function handleCashCalcInput(event) {
  const cell = event.target;
  const row = cell.closest("tr");
  const denom = parseFloat(cell.dataset.denom);
  const count = parseFloat(cell.textContent) || 0;

  const totalCell = row.querySelector(`[data-total]`);
  const total = denom * count;
  totalCell.textContent = total.toString();

  let grandTotal = 0;
  document.querySelectorAll("#cashCalcTable [data-total]").forEach((td) => {
    grandTotal += parseFloat(td.textContent) || 0;
  });
  document.getElementById("cashCalcTotal").textContent = grandTotal.toString();
}

/**
 * دالة لتصفير حاسبة الكاش
 */
function handleClearCashCalc() {
  document
    .querySelectorAll("#cashCalcTable td[contenteditable]")
    .forEach((cell) => {
      cell.textContent = "";
    });
  document.querySelectorAll("#cashCalcTable td[data-total]").forEach((cell) => {
    cell.textContent = "0";
  });
  document.getElementById("cashCalcTotal").textContent = "0";
}


// --- (منطق الآلة الحاسبة المحدث) ---

// متغيرات الحالة الجديدة للآلة الحاسبة
let currentOperand = "0";
let previousOperand = "";
let operation = undefined;
let shouldResetDisplay = false;
let readyToReceiveNextOperand = false; 

// --- 1. الدوال الأساسية الجديدة ---

/**
 * دالة مسح الآلة الحاسبة (C)
 */
function clearCalc() {
  currentOperand = "0";
  previousOperand = "";
  operation = undefined;
  shouldResetDisplay = false;
  readyToReceiveNextOperand = false; 
  updateCalcDisplay();
  document.getElementById("calcHistory").innerHTML = "";
}

/**
 * دالة الحذف (Backspace)
 */
function deleteDigit() {
  if (shouldResetDisplay) clearCalc();
  if (currentOperand === "0") return;
  
  currentOperand = currentOperand.toString().slice(0, -1);
  if (currentOperand === "") {
    currentOperand = "0";
  }
  updateCalcDisplay();
}

/**
 * إضافة رقم أو نقطة
 */
function appendNumber(number) {
  if (number === "." && currentOperand.includes(".")) return;
  
  if (readyToReceiveNextOperand) {
      currentOperand = number;
      readyToReceiveNextOperand = false;
  } else if (shouldResetDisplay) { 
      currentOperand = number;
      shouldResetDisplay = false;
  } else {
      currentOperand = currentOperand === "0" ? number : currentOperand + number;
  }
  
  updateCalcDisplay();
}

/**
 * اختيار عملية (+, -, *, /)
 */
function chooseOperation(op) {
  if (currentOperand === "0" && op === "-") {
      currentOperand = "-";
      updateCalcDisplay();
      return;
  }
  
  if (currentOperand === "0" && previousOperand === "") return;

  if (previousOperand !== "") {
    compute();
  }

  operation = op;
  previousOperand = currentOperand;
  readyToReceiveNextOperand = true; 
  shouldResetDisplay = false;
  updateCalcDisplay(); 
}

/**
 * حساب النسبة المئوية
 */
function calculatePercentage() {
    if (currentOperand === "0") return;
    const value = parseFloat(currentOperand);
    currentOperand = (value / 100).toString();
    updateCalcDisplay();
}


/**
 * تنفيذ الحساب (=)
 */
function compute() {
  let computation;
  const prev = parseFloat(previousOperand);
  const current = parseFloat(currentOperand);

  if (isNaN(prev) || isNaN(current) || !operation) return;

  switch (operation) {
    case "+": computation = prev + current; break;
    case "-": computation = prev - current; break;
    case "*": computation = prev * current; break;
    case "÷": computation = prev / current; break;
    default: return;
  }

  const history = document.getElementById("calcHistory");
  const historyEntry = document.createElement("div");
  historyEntry.textContent = `${formatNumber(prev)} ${operation} ${formatNumber(current)} = ${formatNumber(computation)}`;
  history.prepend(historyEntry);

  currentOperand = computation.toString();
  operation = undefined;
  previousOperand = "";
  shouldResetDisplay = true; 
  readyToReceiveNextOperand = false; 
  updateCalcDisplay();
}

/**
 * دالة تحديث الشاشتين
 */
function updateCalcDisplay() {
  const display = document.getElementById("calcDisplay");
  const expression = document.getElementById("calcExpression");

  display.value = formatNumber(currentOperand);
  
  if (operation != null) {
    expression.textContent = `${formatNumber(previousOperand)} ${operation}`;
  } else if (shouldResetDisplay && currentOperand !== "0") {
      const history = document.getElementById("calcHistory");
      if(history.firstChild) {
          expression.textContent = history.firstChild.textContent.split('=')[0] + '=';
      }
  } else {
    expression.textContent = "";
  }
}

/**
 * دالة مساعدة لتنسيق الأرقام
 */
function formatNumber(numberStr) {
    if (numberStr.toString().endsWith(".")) return numberStr;
    if (numberStr.toString() === "-") return "-";
    
    const floatNum = parseFloat(numberStr);
    if (isNaN(floatNum)) return "0";
    
    if (numberStr.toString().includes(".")) {
        const parts = numberStr.toString().split('.');
        parts[0] = parseFloat(parts[0]).toLocaleString('en-US');
        return parts.join('.');
    }

    return floatNum.toLocaleString('en-US');
}


// --- 2. ربط الدوال بالأحداث (الأزرار والكيبورد) ---

/**
 * دالة الضغط على الأزرار
 */
function handleCalcClick(event) {
  const key = event.target.dataset.key;
  if (!key) return;

  if (key >= "0" && key <= "9") appendNumber(key);
  if (key === ".") appendNumber(key);
  if (key === "=") compute();
  if (key === "clear") clearCalc();
  if (key === "backspace") deleteDigit();
  if (key === "%") calculatePercentage();
  if (key === "+" || key === "-" || key === "*" || key === "/") {
      const operationSymbol = key === "/" ? "÷" : key;
      chooseOperation(operationSymbol);
  }
}

/**
 * دالة التحكم بالكيبورد
 */
function handleCalcDisplayKeyDown(event) {
  const key = event.key;

  if (key >= "0" && key <= "9") appendNumber(key);
  if (key === ".") appendNumber(key);
  if (key === "Enter" || key === "=") {
      event.preventDefault();
      compute();
  }
  if (key === "Backspace") deleteDigit();
  if (key === "Delete" || key === "c" || key === "C") clearCalc();
  if (key === "%") calculatePercentage();
  if (key === "+" || key === "-" || key === "*" || key === "/") {
      event.preventDefault();
      const operationSymbol = key === "/" ? "÷" : key;
      chooseOperation(operationSymbol);
  }
  
  const arabicNumerals = "٠١٢٣٤٥٦٧٨٩";
  const englishNumerals = "0123456789";
  const arabicIndex = arabicNumerals.indexOf(key);
  if (arabicIndex > -1) {
    event.preventDefault();
    appendNumber(englishNumerals[arabicIndex]);
  }
}

/**
 * دالة لمزامنة الشاشة مع الذاكرة
 */
function handleCalcDisplayInput(event) {
    updateCalcDisplay();
}

/**
 * مسح "0" عند الضغط على شاشة الآلة الحاسبة
 */
function handleCalcDisplayFocusIn(event) {
  const display = event.target;
  display.select(); 
}