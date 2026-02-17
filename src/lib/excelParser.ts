/**
 * استخراج إدخالات (معاملات داخل) من تقرير المعاملات البنكية بعد تاريخ معيّن.
 * - يحدد الأعمدة ديناميكياً من صف العناوين (المبلغ، طريقة الدفع، التاريخ، الإتجاه).
 * - يقرأ المبلغ من عمود "المبلغ" أو "قيمة السند" فقط — لا من "رقم السند".
 * - المبالغ: إذا الخلية رقماً تُستخدم كما هي؛ إذا نصاً فالنقطة قد تكون فاصلة آلاف (10.000 = 10000)
 *   والفاصلة عشرية (695,99 = 695.99).
 */

import * as XLSX from 'xlsx'

const ARABIC_NUMBERS = '٠١٢٣٤٥٦٧٨٩'
const ENGLISH_NUMBERS = '0123456789'

function normalizeArabicDigits(s: string): string {
  let out = ''
  for (let i = 0; i < s.length; i++) {
    const idx = ARABIC_NUMBERS.indexOf(s[i]!)
    out += idx >= 0 ? ENGLISH_NUMBERS[idx]! : s[i]
  }
  return out
}

/** إزالة علامات RTL/LTR والشرطات الخاصة التي قد تأتي من Excel العربي */
function normalizeDateString(s: string): string {
  return s
    .replace(/\u200e/g, '')  // LEFT-TO-RIGHT MARK
    .replace(/\u200f/g, '')  // RIGHT-TO-LEFT MARK
    .replace(/\u202a/g, '')  // LTR embedding
    .replace(/\u202b/g, '')  // RTL embedding
    .replace(/\u202c/g, '')  // Pop directional formatting
    .replace(/[\u0640\u066a]/g, '')  // Tatweel, Arabic percent
    .replace(/\/\s*/g, '/')  // شرطة عادية فقط
    .trim()
}

/** Parse "03/02/2026 03:38 ص" or "03‏/02‏/2026 05:02 م" (تاريخ ثم وقت) to Date */
function parseReportDateTimeDateFirst(normalized: string): Date | null {
  const match = normalized.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})\s*([صم])/)
  if (!match) return null
  const monthNum = parseInt(match[2]!, 10) - 1
  const yearNum = parseInt(match[3]!, 10)
  const dayNum = parseInt(match[1]!, 10)
  let hour = parseInt(match[4]!, 10)
  const min = parseInt(match[5]!, 10)
  const ampm = match[6]
  if (ampm === 'م' && hour !== 12) hour += 12
  if (ampm === 'ص' && hour === 12) hour = 0
  const d = new Date(yearNum, monthNum, dayNum, hour, min, 0, 0)
  return isNaN(d.getTime()) ? null : d
}

/** Parse "07:06 م 2026/02/03" or "06:55 م 2026/02/03" (وقت ثم تاريخ yyyy/mm/dd) to Date */
function parseReportDateTimeTimeFirst(normalized: string): Date | null {
  let match = normalized.match(/^(\d{1,2}):(\d{2})\s*([صم])\s+(\d{4})\/(\d{1,2})\/(\d{1,2})/)
  if (match) {
    let hour = parseInt(match[1]!, 10)
    const min = parseInt(match[2]!, 10)
    const ampm = match[3]
    const yearNum = parseInt(match[4]!, 10)
    const monthNum = parseInt(match[5]!, 10) - 1
    const dayNum = parseInt(match[6]!, 10)
    if (ampm === 'م' && hour !== 12) hour += 12
    if (ampm === 'ص' && hour === 12) hour = 0
    const d = new Date(yearNum, monthNum, dayNum, hour, min, 0, 0)
    return isNaN(d.getTime()) ? null : d
  }
  match = normalized.match(/^(\d{1,2}):(\d{2})\s*([صم])\s+(\d{1,2})\/(\d{1,2})\/(\d{4})/)
  if (match) {
    let hour = parseInt(match[1]!, 10)
    const min = parseInt(match[2]!, 10)
    const ampm = match[3]
    const dayNum = parseInt(match[4]!, 10)
    const monthNum = parseInt(match[5]!, 10) - 1
    const yearNum = parseInt(match[6]!, 10)
    if (ampm === 'م' && hour !== 12) hour += 12
    if (ampm === 'ص' && hour === 12) hour = 0
    const d = new Date(yearNum, monthNum, dayNum, hour, min, 0, 0)
    return isNaN(d.getTime()) ? null : d
  }
  return null
}

function parseReportDateTime(str: string): Date | null {
  const raw = normalizeDateString((str || '').toString())
  if (!raw) return null
  const normalized = normalizeArabicDigits(raw)
  return parseReportDateTimeTimeFirst(normalized) ?? parseReportDateTimeDateFirst(normalized)
}

/** نطاق الأرقام التسلسلية لـ Excel للتواريخ المعقولة (حوالي 1990–2037) — تجنّب تفسير المبالغ الكبيرة كتاريخ */
const EXCEL_SERIAL_MIN = 32874
const EXCEL_SERIAL_MAX = 52100

/** إذا كانت الخلية تاريخاً كـ Date أو رقم Excel تسلسلي ضمن النطاق المعقول نعيد Date */
function parseDateCell(cell: unknown): Date | null {
  if (cell instanceof Date) return isNaN(cell.getTime()) ? null : cell
  if (typeof cell === 'number' && Number.isFinite(cell)) {
    if (cell < EXCEL_SERIAL_MIN || cell > EXCEL_SERIAL_MAX) return null
    const epoch = 25569
    const ms = (cell - epoch) * 86400 * 1000
    const d = new Date(ms)
    return isNaN(d.getTime()) ? null : d
  }
  return null
}

/** الفاصلة العشرية العربية (U+066B) */
const ARABIC_DECIMAL = '\u066B'

/**
 * تحويل نص مبلغ إلى رقم — يدعم:
 * - 6967.5 SAR أو SAR 6967.5 (الرقم ثم SAR أو العكس)
 * - ر.س / ريال قبل أو بعد الرقم
 * - نقطة كفاصلة آلاف: 10.000 = 10000
 * - فاصلة عشرية: 695,99 = 695.99
 */
function parseAmount(str: string): number {
  let raw = (str || '').toString().trim()
  raw = raw.replace(/\s*SAR\s*/gi, ' ').replace(/\s*ر\.?\s*س\.?\s*/g, ' ').replace(/\s*ريال\s*(سعودي)?\s*/gi, ' ').trim()
  const normalized = normalizeArabicDigits(raw)
  let numStr = normalized.replace(ARABIC_DECIMAL, '.').replace(/[^\d.,\-]/g, '')
  if (!numStr) return 0

  // فاصلة عشرية: نمط مثل 695,99 أو 10,5 → نستبدل الفاصلة بنقطة
  const commaAsDecimal = /^-?\d+,\d{1,3}$/
  if (commaAsDecimal.test(numStr)) {
    numStr = numStr.replace(',', '.')
  } else {
    numStr = numStr.replace(/,/g, '')
  }

  // نقطة كفاصلة آلاف (مثل 10.000 أو 1.234.567): إذا الجزء بعد آخر نقطة = 3 أرقام بالضبط → النقطة للآلاف
  if (numStr.includes('.')) {
    const parts = numStr.split('.')
    const last = parts[parts.length - 1]
    if (last && last.length === 3 && /^\d+$/.test(last)) {
      numStr = numStr.replace(/\./g, '')
    }
  }

  const num = parseFloat(numStr)
  return Number.isFinite(num) ? num : 0
}

/** طريقة الدفع في الملف → حقل الصف (يُستخرج فقط: مدى، فيزا، ماستر كارد، تحويل بنكي) */
const METHOD_MAP: Record<string, 'cash' | 'mada' | 'visa' | 'mastercard' | 'bankTransfer'> = {
  مدى: 'mada',
  فيزا: 'visa',
  'ماستر كارد': 'mastercard',
  'ماستركارد': 'mastercard',
  'تحويل بنكي': 'bankTransfer',
  تحويل: 'bankTransfer',
}
/** استبعاد صريح: لا نأخذ قيماً من هذه الطرق (شيك، أمريكان إكسبريس، نقداً) */
const EXCLUDED_METHODS = ['شيك', 'أمريكان إكسبريس', 'امريكان اكسبريس', 'نقداً', 'نقدا', 'كاش']
function isExcludedMethod(methodStr: string): boolean {
  const n = methodStr.replace(/\s+/g, ' ').trim()
  return EXCLUDED_METHODS.some((ex) => n === ex || n.includes(ex))
}

/** استخراج حسب الصفوف: الصف اللي فيه مدى نأخذ الخانة المقابلة (أول مبلغ في نفس الصف). بدون اعتماد على أعمدة ثابتة */
function extractSumsByRows(
  data: unknown[][],
  sheet: Record<string, { w?: string; v?: number }>,
  startRow: number
): { sums: ExcelSums; counts: ExcelCounts; details: ExcelDetails } {
  const sums = { ...EMPTY_SUMS }
  const counts = { ...EMPTY_COUNTS }
  const details: ExcelDetails = { mada: [], visa: [], mastercard: [], bankTransfer: [] }
  const maxRows = Math.min(data.length, 500)
  for (let r = startRow; r < maxRows; r++) {
    const row = data[r] as (string | number | undefined)[]
    if (!row || !Array.isArray(row)) continue
    const maxCol = Math.min(Math.max(row.length, 4), 120)
    let methodField: 'mada' | 'visa' | 'mastercard' | 'bankTransfer' | null = null
    let methodCol = -1
    for (let c = 0; c < maxCol; c++) {
      const raw = sheet ? getCellText(sheet, row, r, c) : (row[c] ?? '').toString().trim()
      const n = normalizeHeaderCell(raw)
      if (!n) continue
      if (isExcludedMethod(n)) continue
      const field = (METHOD_MAP as Record<string, string>)[n] ?? (n.includes('مدى') ? 'mada' : null)
      if (field && field !== 'cash') {
        methodField = field as 'mada' | 'visa' | 'mastercard' | 'bankTransfer'
        methodCol = c
        break
      }
    }
    if (methodField == null) continue
    if (methodField === 'cash') continue
    let amountVal = 0
    for (let c = 0; c < maxCol; c++) {
      if (c === methodCol) continue
      const raw = sheet ? getCellText(sheet, row, r, c) : (row[c] ?? '').toString().trim()
      const val = parseAmount(raw)
      if (val > 0 && val <= MAX_SINGLE_AMOUNT) {
        amountVal = val
        break
      }
    }
    if (amountVal <= 0) continue
    const methodStr = (row[methodCol] ?? '').toString().trim()
    if (methodStr.includes('إجمالي') || methodStr.includes('مجموع') || methodStr.includes('المجموع')) continue
    sums[methodField] += amountVal
    counts[methodField] += 1
    details[methodField].push({ date: new Date(0), amount: amountVal, employeeName: undefined, purpose: undefined })
  }
  return { sums, counts, details }
}

export interface ExcelSums {
  cash: number
  mada: number
  visa: number
  mastercard: number
  bankTransfer: number
}

/** عدد العمليات لكل طريقة دفع (لملء الخانات بعد الاستيراد وعرض التفصيل) */
export interface ExcelCounts {
  cash: number
  mada: number
  visa: number
  mastercard: number
  bankTransfer: number
}

/** عملية واحدة: تاريخ/وقت + مبلغ + اسم الموظف + الغرض (لعرض تفاصيل استيراد الإكسل) */
export interface ExcelTransactionDetail {
  date: Date
  amount: number
  /** اسم الموظف الذي قام بالعملية إن وُجد في الملف */
  employeeName?: string
  /** الغرض أو الوصف من كشف الإكسل (مثل: إيجار غرفة 404) */
  purpose?: string
}

/** قوائم العمليات لكل طريقة دفع بعد الاستيراد */
export interface ExcelDetails {
  mada: ExcelTransactionDetail[]
  visa: ExcelTransactionDetail[]
  mastercard: ExcelTransactionDetail[]
  bankTransfer: ExcelTransactionDetail[]
}

const EMPTY_SUMS: ExcelSums = {
  cash: 0,
  mada: 0,
  visa: 0,
  mastercard: 0,
  bankTransfer: 0,
}

const EMPTY_COUNTS: ExcelCounts = {
  cash: 0,
  mada: 0,
  visa: 0,
  mastercard: 0,
  bankTransfer: 0,
}

const EMPTY_DETAILS: ExcelDetails = {
  mada: [],
  visa: [],
  mastercard: [],
  bankTransfer: [],
}

interface ColumnIndices {
  date: number
  method: number
  amount: number
  direction: number
  /** عمود اختياري: الموظف / اسم الموظف */
  employeeName: number
  /** عمود اختياري: الغرض / الوصف / البيان */
  purpose: number
}

/** تطبيع نص عنوان من الإكسل (علامات RTL/مسافات/أرقام عربية/أحرف عرض صفر) لتحسين المطابقة. إزالة SAR حتى لا تؤثر على مطابقة العناوين */
function normalizeHeaderCell(val: unknown): string {
  let s = (val ?? '').toString()
  s = s
    .replace(/\u200e/g, '')
    .replace(/\u200f/g, '')
    .replace(/\u202a|\u202b|\u202c/g, '')
    .replace(/\u200b|\u200c|\u200d|\ufeff/g, '')
    .replace(/\s+/g, ' ')
  s = s.replace(/SAR/gi, '').replace(/ر\.?\s*س\.?/g, '').replace(/ريال\s*(سعودي)?/g, '')
  return s.trim()
}

/** قراءة نص الخلية من الورقة (القيمة المعروضة .w أولاً) لتحسين التعرف على العناوين */
function getCellText(
  sheet: Record<string, { w?: string; v?: number }>,
  row: (string | number | undefined)[],
  r: number,
  c: number
): string {
  const ref = XLSX.utils.encode_cell({ r, c })
  const raw = sheet[ref]
  if (raw != null) {
    if (typeof raw.w === 'string' && raw.w.trim()) return raw.w.trim()
    if (typeof raw.v === 'number' && !Number.isNaN(raw.v)) return String(raw.v)
    if (typeof (raw as { v?: string }).v === 'string') return (raw as { v: string }).v.trim()
  }
  const fromRow = row[c]
  return (fromRow ?? '').toString().trim()
}

/** التحقق من أن نص الخلية يطابق "طريقة الدفع" أو "المقبوضات" (جدول حسب طريقة الدفع) */
function cellHasPaymentMethodHeader(t: string): boolean {
  const n = normalizeHeaderCell(t)
  return (
    n.includes('طريقةالدفع') ||
    n.includes('طريقة الدفع') ||
    (n.includes('الدفع') && n.length < 30) ||
    (n.includes('طريقة') && (n.includes('دفع') || n.includes('الدفع')))
  )
}
function cellHasAmountHeader(t: string): boolean {
  const n = normalizeHeaderCell(t)
  return (
    n.includes('المبلغ') ||
    n.includes('قيمةالسند') ||
    n.includes('قيمة السند') ||
    n.includes('المقبوضات') ||
    n.includes('مقبوضات') ||
    n.includes('قبوضات') ||
    n.includes('المصروفات') ||
    n.includes('مصروفات') ||
    n.includes('الصافي') ||
    n.includes('صافي') ||
    n.includes('مبلغ') ||
    (n.includes('قيمة') && !n.includes('رقم') && n.length < 35)
  )
}

/** بناء مصفوفة البيانات من كل خلايا الورقة (لتضمين الجدول السفلي حتى لو كان نطاق !ref جزئياً) */
function buildDataFromSheet(sheet: Record<string, { w?: string; v?: number }>): unknown[][] {
  const rowMap = new Map<number, Map<number, string>>()
  for (const key of Object.keys(sheet)) {
    if (key.startsWith('!')) continue
    const decoded = XLSX.utils.decode_cell(key)
    if (decoded == null || typeof decoded.r !== 'number') continue
    const r = decoded.r
    const c = decoded.c
    const cell = sheet[key] as { w?: string; v?: string | number } | undefined
    const text =
      (cell && typeof cell.w === 'string' && cell.w.trim()) ||
      (cell && typeof cell.v === 'string' && cell.v.trim()) ||
      (cell && typeof cell.v === 'number' && !Number.isNaN(cell.v) ? String(cell.v) : '')
    if (!rowMap.has(r)) rowMap.set(r, new Map())
    rowMap.get(r)!.set(c, text)
  }
  const maxR = rowMap.size === 0 ? 0 : Math.max(...rowMap.keys())
  const data: unknown[][] = []
  for (let r = 0; r <= maxR; r++) {
    const colMap = rowMap.get(r)
    const maxC = colMap ? Math.max(...colMap.keys()) : 0
    const row: unknown[] = []
    for (let c = 0; c <= maxC; c++) {
      row.push(colMap?.get(c) ?? '')
    }
    data.push(row)
  }
  return data
}

/** البحث عن صف العناوين بمسح الورقة مباشرة (للجدول السفلي "حسب طريقة الدفع") */
function findHeaderRowByScanningSheet(sheet: Record<string, { w?: string; v?: number }>): number {
  const rowTexts = new Map<number, string[]>()
  for (const key of Object.keys(sheet)) {
    if (key.startsWith('!')) continue
    const decoded = XLSX.utils.decode_cell(key)
    if (decoded == null || typeof decoded.r !== 'number') continue
    const r = decoded.r
    const c = decoded.c
    const cell = sheet[key] as { w?: string; v?: string | number } | undefined
    const text =
      (cell && typeof cell.w === 'string' && cell.w.trim()) ||
      (cell && typeof cell.v === 'string' && cell.v.trim()) ||
      (cell && typeof cell.v === 'number' && !Number.isNaN(cell.v) ? String(cell.v) : '')
    if (!text) continue
    if (!rowTexts.has(r)) rowTexts.set(r, [])
    const arr = rowTexts.get(r)!
    while (arr.length <= c) arr.push('')
    arr[c] = text
  }
  const rows = Array.from(rowTexts.keys()).sort((a, b) => a - b)
  for (const r of rows) {
    const cells = rowTexts.get(r) || []
    let hasAmount = false
    let hasMethod = false
    for (const cell of cells) {
      const n = normalizeHeaderCell(cell)
      if (!n) continue
      if (cellHasAmountHeader(n)) hasAmount = true
      if (cellHasPaymentMethodHeader(n)) hasMethod = true
    }
    if (hasAmount && hasMethod) return r
  }
  return -1
}

/** قيم طريقة الدفع في صفوف البيانات (جدول حسب طريقة الدفع) */
const PAYMENT_METHOD_VALUES = ['مدى', 'فيزا', 'ماستر كارد', 'ماستركارد', 'تحويل بنكي', 'تحويل', 'نقداً', 'نقدا', 'شيك', 'أمريكان إكسبريس']
function cellIsPaymentMethodValue(t: string): boolean {
  const n = normalizeHeaderCell(t)
  if (!n || n.length > 50) return false
  return PAYMENT_METHOD_VALUES.some((p) => n === p || n.includes(p))
}

/** احتياطي: البحث عن أول صف بيانات يحتوي "مدى" أو "فيزا" أو "ماستر كارد" أو "تحويل بنكي" فيكون الصف السابق هو صف العناوين */
function findHeaderRowByDataRow(
  data: unknown[][],
  sheet?: Record<string, { w?: string; v?: number }>
): number {
  const maxRows = Math.min(data.length, 200)
  for (let r = 1; r < maxRows; r++) {
    const row = data[r] as (string | number | undefined)[]
    if (!row || !Array.isArray(row)) continue
    const maxCol = Math.min(Math.max(row.length, 50), 120)
    for (let c = 0; c < maxCol; c++) {
      const rawText = sheet ? getCellText(sheet, row, r, c) : (row[c] ?? '').toString().trim()
      if (cellIsPaymentMethodValue(rawText)) return r - 1
    }
  }
  return -1
}

/** البحث عن أول صف يبدو صف عناوين: طريقة الدفع + عمود مبلغ (المبلغ أو المقبوضات). يدعم ورقة الإكسل لقراءة .w */
function findHeaderRow(
  data: unknown[][],
  sheet?: Record<string, { w?: string; v?: number }>
): number {
  const maxRows = Math.min(data.length, 200)
  for (let r = 0; r < maxRows; r++) {
    const row = data[r] as (string | number | undefined)[]
    if (!row || !Array.isArray(row)) continue
    const maxCol = Math.min(Math.max(row.length, 50), 120)
    let hasAmount = false
    let hasMethod = false
    for (let c = 0; c < maxCol; c++) {
      const rawText = sheet ? getCellText(sheet, row, r, c) : (row[c] ?? '').toString().trim()
      const cell = normalizeHeaderCell(rawText)
      if (!cell) continue
      if (cellHasAmountHeader(cell)) hasAmount = true
      if (cellHasPaymentMethodHeader(cell)) hasMethod = true
    }
    if (hasAmount && hasMethod) return r
  }
  return -1
}

/** عناوين محتملة لعمود اسم الموظف في الإكسل */
const EMPLOYEE_HEADER_MATCHERS = [
  'الموظف',
  'اسم الموظف',
  'الاسم',
  'اسم',
  'المستخدم',
  'اسم المستخدم',
  'الموظف المسؤول',
  'المسؤول',
  'كاشير',
  'الكاشير',
  'المحاسب',
  'اسم المحاسب',
]

function isEmployeeHeader(cell: string): boolean {
  const n = cell.replace(/\s+/g, ' ').replace(/\u200e|\u200f/g, '').trim()
  if (!n) return false
  if (n.includes('موظف') || n.includes('كاشير') || n.includes('محاسب')) return true
  return EMPLOYEE_HEADER_MATCHERS.some((h) => n === h || n.includes(h))
}

/**
 * استخلاص indices الأعمدة من صف العناوين ديناميكياً.
 * عمود المبلغ = "المبلغ" أو "قيمة السند" — وليس "رقم السند".
 * عمود اختياري: الموظف / اسم الموظف / الاسم / المستخدم ...
 */
/** عناوين محتملة لعمود الغرض/الوصف في الإكسل */
const PURPOSE_HEADER_MATCHERS = ['الغرض', 'الوصف', 'البيان', 'الغرض من العملية', 'تفاصيل', 'ملاحظات', 'وصف العملية']

function isPurposeHeader(cell: string): boolean {
  const n = cell.replace(/\s+/g, ' ').trim()
  if (!n) return false
  return PURPOSE_HEADER_MATCHERS.some((h) => n.includes(h))
}

function detectColumnIndices(headerRow: (string | number | undefined)[]): ColumnIndices | null {
  let dateCol = -1
  let methodCol = -1
  let amountCol = -1
  let directionCol = -1
  let employeeNameCol = -1
  let purposeCol = -1
  const maxCol = Math.min(Math.max(headerRow?.length ?? 0, 10), 120)
  /** تفضيل عمود المقبوضات للمبالغ عند وجوده (استخراج مدى/فيزا/ماستر/تحويل من المقبوضات فقط) */
  let receiptsCol = -1
  for (let c = 0; c < maxCol; c++) {
    const raw = headerRow[c]
    const cell = normalizeHeaderCell(raw)
    if ((cell.includes('الوقت') || cell.includes('التاريخ')) && dateCol < 0) dateCol = c
    if (methodCol < 0 && cellHasPaymentMethodHeader(cell)) methodCol = c
    if ((cell.includes('الإتجاه') || cell.includes('الاتجاه')) && directionCol < 0) directionCol = c
    if (employeeNameCol < 0 && isEmployeeHeader(cell)) employeeNameCol = c
    if (purposeCol < 0 && isPurposeHeader(cell)) purposeCol = c
    if (cellHasAmountHeader(cell)) {
      if (cell.includes('المقبوضات') || cell.includes('مقبوضات') || cell.includes('قبوضات')) receiptsCol = c
      if (amountCol < 0) amountCol = c
    }
    if (cell.includes('رقم السند') && !cell.includes('قيمة السند')) continue
  }
  if (receiptsCol >= 0) amountCol = receiptsCol
  if (methodCol >= 0 && amountCol >= 0)
    return { date: dateCol, method: methodCol, amount: amountCol, direction: directionCol, employeeName: employeeNameCol, purpose: purposeCol }
  return null
}

/** قراءة خلية التاريخ وتحويلها إلى Date */
function parseDateFromCell(cell: unknown): Date | null {
  const str = (cell ?? '').toString().trim()
  const asDate =
    typeof cell === 'string' || (typeof cell === 'number' && cell < 30000)
      ? (str ? parseReportDateTime(str) : null)
      : (parseDateCell(cell) ?? (str ? parseReportDateTime(str) : null))
  return asDate
}

/** حد أقصى معقول لمبلغ واحد في السطر (لتجنب أخطاء قراءة) */
const MAX_SINGLE_AMOUNT = 999_999

/**
 * قراءة الملف: تحديد الأعمدة من صف العناوين (المبلغ، طريقة الدفع، التاريخ، الإتجاه)
 * وقراءة المبلغ من عمود "المبلغ" فقط — لا من "رقم السند".
 */
export function parseBankTransactionsExcel(
  buffer: ArrayBuffer,
  afterDate: Date
): { sums: ExcelSums; counts: ExcelCounts; details: ExcelDetails; employeeName: string | null; employeeNamesList: string[]; error: string | null } {
  try {
    const wb = XLSX.read(buffer, { type: 'array' })
    const sheetNames = wb.SheetNames || []
    if (sheetNames.length === 0)
      return { sums: EMPTY_SUMS, counts: EMPTY_COUNTS, details: EMPTY_DETAILS, employeeName: null, employeeNamesList: [], error: 'الملف لا يحتوي على أي sheet' }
    let data: unknown[][] = []
    let sheet: Record<string, { w?: string; v?: number }> = {}
    let sheetName = ''
    let headerRowIndex = -1
    for (let i = 0; i < sheetNames.length; i++) {
      sheetName = sheetNames[i]!
      sheet = wb.Sheets[sheetName] as Record<string, { w?: string; v?: number }>
      data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' }) as unknown[][]
      headerRowIndex = findHeaderRow(data, sheet)
      if (headerRowIndex < 0) {
        data = buildDataFromSheet(sheet)
        headerRowIndex = findHeaderRow(data, sheet)
      }
      if (headerRowIndex < 0) headerRowIndex = findHeaderRowByScanningSheet(sheet)
      if (headerRowIndex >= 0) {
        if (data.length <= headerRowIndex) data = buildDataFromSheet(sheet)
        break
      }
    }
    if (headerRowIndex >= 0 && data.length <= headerRowIndex) {
      data = buildDataFromSheet(sheet)
    }
    if (headerRowIndex < 0) {
      headerRowIndex = findHeaderRowByDataRow(data, sheet)
    }
    if (headerRowIndex >= 0 && data.length <= headerRowIndex) {
      data = buildDataFromSheet(sheet)
    }
    if (headerRowIndex < 0)
      return { sums: EMPTY_SUMS, counts: EMPTY_COUNTS, details: EMPTY_DETAILS, employeeName: null, employeeNamesList: [], error: 'لم يُعثر على صف العناوين (طريقة الدفع، المبلغ أو المقبوضات)' }

    const headerDataRow = data[headerRowIndex] as (string | number | undefined)[]
    /** بناء صف العناوين من القيم المعروضة في الورقة لضمان تطابق أعمدة المبلغ وطريقة الدفع */
    const headerRow: (string | number | undefined)[] = []
    for (let c = 0; c < Math.max(headerDataRow?.length ?? 0, 80); c++) {
      headerRow.push(getCellText(sheet, headerDataRow, headerRowIndex, c) || headerDataRow[c])
    }
    let cols = detectColumnIndices(headerRow)
    /** إذا فشل تحديد الأعمدة نعتمد على الصفوف: الصف اللي فيه مدى نأخذ الخانة المقابلة له */
    const useRowBased = !cols
    if (useRowBased) {
      const byRows = extractSumsByRows(data, sheet, headerRowIndex + 1)
      return {
        sums: byRows.sums,
        counts: byRows.counts,
        details: byRows.details,
        employeeName: null,
        employeeNamesList: [],
        error: null,
      }
    }

    const sums = { ...EMPTY_SUMS }
    const counts = { ...EMPTY_COUNTS }
    const details: ExcelDetails = { mada: [], visa: [], mastercard: [], bankTransfer: [] }
    /** أسماء الموظفين الفريدة في الصفوف المستوردة (بعد فلتر التاريخ والإتجاه) */
    const employeeNames = new Set<string>()
    const afterTime = afterDate.getTime()

    for (let r = headerRowIndex + 1; r < data.length; r++) {
      const row = data[r] as (string | number | undefined)[]
      const methodStr = (row[cols.method] ?? '').toString().trim()
      if (!methodStr) continue
      if (isExcludedMethod(methodStr)) continue
      const dateCell = cols.date >= 0 ? row[cols.date] : undefined
      const parsedDate = cols.date >= 0 ? parseDateFromCell(dateCell) : null
      if (cols.date >= 0 && (!parsedDate || parsedDate.getTime() < afterTime)) continue
      const dt = parsedDate ?? new Date(0)
      const direction = cols.direction >= 0 ? (row[cols.direction] ?? '').toString().trim() : ''
      const dirNorm = direction.replace(/\u200e/g, '').replace(/\u200f/g, '').trim()
      if (cols.direction >= 0 && dirNorm !== 'داخل') continue
      const amountCell = row[cols.amount]

      if (cols.employeeName >= 0) {
        const empCellRef = XLSX.utils.encode_cell({ r, c: cols.employeeName })
        const empRaw = sheet[empCellRef]
        const empDisplay = empRaw && typeof empRaw.w === 'string' ? empRaw.w.trim() : ''
        const emp = empDisplay || (row[cols.employeeName] ?? '').toString().trim()
        if (emp) employeeNames.add(emp)
      }

      // تفضيل النص المعروض (cell.w) لخلية المبلغ لقراءة "10.000" كـ 10000 وليس 10
      const amountCellRef = XLSX.utils.encode_cell({ r, c: cols.amount })
      const rawCell = sheet[amountCellRef]
      const displayText = rawCell && typeof rawCell.w === 'string' ? rawCell.w.trim() : ''
      let amountVal: number
      if (displayText) {
        amountVal = parseAmount(displayText)
      } else if (typeof amountCell === 'number' && Number.isFinite(amountCell)) {
        amountVal = amountCell
      } else {
        const amountStr = (amountCell ?? '').toString().trim()
        amountVal = parseAmount(amountStr)
      }
      if (amountVal <= 0 || amountVal > MAX_SINGLE_AMOUNT) continue

      const methodNorm = methodStr.replace(/\s+/g, ' ').trim()
      if (methodNorm.includes('إجمالي') || methodNorm.includes('مجموع') || methodNorm.includes('المجموع')) continue

      const field = METHOD_MAP[methodStr] ?? (methodStr.toLowerCase().includes('مدى') ? 'mada' : null)
      if (field) {
        sums[field] += amountVal
        counts[field] += 1
        if (field !== 'cash') {
          const emp = cols.employeeName >= 0
            ? (() => {
                const empCellRef = XLSX.utils.encode_cell({ r, c: cols.employeeName })
                const empRaw = sheet[empCellRef]
                const empDisplay = empRaw && typeof empRaw.w === 'string' ? empRaw.w.trim() : ''
                return empDisplay || (row[cols.employeeName] ?? '').toString().trim() || undefined
              })()
            : undefined
          let purpose: string | undefined
          if (cols.purpose >= 0) {
            const purposeCellRef = XLSX.utils.encode_cell({ r, c: cols.purpose })
            const purposeRaw = sheet[purposeCellRef]
            const purposeDisplay = purposeRaw && typeof purposeRaw.w === 'string' ? purposeRaw.w.trim() : ''
            purpose = purposeDisplay || (row[cols.purpose] ?? '').toString().trim() || undefined
          }
          details[field].push({ date: dt, amount: amountVal, employeeName: emp, purpose })
        }
      }
    }

    const namesList = [...employeeNames]
    const employeeName =
      employeeNames.size === 0
        ? null
        : employeeNames.size === 1
          ? namesList[0]!
          : 'أكثر من موظف'
    return { sums, counts, details, employeeName, employeeNamesList: namesList, error: null }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { sums: EMPTY_SUMS, counts: EMPTY_COUNTS, details: EMPTY_DETAILS, employeeName: null, employeeNamesList: [], error: `خطأ في قراءة الملف: ${msg}` }
  }
}
