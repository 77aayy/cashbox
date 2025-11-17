require("dotenv").config();
const express = require("express");
const cors = require("cors");
const mongoose = require('mongoose'); // أضفنا Mongoose هنا

// --- تم حذف الاتصال القديم بقاعدة البيانات (db) ---
// const db = require("./config/db"); 

const app = express();

// جلب الرابط والسيرفر من متغيرات البيئة
const MONGO_URI = process.env.MONGO_URI;
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// مسار تسجيل الدخول وإنشاء الحساب
app.use("/api/auth", require("./routes/auth"));

app.get("/", (req, res) => {
  res.send("CashBox Secure Backend Running");
});

// --- تم حذف app.listen القديم من هنا ---

// --- كود الاتصال الجديد ---
// الاتصال بقاعدة البيانات أولاً
mongoose.connect(MONGO_URI)
  .then(() => {
    console.log('MongoDB Connected Successfully');
    
    // !! تشغيل السيرفر فقط بعد نجاح الاتصال !!
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
    
  })
  .catch((err) => {
    // التعامل مع خطأ فشل الاتصال
    console.error('Failed to connect to MongoDB', err);
    process.exit(1); // إغلاق التطبيق
  });