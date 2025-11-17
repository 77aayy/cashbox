// routes/box.js

const express = require('express');
const router = express.Router();
const boxController = require('../controllers/boxController'); // استدعاء الـ Controller
const auth = require('../middleware/auth'); // استدعاء الـ Middleware للحماية

// POST /api/box - مسار إنشاء صندوق جديد (محمي الآن)
// يتم تطبيق الـ auth أولاً للتحقق من التوكن قبل إنشاء الصندوق
router.post('/', auth, boxController.createBox);

// GET /api/box - مسار جلب جميع الصناديق الخاصة بالمستخدم (محمي)
router.get('/', auth, boxController.getAllBoxes);


module.exports = router;