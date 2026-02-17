import { useCallback, useEffect, useRef, useState } from 'react'
import { getActiveRows, addRow, type Branch } from '../lib/storage'
import { getClosedRowsPaginated, type ClosedRowsPageResult } from '../lib/firebaseClosedRows'
import type { ClosureRow } from '../types'
import type { QueryDocumentSnapshot } from 'firebase/firestore'

const PAGE_1_LIMIT = 4
const PAGE_N_LIMIT = 5

/** تخزين صفحة: الصفوف + المؤشر لصفحة التالية */
type PageCache = { rows: ClosureRow[]; lastDoc: QueryDocumentSnapshot | null; hasMore: boolean }

/**
 * Logic: الصفوف النشطة من localStorage، المغلقة من Firebase بتقسيم صفحات.
 * الصفحة 1: 4 مغلقة. الصفحات 2+: 5 مغلقة. التخزين المحلي للصفحات المجلوبة.
 */
export function useCashBoxRows(name: string, branch: Branch) {
  const [activeRows, setActiveRows] = useState<ClosureRow[]>([])
  const [closedRows, setClosedRows] = useState<ClosureRow[]>([])
  const [currentClosedPage, setCurrentClosedPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [hasMoreClosedPages, setHasMoreClosedPages] = useState(false)
  const debounceRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  const rowDataRef = useRef<Record<string, ClosureRow>>({})
  /** تخزين محلي للصفحات المجلوبة من Firebase */
  const closedPagesCache = useRef<Map<number, PageCache>>(new Map())

  const rows = activeRows.length > 0 || closedRows.length > 0
    ? [
        ...activeRows.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
        ...closedRows,
      ].sort((a, b) => {
        if (a.status !== 'closed' && b.status === 'closed') return -1
        if (a.status === 'closed' && b.status !== 'closed') return 1
        if (a.status === 'closed' && b.status === 'closed') {
          return new Date((b.closedAt ?? '').toString()).getTime() - new Date((a.closedAt ?? '').toString()).getTime()
        }
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      })
    : []

  const loadClosedPage = useCallback(
    async (pageNum: number, forceRefresh = false): Promise<ClosedRowsPageResult | null> => {
      const cached = closedPagesCache.current.get(pageNum)
      if (cached && !forceRefresh) {
        setClosedRows(cached.rows)
        setHasMoreClosedPages(cached.hasMore)
        return cached
      }
      const limit = pageNum === 1 ? PAGE_1_LIMIT : PAGE_N_LIMIT
      let startAfterDoc: QueryDocumentSnapshot | null = null
      if (pageNum > 1) {
        const prevCache = closedPagesCache.current.get(pageNum - 1)
        startAfterDoc = prevCache?.lastDoc ?? null
      }
      const result = await getClosedRowsPaginated(branch, limit, startAfterDoc)
      closedPagesCache.current.set(pageNum, result)
      setClosedRows(result.rows)
      setHasMoreClosedPages(result.hasMore)
      return result
    },
    [branch]
  )

  const goToClosedPage = useCallback(
    async (pageNum: number) => {
      if (pageNum < 1) return
      setLoading(true)
      const prevCache = closedPagesCache.current.get(pageNum - 1)
      const needPrevPage = pageNum > 1 && !prevCache
      if (needPrevPage) {
        for (let p = 1; p < pageNum; p++) {
          const limit = p === 1 ? PAGE_1_LIMIT : PAGE_N_LIMIT
          const startAfter = p === 1 ? null : closedPagesCache.current.get(p - 1)?.lastDoc ?? null
          const res = await getClosedRowsPaginated(branch, limit, startAfter)
          closedPagesCache.current.set(p, res)
          if (!res.hasMore && p < pageNum - 1) break
        }
      }
      await loadClosedPage(pageNum)
      setCurrentClosedPage(pageNum)
      setLoading(false)
    },
    [branch, loadClosedPage]
  )

  const loadRows = useCallback(async () => {
    setLoading(true)
    const active = getActiveRows(branch)
    setActiveRows(active)
    closedPagesCache.current.clear()
    setCurrentClosedPage(1)
    const result = await loadClosedPage(1, true)
    const merged = [...active, ...(result?.rows ?? [])]
    merged.forEach((r) => {
      rowDataRef.current[r.id] = r
    })
    setLoading(false)
  }, [branch, loadClosedPage])

  const rowsRef = useRef<ClosureRow[]>([])
  rowsRef.current = rows

  const setRows = useCallback((updater: ClosureRow[] | ((prev: ClosureRow[]) => ClosureRow[])) => {
    const next = typeof updater === 'function' ? updater(rowsRef.current) : updater
    const active = next.filter((r) => r.status !== 'closed')
    const closed = next.filter((r) => r.status === 'closed')
    setActiveRows(active)
    setClosedRows(closed)
    next.forEach((r) => {
      rowDataRef.current[r.id] = r
    })
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const active = getActiveRows(branch)
      if (active.length === 0) {
        addRow(branch, name)
      }
      if (cancelled) return
      setLoading(true)
      setActiveRows(getActiveRows(branch))
      closedPagesCache.current.clear()
      setCurrentClosedPage(1)
      const result = await getClosedRowsPaginated(branch, PAGE_1_LIMIT)
      if (cancelled) return
      closedPagesCache.current.set(1, result)
      setClosedRows(result.rows)
      setHasMoreClosedPages(result.hasMore)
      const merged = [...getActiveRows(branch), ...result.rows]
      merged.forEach((r) => {
        rowDataRef.current[r.id] = r
      })
      setLoading(false)
    })()
    return () => {
      cancelled = true
      Object.values(debounceRef.current).forEach(clearTimeout)
      debounceRef.current = {}
    }
  }, [name, branch])

  return {
    rows,
    setRows,
    loadRows,
    loading,
    debounceRef,
    rowDataRef,
    currentClosedPage,
    setCurrentClosedPage,
    goToClosedPage,
    hasMoreClosedPages,
    closedPagesCache: closedPagesCache.current,
  }
}
