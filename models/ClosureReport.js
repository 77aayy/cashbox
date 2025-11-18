// models/ClosureReport.js
const mongoose = require('mongoose');

const ClosureSchema = new mongoose.Schema({
    // بيانات التقرير المالي (التي نحتاجها من الجدول)
    dayName: { type: String, required: true },
    employeeName: { type: String, required: true },
    closeTime: { type: String, required: true },
    
    // الأرقام المدخلة
    treasuryReserve: { type: Number, default: 0 },
    purchaseInvoices: { type: Number, default: 0 },
    temporarySuspensions: { type: Number, default: 0 },
    actualCash: { type: Number, default: 0 },
    network: { type: Number, default: 0 },
    bankTransfer: { type: Number, default: 0 },
    programRevenue: { type: Number, default: 0 },
    
    // النتيجة
    variance: { type: Number, default: 0 },
    notes: { type: String, default: "" },

    // تاريخ الإنشاء (للتأكد من الترتيب في القاعدة)
    createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('ClosureReport', ClosureSchema);