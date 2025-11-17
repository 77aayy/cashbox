// controllers/transactionController.js

const Box = require('../models/Box'); // نموذج الصندوق
const Transaction = require('../models/Transaction'); // نموذج المعاملات

// دالة تسجيل معاملة جديدة
exports.recordTransaction = async (req, res) => {
    // نتوقع boxId, amount, type, description في الـ body
    const { boxId, amount, type, description } = req.body; 
    
    // تحقق أولي من وجود البيانات الأساسية
    if (!boxId || !amount || !type) {
        return res.status(400).json({ message: "Missing required fields (boxId, amount, type)." });
    }
    
    // التحقق من نوع المعاملة
    if (type !== 'deposit' && type !== 'withdrawal') {
         return res.status(400).json({ message: "Invalid transaction type. Must be 'deposit' or 'withdrawal'." });
    }

    try {
        // 1. البحث عن الصندوق المستهدف
        const box = await Box.findById(boxId);
        if (!box) {
            return res.status(404).json({ message: "Box not found." });
        }

        // 2. حساب الرصيد الجديد والتحقق من السحب
        let newBalance = box.balance;
        
        if (type === 'deposit') {
            // إضافة المبلغ
            newBalance += amount;
        } else if (type === 'withdrawal') {
            // التحقق من وجود رصيد كافٍ قبل السحب
            if (box.balance < amount) {
                return res.status(400).json({ message: "Insufficient funds for withdrawal." });
            }
            // سحب المبلغ
            newBalance -= amount;
        }

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
        // خطأ عام (في الاتصال أو المونجوز)
        return res.status(500).json({ 
            message: "Failed to record transaction.", 
            error: error.message 
        });
    }
};