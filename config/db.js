const sqlite3 = require("sqlite3").verbose();
const path = require("path");

// تحديد المسار الصحيح للقاعدة
const dbPath = process.env.DB_PATH || path.join(__dirname, "..", "cashbox.db");

// إنشاء اتصال
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error("DB Error:", err.message);
  } else {
    console.log("SQLite DB Connected:", dbPath);
  }
});

// إنشاء جدول المستخدمين لو غير موجود
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE,
      password TEXT
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS cashbox (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT,
      items TEXT,
      totals TEXT,
      userId INTEGER
    )
  `);
});

module.exports = db;
