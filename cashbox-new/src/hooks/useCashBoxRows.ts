import { useCallback, useEffect, useRef, useState } from 'react'
import { getRows, addRow } from '../lib/storage'
import type { ClosureRow } from '../types'

/**
 * Logic: تحميل الصفوف من الـ storage، إضافة صف أول إن لم يوجد، وتنظيف الـ debounce عند الـ unmount.
 * (الرول: Logic in hooks)
 */
export function useCashBoxRows(name: string) {
  const [rows, setRows] = useState<ClosureRow[]>([])
  const debounceRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  const rowDataRef = useRef<Record<string, ClosureRow>>({})

  const loadRows = useCallback(() => {
    const newRows = getRows()
    setRows(newRows)
    newRows.forEach((r) => {
      rowDataRef.current[r.id] = r
    })
  }, [])

  useEffect(() => {
    loadRows()
    const list = getRows()
    if (list.length === 0) {
      addRow(name)
      loadRows()
    }
    return () => {
      Object.values(debounceRef.current).forEach(clearTimeout)
      debounceRef.current = {}
    }
  }, [name, loadRows])

  return { rows, setRows, loadRows, debounceRef, rowDataRef }
}
