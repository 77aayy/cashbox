function printData(mode) {
    const title = mode === 'last' ? 'طباعة آخر تقفيلة' : 'طباعة سجل التقفيلات';
    
    // جمع البيانات
    let rowsToPrint = [];
    if (mode === 'last') {
        // البحث عن آخر صف مغلق (هو الذي تحت الصف النشط مباشرة)
        const closedRows = document.querySelectorAll("tr.closed-row");
        if(closedRows.length > 0) rowsToPrint.push(closedRows[0]); // أول صف مغلق هو الأحدث
    } else {
        rowsToPrint = document.querySelectorAll("tr.closed-row");
    }

    if (rowsToPrint.length === 0) {
        showToast("لا توجد بيانات مغلقة للطباعة", "warning");
        return;
    }

    // إنشاء نافذة الطباعة
    const printWindow = window.open('', '', 'width=900,height=600');
    
    let tableHTML = `
        <table border="1" style="width:100%; border-collapse:collapse; text-align:center; direction:rtl;">
            <thead style="background:#eee;">
                <tr>
                    <th>الموظف</th>
                    <th>التوقيت</th>
                    <th>الكاش</th>
                    <th>الشبكة</th>
                    <th>الإيراد</th>
                    <th>الانحراف</th>
                    <th>الملاحظات</th>
                </tr>
            </thead>
            <tbody>
    `;

    rowsToPrint.forEach(row => {
        const getVal = (sel) => row.querySelector(`[data-field="${sel}"]`).textContent;
        
        // حساب الشبكة
        const net = parseFloat(getVal("visa")) + parseFloat(getVal("masterCard")) + 
                    parseFloat(getVal("american")) + parseFloat(getVal("mada")) + 
                    parseFloat(getVal("bankTransfer"));

        tableHTML += `
            <tr>
                <td>${row.cells[4].textContent}</td>
                <td>${row.cells[5].textContent}</td>
                <td>${getVal("cash")}</td>
                <td>${net}</td>
                <td>${getVal("programRevenue")}</td>
                <td>${getVal("variance")}</td>
                <td>${getVal("notes")}</td>
            </tr>
        `;
    });

    tableHTML += `</tbody></table>`;

    printWindow.document.write(`
        <html dir="rtl">
        <head><title>${title}</title></head>
        <body style="font-family: 'Cairo', sans-serif; padding: 20px;">
            <h2 style="text-align:center;">${title}</h2>
            <p>تاريخ الطباعة: ${new Date().toLocaleString()}</p>
            <hr/>
            ${tableHTML}
            <script>window.print(); window.close();</script>
        </body>
        </html>
    `);
    printWindow.document.close();
}

// ربط الأزرار
document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("printLastBtn")?.addEventListener("click", () => printData('last'));
    document.getElementById("printAllBtn")?.addEventListener("click", () => printData('all'));
});