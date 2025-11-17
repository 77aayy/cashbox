// controllers/authController.js

require("dotenv").config();
//   !! استدعاء النموذج الصحيح !!
const User = require("../models/userModel"); // <-- تم التعديل ليطابق اسم ملفك
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

// --- تم حذف require("../config/db") ---

// تسجيل مستخدم جديد (نسخة Mongoose)
exports.register = async (req, res) => {
  const { username, password } = req.body;
  try {
    const existing = await User.findOne({ username: username });
    if (existing) return res.status(400).json({ message: "User already exists" });

    const hashed = await bcrypt.hash(password, 10);

    const newUser = new User({
      username: username,
      password: hashed,
    });
    await newUser.save();

    return res.json({ message: "User created successfully" });
  } catch (err) {
    return res.status(500).json({ message: "Server error", error: err.message });
  }
};

// تسجيل الدخول (نسخة Mongoose)
exports.login = async (req, res) => {
  const { username, password } = req.body;
  try {
    const user = await User.findOne({ username: username });
    if (!user) return res.status(400).json({ message: "Invalid credentials" });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(400).json({ message: "Invalid credentials" });

    const token = jwt.sign({ id: user._id, username: user.username }, process.env.JWT_SECRET, { expiresIn: "1d" });

    return res.json({ token });
  } catch (err) {
    return res.status(500).json({ message: "Server error", error: err.message });
  }
};