// models/Transaction.js

const mongoose = require('mongoose');

const TransactionSchema = new mongoose.Schema({
  // ربط المعاملة بالصندوق الذي حدثت فيه
  box: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Box', 
    required: true 
  },

  // المبلغ
  amount: {
    type: Number,
    required: true
  },

  // نوع الحركة: 'deposit' (إيداع/بيع) أو 'withdrawal' (سحب/شراء)
  type: {
    type: String,
    enum: ['deposit', 'withdrawal'],
    required: true
  },
  
  // سبب المعاملة
  description: {
    type: String,
    trim: true,
    default: 'No description'
  },

  // تاريخ ووقت المعاملة
  createdAt: { 
    type: Date, 
    default: Date.now 
  }
});

module.exports = mongoose.model('Transaction', TransactionSchema);