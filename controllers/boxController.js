// controllers/boxController.js

const Box = require('../models/Box'); // استدعاء نموذج الصندوق
const User = require('../models/userModel'); // نموذج المستخدم (لإيجاد المالك)
const mongoose = require('mongoose'); // لإصلاح خطأ Box not found


// دالة إنشاء صندوق جديد
exports.createBox = async (req, res) => {
    // نفترض أن اسم الصندوق (name) هو الحقل الوحيد الذي يأتي من الـ body
    const { name } = req.body;
    
    // 🔥 هام: الـ ID يأتي الآن من الـ Middleware (التوكن JWT)
    const ownerId = req.user.id; 

    if (!name) {
        return res.status(400).json({ message: "Box name is required." });
    }

    try {
        // إنشاء الصندوق الجديد
        const newBox = new Box({
            name,
            owner: ownerId // استخدام الـ ID الحقيقي من التوكن
        });

        const savedBox = await newBox.save();

        return res.status(201).json({ 
            message: "Box created successfully.", 
            box: savedBox 
        });

    } catch (error) {
        // إذا كان هناك خطأ في الاتصال أو التحقق من الصحة (Validation)
        return res.status(500).json({ 
            message: "Failed to create box.", 
            error: error.message 
        });
    }
};


// دالة جلب جميع الصناديق الخاصة بالمستخدم (الميزة الجديدة)
exports.getAllBoxes = async (req, res) => {
    try {
        // نستخدم req.user.id الذي أضافه الـ Middleware للبحث عن الصناديق المملوكة للمستخدم
        const boxes = await Box.find({ owner: req.user.id }).select('-__v'); 

        return res.status(200).json({ 
            count: boxes.length, 
            boxes 
        });

    } catch (error) {
        return res.status(500).json({ 
            message: "Failed to retrieve boxes.", 
            error: error.message 
        });
    }
};