const Database = require("better-sqlite3");

// تحديد مسار قاعدة البيانات
const dbPath = process.env.DB_PATH || "./cashbox.db";

// فتح قاعدة البيانات
const db = new Database(dbPath);

// إنشاء جدول المستخدمين
db.prepare(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    password TEXT
  )
`).run();

// إنشاء جدول التقفيلات
db.prepare(`
  CREATE TABLE IF NOT EXISTS cashbox (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT,
    items TEXT,
    totals TEXT,
    userId INTEGER
  )
`).run();

module.exports = db;
