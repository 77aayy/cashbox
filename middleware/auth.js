// middleware/auth.js

const jwt = require('jsonwebtoken');

module.exports = (req, res, next) => {
    // 1. محاولة استخراج التوكن من الهيدر (Authorization)
    const token = req.header('x-auth-token') || req.header('Authorization')?.replace('Bearer ', '');

    // 2. التحقق من وجود التوكن
    if (!token) {
        return res.status(401).json({ message: 'No token, authorization denied.' });
    }

    try {
        // 3. التحقق من صحة التوكن وفك تشفيره
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        // 4. إضافة بيانات المستخدم (ID) إلى الطلب
        req.user = decoded; 
        next(); // الاستمرار في تنفيذ المسار (Route) التالي

    } catch (e) {
        // إذا كان التوكن غير صالح أو منتهي الصلاحية
        res.status(401).json({ message: 'Token is not valid.' });
    }
};