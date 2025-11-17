// routes/box.js

const express = require('express');
const router = express.Router();
const boxController = require('../controllers/boxController'); // استدعاء الـ Controller

// POST /api/box - مسار إنشاء صندوق جديد
router.post('/', boxController.createBox);

module.exports = router;