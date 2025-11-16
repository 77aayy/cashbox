/**
 * دالة لمعالجة طلب الطباعة
 */
function printReport(isPrintingAll = false) {
  const body = document.body;

  body.classList.remove("printing-mode", "print-last-only");
  document.querySelectorAll(".print-target").forEach(el => el.classList.remove("print-target"));

  if (isPrintingAll) {
    const rowsToPrint = document.querySelectorAll("tr.closed-row");
    if (rowsToPrint.length === 0) {
      showToast("لا توجد تقفيلات مكتملة (نهائية) لطباعتها.", "warning");
      return;
    }
    body.classList.add("printing-mode");

  } else {
    // (تعديل) - البحث عن آخر صف مغلق (ليس قيد الانتظار)
    const closedRows = document.querySelectorAll("tr.closed-row");
    const lastClosedRow = closedRows[closedRows.length - 1]; // جلب الأخير فعلياً
    
    if (!lastClosedRow) {
      const pendingRow = document.querySelector("tr.undo-pending");
      if (pendingRow) {
        showToast("لا يمكن الطباعة الآن، التقفيلة الأخيرة قيد المراجعة (30 ثانية).", "warning");
      } else {
        showToast("لا يوجد تقفيلة أخيرة (نهائية) لطباعتها.", "warning");
      }
      return;
    }
    
    body.classList.add("printing-mode");
    body.classList.add("print-last-only");
    lastClosedRow.classList.add("print-target"); 
  }

  window.print();

  setTimeout(() => {
      body.classList.remove("printing-mode", "print-last-only");
      document.querySelectorAll(".print-target").forEach(el => el.classList.remove("print-target"));
  }, 1000);
}

/**
 * (تعديل) - دالة لإظهار مقارنة للتقفيلات المحددة
 */
function showClosureComparison() {
  // 1. جلب مربعات الاختيار المحددة
  const selectedCheckboxes = document.querySelectorAll(".compare-checkbox:checked");

  // 2. التحقق من العدد (يجب أن يكون 2 فقط)
  if (selectedCheckboxes.length !== 2) {
    showToast("الرجاء تحديد تقفيلتين (2) فقط للمقارنة.", "warning");
    return;
  }

  // 3. جلب جميع البيانات المحفوظة (الخاصة بالمستخدم)
  const currentUser = localStorage.getItem("lastUser");
  if (!currentUser) {
    showToast("خطأ: المستخدم غير معروف.", "warning");
    return;
  }
  const allEntries = JSON.parse(localStorage.getItem(currentUser + "_closedEntries")) || [];
  if (allEntries.length === 0) {
    showToast("خطأ: لم يتم العثور على سجلات محفوظة.", "warning");
    return;
  }

  // 4. تحديد التقفيلتين (الأقدم هو "السابق" والأحدث هو "الأخير" بناءً على الفهرس)
  const index1 = parseInt(selectedCheckboxes[0].dataset.entryIndex, 10);
  const index2 = parseInt(selectedCheckboxes[1].dataset.entryIndex, 10);

  const prevEntry = allEntries[Math.min(index1, index2)];
  const lastEntry = allEntries[Math.max(index1, index2)];

  if (!prevEntry || !lastEntry) {
      showToast("خطأ في قراءة بيانات التقفيلات.", "warning");
      return;
  }

  // 5. دالة مساعدة لحساب الفرق وتلوينه
  const getDiff = (key) => {
    const last = parseFloat(lastEntry[key]) || 0;
    const prev = parseFloat(prevEntry[key]) || 0;
    const diff = last - prev;

    let diffClass = "";
    if (diff > 0) diffClass = "variance-positive";
    if (diff < 0) diffClass = "variance-negative";
    
    return {
      last: last.toFixed(2),
      prev: prev.toFixed(2),
      diff: diff.toFixed(2),
      diffClass: diffClass
    };
  };

  // 6. حساب الفروقات للبيانات الرئيسية
  const revenue = getDiff("programRevenue");
  const cash = getDiff("cash");
  const expense = getDiff("expense");
  const variance = getDiff("variance");
  
  // حساب إجمالي الشبكة يدوياً
  const lastNet = (parseFloat(lastEntry.visa) || 0) + (parseFloat(lastEntry.masterCard) || 0) + (parseFloat(lastEntry.american) || 0) + (parseFloat(lastEntry.mada) || 0) + (parseFloat(lastEntry.bankTransfer) || 0);
  const prevNet = (parseFloat(prevEntry.visa) || 0) + (parseFloat(prevEntry.masterCard) || 0) + (parseFloat(prevEntry.american) || 0) + (parseFloat(prevEntry.mada) || 0) + (parseFloat(prevEntry.bankTransfer) || 0);
  const netDiff = lastNet - prevNet;
  let netDiffClass = "";
  if (netDiff > 0) netDiffClass = "variance-positive";
  if (netDiff < 0) netDiffClass = "variance-negative";


  // 7. بناء جدول HTML
  const htmlContent = `
    <table class="comparison-table">
      <thead>
        <tr>
          <th>البند</th>
          <th>التقفيلة الأقدم</th>
          <th>التقفيلة الأحدث</th>
          <th>الفرق</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><strong>الإيراد (البرنامج)</strong></td>
          <td>${revenue.prev}</td>
          <td>${revenue.last}</td>
          <td class="${revenue.diffClass}">${revenue.diff}</td>
        </tr>
        <tr>
          <td><strong>الكاش</strong></td>
          <td>${cash.prev}</td>
          <td>${cash.last}</td>
          <td class="${cash.diffClass}">${cash.diff}</td>
        </tr>
        <tr>
          <td><strong>إجمالي الشبكة</strong></td>
          <td>${prevNet.toFixed(2)}</td>
          <td>${lastNet.toFixed(2)}</td>
          <td class="${netDiffClass}">${netDiff.toFixed(2)}</td>
        </tr>
        <tr>
          <td><strong>المصروف</strong></td>
          <td>${expense.prev}</td>
          <td>${expense.last}</td>
          <td class="${expense.diffClass}">${expense.diff}</td>
        </tr>
        <tr>
          <td><strong>الانحراف</strong></td>
          <td>${variance.prev}</td>
          <td>${variance.last}</td>
          <td class="${variance.diffClass}">${variance.diff}</td>
        </tr>
      </tbody>
    </table>
    <div class="comparison-info">
      <p><strong>الأحدث:</strong> ${lastEntry.username} (${lastEntry.timestamp})</p>
      <p><strong>الأقدم:</strong> ${prevEntry.username} (${prevEntry.timestamp})</p>
    </div>
  `;

  // 8. إظهار النافذة (بعنوان جديد)
  showInfoModal("مقارنة التقفيلات المحددة", htmlContent);
}