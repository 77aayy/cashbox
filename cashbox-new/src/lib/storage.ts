import type { ClosureRow } from '../types'

const KEY = 'cashbox_rows'

function id(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

function load(): ClosureRow[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const list = JSON.parse(raw) as ClosureRow[]
    return list.map((r) => {
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
    })
  } catch {
    return []
  }
}

function save(rows: ClosureRow[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(rows))
  } catch {
    // ignore
  }
}

export function getRows(): ClosureRow[] {
  const rows = load()
  const active = rows.filter((r) => r.status !== 'closed').sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  const closed = rows.filter((r) => r.status === 'closed').sort((a, b) => new Date((b.closedAt ?? '').toString()).getTime() - new Date((a.closedAt ?? '').toString()).getTime())
  return [...active, ...closed]
}

/** يُستخدم عند الإغلاق لدمج أحدث البيانات من الـ state مع الـ storage */
export function getRowById(rowId: string): ClosureRow | null {
  const rows = load()
  return rows.find((r) => r.id === rowId) ?? null
}

export interface AddRowInitial {
  expenses: number
  expenseItems: { amount: number; description: string }[]
  carriedExpenseCount: number
}

export function addRow(employeeName: string, initial?: AddRowInitial): void {
  const rows = load()
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
  save(rows)
}

export function updateRow(rowId: string, patch: Partial<ClosureRow>): void {
  const rows = load()
  const i = rows.findIndex((r) => r.id === rowId)
  if (i === -1) return
  rows[i] = { ...rows[i]!, ...patch }
  save(rows)
}

export function closeRow(rowId: string, row: ClosureRow): void {
  const rows = load()
  const i = rows.findIndex((r) => r.id === rowId)
  if (i === -1) return
  const now = new Date().toISOString()
  rows[i] = {
    ...rows[i]!,
    ...row,
    status: 'closed',
    closedAt: now,
  }
  save(rows)
}

export function deleteRow(rowId: string): void {
  const rows = load().filter((r) => r.id !== rowId)
  save(rows)
}

export function deleteAllClosedRows(): void {
  const rows = load().filter((r) => r.status !== 'closed')
  save(rows)
}

export function getClosedForPrint(limit: number): ClosureRow[] {
  return load()
    .filter((r) => r.status === 'closed' && r.closedAt)
    .sort((a, b) => new Date((b.closedAt ?? '').toString()).getTime() - new Date((a.closedAt ?? '').toString()).getTime())
    .slice(0, limit)
}
