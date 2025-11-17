// controllers/authController.js
require("dotenv").config();
const User = require("../models/userModel");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

exports.register = async (req, res) => {
  // ===========================================
  //  🔥 السطر الجديد (للتأكد من المشكلة)
  console.log("Received body:", req.body); 
  // ===========================================

  const { username, password } = req.body;
  try {
    // هذا الكود سيعمل الآن لأننا سنتأكد من الـ body
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
    // سنرى الخطأ الحقيقي في السجلات (Logs)
    console.error("Error during registration:", err.message); 
    return res.status(500).json({ message: "Server error", error: err.message });
  }
};

// (باقي الكود... يبقى كما هو)
exports.login = async (req, res) => {
  console.log("Received body for login:", req.body); // <-- أضفنا هنا أيضاً
  const { username, password } = req.body;
  try {
    const user = await User.findOne({ username: username });
    if (!user) return res.status(400).json({ message: "Invalid credentials" });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(400).json({ message: "Invalid credentials" });

    const token = jwt.sign({ id: user._id, username: user.username }, process.env.JWT_SECRET, { expiresIn: "1d" });
    return res.json({ token });
  } catch (err) {
    console.error("Error during login:", err.message);
    return res.status(500).json({ message: "Server error", error: err.message });
  }
};