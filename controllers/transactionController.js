// controllers/transactionController.js

const Box = require('../models/Box'); 
const Transaction = require('../models/Transaction'); 

// دالة تسجيل معاملة جديدة
exports.recordTransaction = async (req, res) => {
    const { boxId, amount, type, description } = req.body; 
    
    // التحقق من وجود البيانات الأساسية
    if (!boxId || !amount || !type) {
        return res.status(400).json({ message: "Missing required fields (boxId, amount, type)." });
    }
    
    // التحقق من نوع المعاملة (الآن يجب أن يكون 'deposit' فقط)
    if (type !== 'deposit') {
         return res.status(400).json({ message: "Invalid transaction type. Must be 'deposit'." });
    }

    try {
        // 1. البحث عن الصندوق المستهدف
        const box = await Box.findById(boxId);
        if (!box) {
            return res.status(404).json({ message: "Box not found." });
        }

        // 2. حساب الرصيد الجديد (يركز على الإضافة فقط)
        let newBalance = box.balance;
        newBalance += amount; // نقوم دائماً بالإضافة (deposit)

        // 3. حفظ سجل المعاملة أولاً
        const newTransaction = new Transaction({
            box: boxId,
            amount,
            type,
            description: description || 'Record transaction'
        });
        const savedTransaction = await newTransaction.save();
        
        // 4. تحديث رصيد الصندوق وحفظه
        box.balance = newBalance;
        await box.save();

        return res.status(201).json({ 
            message: "Transaction recorded successfully.", 
            transaction: savedTransaction,
            newBalance: newBalance
        });

    } catch (error) {
        return res.status(500).json({ 
            message: "Failed to record transaction.", 
            error: error.message 
        });
    }
};

// دالة جلب سجل المعاملات لصندوق محدد (جديد)
exports.getTransactions = async (req, res) => {
    try {
        const boxId = req.params.boxId; // الـ ID سيأتي من رابط الـ URL
        const ownerId = req.user.id; // الـ ID سيأتي من الـ Middleware (التوكن)

        // 1. التحقق من أن الصندوق موجود وينتمي إلى المستخدم (حماية)
        const box = await Box.findOne({ _id: boxId, owner: ownerId });
        if (!box) {
            return res.status(404).json({ message: "Box not found or unauthorized access." });
        }

        // 2. جلب جميع المعاملات المرتبطة بهذا الصندوق
        const transactions = await Transaction.find({ box: boxId })
            .sort({ createdAt: -1 }) // الترتيب من الأحدث للأقدم
            .select('-__v'); 

        return res.status(200).json({ 
            boxBalance: box.balance,
            count: transactions.length, 
            transactions 
        });

    } catch (error) {
        return res.status(500).json({ 
            message: "Failed to retrieve transaction history.", 
            error: error.message 
        });
    }
};