const Database = require("better-sqlite3");
const path = require("path");

// ===============================
//  🔥 المسار السليم للـ SQLite على Render
// ===============================
// Render يسمح بالتخزين الدائم فقط داخل /var/data
const dbPath = process.env.DB_PATH || "/var/data/cashbox.db";

console.log("🟢 Using SQLite DB at:", dbPath);

// إنشاء الاتصال
let db;
try {
  db = new Database(dbPath);
  console.log("🟢 SQLite Connected Successfully");
} catch (err) {
  console.error("🔴 SQLite Connection Error:", err.message);
  process.exit(1);
}

// ===============================
//  إنشاء الجداول إذا لم تكن موجودة
// ===============================
db.prepare(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    password TEXT
  )
`).run();

module.exports = db;
