const Database = require("better-sqlite3");
const db = new Database("cashbox.db");

// جدول المستخدمين
db.prepare(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    password TEXT
  )
`).run();

// جدول التقفيلات
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
