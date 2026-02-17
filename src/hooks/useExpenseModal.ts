import { useCallback, useEffect, useRef, useState } from 'react'
import type { ClosureRow } from '../types'

export type ExpenseModalState = {
  rowId: string
  items: { amount: string; description: string }[]
  readOnly?: boolean
  carriedCount?: number
} | null

/**
 * Logic: نافذة تصنيف المصروفات — فتح/إغلاق، نبض حقل الوصف، والتركيز.
 * (الرول: Logic in hooks)
 */
export function useExpenseModal(
  rows: ClosureRow[],
  rowDataRef: React.MutableRefObject<Record<string, ClosureRow>>
) {
  const [expenseModal, setExpenseModal] = useState<ExpenseModalState>(null)
  const [pulseExpenseDescriptionIndex, setPulseExpenseDescriptionIndex] = useState<number | null>(null)
  const expenseAmountRef = useRef<Record<number, string>>({})
  const expenseModalFocusedRowIdRef = useRef<string | null>(null)
  const expenseModalRowIdRef = useRef<string | null>(null)
  expenseModalRowIdRef.current = expenseModal?.rowId ?? null

  const openExpenseDetails = useCallback((rowId: string) => {
    if (expenseModalRowIdRef.current === rowId) return
    expenseAmountRef.current = {}
    setPulseExpenseDescriptionIndex(null)
    const row = rows.find((r) => r.id === rowId) ?? rowDataRef.current[rowId]
    const currentExpenses = (row?.expenses as number) ?? 0
    let items: { amount: string; description: string }[] = row?.expenseItems?.length
      ? row.expenseItems.map((it) => ({ amount: String(it.amount), description: it.description || '' }))
      : [{ amount: currentExpenses ? String(currentExpenses) : '', description: '' }]
    const isNonEmpty = (it: { amount: string; description: string }) =>
      (Number(it.amount) || 0) !== 0 || String(it.description || '').trim() !== ''
    const originalCarriedCount = (row?.carriedExpenseCount ?? 0) as number
    const carriedNonEmptyCount = items.slice(0, originalCarriedCount).filter(isNonEmpty).length
    items = items.filter(isNonEmpty)
    let carriedCount = carriedNonEmptyCount
    const readOnly = row?.status === 'closed'
    if (!readOnly && items.length > 0) {
      const last = items[items.length - 1]!
      if (String(last.amount || '').trim() !== '' || String(last.description || '').trim() !== '') {
        const sumItems = items.reduce((s, it) => s + (Number(it.amount) || 0), 0)
        const diff = currentExpenses - sumItems
        const newRowAmount = diff > 0 ? String(diff) : ''
        items = [...items, { amount: newRowAmount, description: '' }]
      }
    }
    if (!readOnly && items.length === 0) {
      items = [{ amount: currentExpenses ? String(currentExpenses) : '', description: '' }]
    }
    setExpenseModal({ rowId, items, readOnly, carriedCount })
  }, [rows, rowDataRef])

  useEffect(() => {
    if (!expenseModal) expenseModalFocusedRowIdRef.current = null
  }, [expenseModal])

  useEffect(() => {
    if (pulseExpenseDescriptionIndex === null) return
    const t = setTimeout(() => setPulseExpenseDescriptionIndex(null), 3000)
    return () => clearTimeout(t)
  }, [pulseExpenseDescriptionIndex])

  return {
    expenseModal,
    setExpenseModal,
    pulseExpenseDescriptionIndex,
    setPulseExpenseDescriptionIndex,
    openExpenseDetails,
    expenseAmountRef,
    expenseModalFocusedRowIdRef,
  }
}
