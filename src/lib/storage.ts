import type { ClosureRow } from '../types'
import { addClosedRowToFirebase, deleteClosedRowFromFirebase } from './firebaseClosedRows'

export type Branch = 'corniche' | 'andalusia'

function storageKey(branch: Branch): string {
  return `cashbox_rows_${branch}`
}

function id(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

function normalizeRow(r: ClosureRow): ClosureRow {
  const raw = r as { expenseItems?: unknown; expenseCompensation?: number; carriedExpenseCount?: number; sentToTreasury?: number }
  const expenseItems = Array.isArray(raw.expenseItems)
    ? (raw.expenseItems as { amount: number; description: string }[]).filter(
        (x) => typeof x.amount === 'number' && typeof x.description === 'string'
      )
    : []
  return {
    ...r,
    sentToTreasury: typeof raw.sentToTreasury === 'number' ? raw.sentToTreasury : 0,
    expenseCompensation: typeof raw.expenseCompensation === 'number' ? raw.expenseCompensation : 0,
    expenses: typeof (r as { expenses?: number }).expenses === 'number' ? (r as { expenses: number }).expenses : 0,
    carriedExpenseCount: typeof raw.carriedExpenseCount === 'number' && raw.carriedExpenseCount >= 0 ? raw.carriedExpenseCount : 0,
    expenseItems,
    mastercard: typeof (r as { mastercard?: number }).mastercard === 'number' ? (r as { mastercard: number }).mastercard : 0,
    programBalanceCash: typeof r.programBalanceCash === 'number' ? r.programBalanceCash : 0,
    programBalanceBank: typeof r.programBalanceBank === 'number' ? r.programBalanceBank : 0,
  }
}

/** تحميل الصفوف النشطة فقط من localStorage */
function loadActive(branch: Branch): ClosureRow[] {
  try {
    const key = storageKey(branch)
    let raw = localStorage.getItem(key)
    if (!raw && branch === 'corniche') {
      const legacy = localStorage.getItem('cashbox_rows')
      if (legacy) {
        localStorage.setItem(key, legacy)
        localStorage.removeItem('cashbox_rows')
        raw = legacy
      }
    }
    if (!raw) return []
    const list = JSON.parse(raw) as ClosureRow[]
    return list.filter((r) => r.status !== 'closed').map(normalizeRow)
  } catch {
    return []
  }
}

function saveActive(branch: Branch, rows: ClosureRow[]): void {
  try {
    localStorage.setItem(storageKey(branch), JSON.stringify(rows.filter((r) => r.status !== 'closed')))
  } catch {
    // ignore
  }
}

/** الصفوف النشطة فقط — من localStorage */
export function getActiveRows(branch: Branch): ClosureRow[] {
  return loadActive(branch).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
}

/** يُستخدم عند الإغلاق لدمج أحدث البيانات من الـ state مع الـ storage */
export function getRowById(branch: Branch, rowId: string): ClosureRow | null {
  const rows = loadActive(branch)
  return rows.find((r) => r.id === rowId) ?? null
}

export interface AddRowInitial {
  expenses: number
  expenseItems: { amount: number; description: string }[]
  carriedExpenseCount: number
}

export function addRow(branch: Branch, employeeName: string, initial?: AddRowInitial): void {
  const rows = loadActive(branch)
  const now = new Date().toISOString()
  const expenses = initial?.expenses ?? 0
  const expenseItems = initial?.expenseItems ?? []
  const carriedExpenseCount = initial?.carriedExpenseCount ?? 0
  rows.push({
    id: id(),
    employeeName,
    cash: 0,
    sentToTreasury: 0,
    expenseCompensation: 0,
    expenses,
    carriedExpenseCount,
    expenseItems,
    mada: 0,
    visa: 0,
    mastercard: 0,
    bankTransfer: 0,
    programBalanceCash: 0,
    programBalanceBank: 0,
    variance: 0,
    status: 'active',
    notes: '',
    closedAt: null,
    createdAt: now,
  })
  saveActive(branch, rows)
}

export function updateRow(branch: Branch, rowId: string, patch: Partial<ClosureRow>): void {
  const rows = loadActive(branch)
  const i = rows.findIndex((r) => r.id === rowId)
  if (i === -1) return
  rows[i] = { ...rows[i]!, ...patch }
  saveActive(branch, rows)
}

/** إغلاق الشفت: ترحيل الصف إلى Firebase فوراً، وإزالته من localStorage */
export async function closeRow(branch: Branch, rowId: string, row: ClosureRow): Promise<void> {
  const now = new Date().toISOString()
  const closedRow: ClosureRow = { ...row, status: 'closed', closedAt: now }
  await addClosedRowToFirebase(branch, closedRow)
  const rows = loadActive(branch).filter((r) => r.id !== rowId)
  saveActive(branch, rows)
}

/** حذف صف — إن كان نشطاً من localStorage، وإن كان مغلقاً من Firebase */
export async function deleteRow(branch: Branch, rowId: string, isClosed: boolean): Promise<void> {
  if (isClosed) {
    await deleteClosedRowFromFirebase(branch, rowId)
  } else {
    const rows = loadActive(branch).filter((r) => r.id !== rowId)
    saveActive(branch, rows)
  }
}

/** حذف كل الصفوف المغلقة من Firebase */
export async function deleteAllClosedRows(branch: Branch): Promise<void> {
  const { getClosedRowsFromFirebase, deleteClosedRowFromFirebase: delClosed } = await import('./firebaseClosedRows')
  const closed = await getClosedRowsFromFirebase(branch)
  await Promise.all(closed.map((r) => delClosed(branch, r.id)))
}
