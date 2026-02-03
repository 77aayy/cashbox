const XLSX = require('xlsx');
const path = require('path');

const filePath = path.join(__dirname, 'BankTransactions_Ar (2).xlsx');
const wb = XLSX.readFile(filePath);
const sheet = wb.Sheets['BankTransactions_Ar'];
const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

// Row 18 in 0-based = row 19 in Excel = header with المستخدم, الوقت/التاريخ, مدى, المبلغ, الإتجاه
const headerRow = data[18];
console.log('Row 19 (header) - non-empty with index:');
headerRow.forEach((c, i) => {
  const v = (c || '').toString().trim();
  if (v) console.log('  col', i, ':', v);
});

console.log('\nFirst 5 data rows (row 20-24), key columns:');
for (let r = 19; r < Math.min(24, data.length); r++) {
  const row = data[r];
  const dateStr = (row[5] || '').toString().trim();
  const method = (row[10] || row[11] || '').toString().trim();
  const amount = (row[22] || row[23] || row[24] || '').toString().trim();
  const direction = (row[27] || row[30] || '').toString().trim();
  console.log('  Row', r, '| date:', dateStr, '| method:', method, '| amount:', amount, '| dir:', direction);
}

// All unique non-empty values in col 10 and 11
const m10 = new Set(), m11 = new Set();
for (let r = 19; r < data.length; r++) {
  const v10 = (data[r][10] || '').toString().trim();
  const v11 = (data[r][11] || '').toString().trim();
  if (v10) m10.add(v10);
  if (v11) m11.add(v11);
}
console.log('\nUnique col 10:', [...m10]);
console.log('Unique col 11:', [...m11]);
