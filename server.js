require("dotenv").config();
const express = require("express");
const cors = require("cors");
const db = require("./config/db");

const app = express();

app.use(cors());
app.use(express.json());

// مسار تسجيل الدخول وإنشاء الحساب
app.use("/api/auth", require("./routes/auth"));

app.get("/", (req, res) => {
  res.send("CashBox Secure Backend Running");
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log("Server running on port " + PORT));
