// controllers/boxController.js

const Box = require('../models/Box'); // استدعاء نموذج الصندوق
const User = require('../models/userModel'); // نموذج المستخدم (لإيجاد المالك)

// دالة إنشاء صندوق جديد
exports.createBox = async (req, res) => {
    // نفترض أن اسم الصندوق (name) هو الحقل الوحيد الذي يأتي من الـ body
    const { name } = req.body;
    
    // !!! هام: Owner ID (سنفترض وجوده لتشغيل الاختبار)
    // في الوضع الحقيقي، سيأتي الـ ID من التوكن (JWT)
    const tempOwnerId = "60c841a0e1b12b0015b3c3b0"; // مثال ID صالح لـ MongoDB

    if (!name) {
        return res.status(400).json({ message: "Box name is required." });
    }

    try {
        // إنشاء الصندوق الجديد
        const newBox = new Box({
            name,
            owner: tempOwnerId // استخدام الـ ID الافتراضي
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