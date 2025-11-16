require("dotenv").config(); // تحميل ملف .env أول شيء في التطبيق

const express = require("express");
const app = express();
const db = require("./config/database");

// --- (الإضافة الجديدة) ---
// 1. استدعاء مكتبة cors
const cors = require("cors");
// 2. السماح لجميع الاتصالات (Cross-Origin Resource Sharing)
app.use(cors());
// ---------------------

app.use(express.json());

// ربط مسارات auth
app.use("/api/auth", require("./routes/auth"));

app.get("/", (req, res) => {
  res.send("CashBox Secure Backend Running");
});

app.listen(5000, () => {
  console.log("Server running on port 5000");
});