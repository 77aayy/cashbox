// routes/transaction.js

const express = require('express');
const router = express.Router();
const transactionController = require('../controllers/transactionController'); // استدعاء الـ Controller

// POST /api/transaction - مسار تسجيل معاملة جديدة
router.post('/', transactionController.recordTransaction);

module.exports = router;