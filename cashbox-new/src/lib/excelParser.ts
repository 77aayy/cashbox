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
 * - نقطة كفاصلة آلاف: 10.000 = 10000 ، 1.500 = 1500
 * - فاصلة كفاصلة عشرية: 695,99 = 695.99
 * - نقطة كفاصلة عشرية: 695.99 أو 10.5
 */
function parseAmount(str: string): number {
  const raw = (str || '').toString().trim()
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

/** طريقة الدفع في الملف → حقل الصف */
const METHOD_MAP: Record<string, 'cash' | 'mada' | 'visa' | 'mastercard' | 'bankTransfer'> = {
  مدى: 'mada',
  فيزا: 'visa',
  'ماستر كارد': 'mastercard',
  'ماستركارد': 'mastercard',
  كاش: 'cash',
  'تحويل بنكي': 'bankTransfer',
  تحويل: 'bankTransfer',
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

/** البحث عن أول صف يبدو صف عناوين (يحتوي "المبلغ" و"طريقة الدفع" أو "التاريخ") */
function findHeaderRow(data: unknown[][]): number {
  for (let r = 0; r < Math.min(data.length, 50); r++) {
    const row = data[r] as (string | number | undefined)[]
    let hasAmount = false
    let hasMethodOrDate = false
    const maxCol = Math.min(row?.length ?? 0, 60)
    for (let c = 0; c < maxCol; c++) {
      const cell = (row[c] ?? '').toString().trim()
      if (cell.includes('المبلغ') || cell.includes('قيمة السند') || (cell.includes('قيمة') && !cell.includes('رقم السند'))) hasAmount = true
      if (cell.includes('طريقة الدفع') || cell.includes('التاريخ') || cell.includes('الوقت')) hasMethodOrDate = true
    }
    if (hasAmount && hasMethodOrDate) return r
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
  const maxCol = Math.min(headerRow?.length ?? 0, 60)
  for (let c = 0; c < maxCol; c++) {
    const cell = (headerRow[c] ?? '').toString().trim()
    if ((cell.includes('الوقت') || cell.includes('التاريخ')) && dateCol < 0) dateCol = c
    if (methodCol < 0 && (cell.includes('طريقة الدفع') || (cell.includes('طريقة') && (cell.includes('دفع') || cell.includes('الدفع'))))) methodCol = c
    if (cell.includes('الإتجاه') || cell.includes('الاتجاه')) directionCol = c
    if (employeeNameCol < 0 && isEmployeeHeader(cell)) employeeNameCol = c
    if (purposeCol < 0 && isPurposeHeader(cell)) purposeCol = c
    // عمود المبلغ: المبلغ أو قيمة السند فقط — استبعاد عمود "رقم السند" (وليس "قيمة السند")
    if (cell.includes('رقم السند') && !cell.includes('قيمة السند')) continue
    if ((cell.includes('المبلغ') || cell.includes('قيمة السند') || (cell.includes('قيمة') && cell.length < 25)) && amountCol < 0) amountCol = c
  }
  if (dateCol >= 0 && methodCol >= 0 && amountCol >= 0 && directionCol >= 0)
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
    const sheetName = wb.SheetNames[0]
    if (!sheetName) return { sums: EMPTY_SUMS, counts: EMPTY_COUNTS, details: EMPTY_DETAILS, employeeName: null, employeeNamesList: [], error: 'الملف لا يحتوي على أي sheet' }
    const sheet = wb.Sheets[sheetName] as Record<string, { w?: string; v?: number }>
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' }) as unknown[][]

    const headerRowIndex = findHeaderRow(data)
    if (headerRowIndex < 0)
      return { sums: EMPTY_SUMS, counts: EMPTY_COUNTS, details: EMPTY_DETAILS, employeeName: null, employeeNamesList: [], error: 'لم يُعثر على صف العناوين (المبلغ، طريقة الدفع، التاريخ)' }

    const headerRow = data[headerRowIndex] as (string | number | undefined)[]
    const cols = detectColumnIndices(headerRow)
    if (!cols)
      return { sums: EMPTY_SUMS, counts: EMPTY_COUNTS, details: EMPTY_DETAILS, employeeName: null, employeeNamesList: [], error: 'لم يُحدد أحد الأعمدة: التاريخ، طريقة الدفع، المبلغ، الإتجاه' }

    const sums = { ...EMPTY_SUMS }
    const counts = { ...EMPTY_COUNTS }
    const details: ExcelDetails = { mada: [], visa: [], mastercard: [], bankTransfer: [] }
    /** أسماء الموظفين الفريدة في الصفوف المستوردة (بعد فلتر التاريخ والإتجاه) */
    const employeeNames = new Set<string>()
    const afterTime = afterDate.getTime()

    for (let r = headerRowIndex + 1; r < data.length; r++) {
      const row = data[r] as (string | number | undefined)[]
      const dateCell = row[cols.date]
      const methodStr = (row[cols.method] ?? '').toString().trim()
      const amountCell = row[cols.amount]
      const direction = (row[cols.direction] ?? '').toString().trim()
      const dirNorm = direction.replace(/\u200e/g, '').replace(/\u200f/g, '').trim()

      if (!methodStr) continue
      const dt = parseDateFromCell(dateCell)
      if (!dt || dt.getTime() < afterTime) continue
      if (dirNorm !== 'داخل') continue

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
