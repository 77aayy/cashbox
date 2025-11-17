// models/Box.js

const mongoose = require('mongoose');

const BoxSchema = new mongoose.Schema({
  // اسم الصندوق، مطلوب
  name: { 
    type: String, 
    required: true 
  },
  
  // الرصيد الحالي للصندوق (الافتراضي صفر)
  balance: { 
    type: Number, 
    default: 0 
  },
  
  // ربط الصندوق بالمستخدم الذي يملكه (ربط مع نموذج User)
  owner: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  
  // تاريخ إنشاء الصندوق
  createdAt: { 
    type: Date, 
    default: Date.now 
  }
});

module.exports = mongoose.model('Box', BoxSchema);