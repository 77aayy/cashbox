// routes/transaction.js

const express = require('express');
const router = express.Router();
const transactionController = require('../controllers/transactionController'); 
const auth = require('../middleware/auth'); // استدعاء الـ Middleware للحماية

// POST /api/transaction - مسار تسجيل معاملة جديدة (محمي)
router.post('/', auth, transactionController.recordTransaction);

// GET /api/transaction/:boxId - مسار جلب سجل المعاملات لصندوق محدد (محمي)
// نستخدم :boxId كـ parameter في الرابط
router.get('/:boxId', auth, transactionController.getTransactions);

module.exports = router;