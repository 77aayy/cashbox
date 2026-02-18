/**
 * الصفوف المغلقة فقط في Firebase Firestore
 * مسار: branches/{branch}/closedRows/{rowId}
 */
import { collection, doc, setDoc, getDocs, deleteDoc, query, orderBy, limit, startAfter } from 'firebase/firestore'
import type { QueryDocumentSnapshot, DocumentSnapshot } from 'firebase/firestore'
import { db } from './firebase'
import type { ClosureRow } from '../types'
import type { Branch } from './storage'

function closedRowsRef(branch: Branch) {
  return collection(db, 'branches', branch, 'closedRows')
}

function normalizeRow(r: ClosureRow): Record<string, unknown> {
  return {
    id: r.id,
    employeeName: r.employeeName,
    cash: r.cash,
    sentToTreasury: r.sentToTreasury ?? 0,
    expenseCompensation: r.expenseCompensation ?? 0,
    expenses: r.expenses ?? 0,
    carriedExpenseCount: r.carriedExpenseCount ?? 0,
    expenseItems: r.expenseItems ?? [],
    mada: r.mada ?? 0,
    visa: r.visa ?? 0,
    mastercard: r.mastercard ?? 0,
    amex: r.amex ?? 0,
    bankTransfer: r.bankTransfer ?? 0,
    programBalanceCash: r.programBalanceCash ?? 0,
    programBalanceBank: r.programBalanceBank ?? 0,
    variance: r.variance ?? 0,
    status: 'closed',
    notes: r.notes ?? '',
    closedAt: r.closedAt,
    createdAt: r.createdAt,
  }
}

function toClosureRow(data: Record<string, unknown>): ClosureRow {
  const expenseItems = Array.isArray(data.expenseItems)
    ? (data.expenseItems as { amount: number; description: string }[]).filter(
        (x) => typeof x.amount === 'number' && typeof x.description === 'string'
      )
    : []
  return {
    id: String(data.id ?? ''),
    employeeName: String(data.employeeName ?? ''),
    cash: Number(data.cash ?? 0),
    sentToTreasury: Number(data.sentToTreasury ?? 0),
    expenseCompensation: Number(data.expenseCompensation ?? 0),
    expenses: Number(data.expenses ?? 0),
    carriedExpenseCount: Number(data.carriedExpenseCount ?? 0),
    expenseItems,
    mada: Number(data.mada ?? 0),
    visa: Number(data.visa ?? 0),
    mastercard: Number(data.mastercard ?? 0),
    amex: Number(data.amex ?? 0),
    bankTransfer: Number(data.bankTransfer ?? 0),
    programBalanceCash: Number(data.programBalanceCash ?? 0),
    programBalanceBank: Number(data.programBalanceBank ?? 0),
    variance: Number(data.variance ?? 0),
    status: 'closed',
    notes: String(data.notes ?? ''),
    closedAt: data.closedAt ? String(data.closedAt) : null,
    createdAt: String(data.createdAt ?? ''),
  }
}

/** إضافة صف مغلق إلى Firebase — يُنفَّذ فور انتهاء مهلة الـ 10 ثوانٍ */
export async function addClosedRowToFirebase(branch: Branch, row: ClosureRow): Promise<void> {
  const ref = doc(db, 'branches', branch, 'closedRows', row.id)
  const data = normalizeRow({ ...row, status: 'closed', closedAt: row.closedAt ?? new Date().toISOString() })
  await setDoc(ref, data)
}

/** جلب الصفوف المغلقة من Firebase — مرتبة حسب تاريخ الإغلاق (الأحدث أولاً) — جلب كامل للطباعة وحذف الكل */
export async function getClosedRowsFromFirebase(branch: Branch, maxLimit = 500): Promise<ClosureRow[]> {
  const coll = closedRowsRef(branch)
  const snap = await getDocs(coll)
  const rows = snap.docs.map((d) => toClosureRow(d.data() as Record<string, unknown>))
  return rows
    .sort((a, b) => new Date((b.closedAt ?? '').toString()).getTime() - new Date((a.closedAt ?? '').toString()).getTime())
    .slice(0, maxLimit)
}

/** نتيجة جلب صفحة من الصفوف المغلقة */
export interface ClosedRowsPageResult {
  rows: ClosureRow[]
  lastDoc: QueryDocumentSnapshot | null
  hasMore: boolean
}

/**
 * جلب صفحة من الصفوف المغلقة (مرتبة حسب closedAt تنازلياً).
 * الصفحة الأولى: limit صفوف. الصفحات التالية: startAfter(lastDoc).
 */
export async function getClosedRowsPaginated(
  branch: Branch,
  pageLimit: number,
  startAfterDoc?: DocumentSnapshot | null
): Promise<ClosedRowsPageResult> {
  const coll = closedRowsRef(branch)
  const q = startAfterDoc
    ? query(coll, orderBy('closedAt', 'desc'), limit(pageLimit + 1), startAfter(startAfterDoc))
    : query(coll, orderBy('closedAt', 'desc'), limit(pageLimit + 1))
  const snap = await getDocs(q)
  const docs = snap.docs
  const hasMore = docs.length > pageLimit
  const slice = hasMore ? docs.slice(0, pageLimit) : docs
  const rows = slice.map((d) => toClosureRow(d.data() as Record<string, unknown>))
  const lastDoc = slice.length > 0 ? (slice[slice.length - 1] as QueryDocumentSnapshot) : null
  return { rows, lastDoc, hasMore }
}

/** حذف صف مغلق من Firebase */
export async function deleteClosedRowFromFirebase(branch: Branch, rowId: string): Promise<void> {
  await deleteDoc(doc(db, 'branches', branch, 'closedRows', rowId))
}
