import type { ClosureRow, FilterPreset } from '../types'

export type GreetingKind = 'night' | 'morning' | 'noon' | 'evening'

/** ترحيب ديناميكي حسب الوقت مع نوع الأيقونة */
export function getGreeting(date: Date): { label: string; kind: GreetingKind } {
  const h = date.getHours()
  if (h >= 5 && h < 12) return { label: 'صباح الخير', kind: 'morning' }
  if (h >= 12 && h < 17) return { label: 'مساء الخير', kind: 'noon' }
  if (h >= 17 && h < 21) return { label: 'أمسية سعيدة', kind: 'evening' }
  return { label: 'ليلة سعيدة', kind: 'night' }
}

/** انحراف البنك = إجمالي البنك (مدى+فيزا+ماستر+تحويل) − اجمالى الموازنه */
export function computeBankVariance(row: ClosureRow): number {
  const bankTotal = row.mada + row.visa + row.mastercard + row.bankTransfer
  return Math.round((bankTotal - row.programBalanceBank) * 100) / 100
}

/** انحراف الكاش = (كاش + مرسل للخزنة + مصروفات − تعويض مصروفات) − رصيد البرنامج كاش */
export function computeCashVariance(row: ClosureRow): number {
  const cash = row.cash ?? 0
  const sentToTreasury = row.sentToTreasury ?? 0
  const expenses = row.expenses ?? 0
  const compensation = row.expenseCompensation ?? 0
  const effectiveExpenses = Math.max(0, expenses - compensation)
  const expectedProgramCash = cash + sentToTreasury + effectiveExpenses
  return Math.round((expectedProgramCash - row.programBalanceCash) * 100) / 100
}

export function computeVariance(row: ClosureRow): number {
  const sum = row.cash + row.mada + row.visa + row.mastercard + row.bankTransfer
  const program = row.programBalanceCash + row.programBalanceBank
  return Math.round((sum - program) * 100) / 100
}

/** تاريخ ووقت ميلادي مع اسم اليوم — مثل: الثلاثاء 2 يناير 10:52 م */
export function formatDateTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  const opts = { calendar: 'gregory' as const, numberingSystem: 'latn' as const }
  const weekday = d.toLocaleDateString('ar-SA', { ...opts, weekday: 'long' })
  const day = d.getDate()
  const month = d.toLocaleDateString('ar-SA', { ...opts, month: 'long' })
  const time = d.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit', numberingSystem: 'latn' })
  return `${weekday} ${day} ${month} ${time}`
}

/** تحويل الأرقام العربية (٠١٢٣٤٥٦٧٨٩) إلى إنجليزية (0123456789) — إدخال وعرض الأرقام إنجليزي فقط */
const ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩'
const LATIN_DIGITS = '0123456789'
export function toLatinDigits(s: string): string {
  if (typeof s !== 'string') return String(s)
  let out = ''
  for (let i = 0; i < s.length; i++) {
    const idx = ARABIC_DIGITS.indexOf(s[i]!)
    out += idx >= 0 ? LATIN_DIGITS[idx]! : s[i]
  }
  return out
}

/** تنسيق المبلغ مع الإبقاء على الأرقام الإنجليزية (0–9) */
export function formatCurrency(n: number): string {
  return new Intl.NumberFormat('ar-SA', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    numberingSystem: 'latn',
  }).format(n)
}

export function isToday(iso: string): boolean {
  const d = new Date(iso)
  const t = new Date()
  return d.getFullYear() === t.getFullYear() && d.getMonth() === t.getMonth() && d.getDate() === t.getDate()
}

export function isYesterday(iso: string): boolean {
  const d = new Date(iso)
  const y = new Date()
  y.setDate(y.getDate() - 1)
  return d.getFullYear() === y.getFullYear() && d.getMonth() === y.getMonth() && d.getDate() === y.getDate()
}

export function isLastWeek(iso: string): boolean {
  const d = new Date(iso)
  const now = new Date()
  const weekAgo = new Date(now)
  weekAgo.setDate(weekAgo.getDate() - 7)
  return d >= weekAgo && d <= now
}

export function filterByPreset(rows: ClosureRow[], preset: FilterPreset): ClosureRow[] {
  if (preset === 'today') return rows.filter((r) => r.closedAt && isToday(r.closedAt))
  if (preset === 'yesterday') return rows.filter((r) => r.closedAt && isYesterday(r.closedAt))
  if (preset === 'lastWeek') return rows.filter((r) => r.closedAt && isLastWeek(r.closedAt))
  return rows
}
