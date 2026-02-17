import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { getRowById, addRow, updateRow, closeRow, deleteRow, deleteAllClosedRows, type Branch } from '../lib/storage'
import { getClosedRowsFromFirebase } from '../lib/firebaseClosedRows'
import { parseBankTransactionsExcel, type ExcelDetails } from '../lib/excelParser'
import { computeBankVariance, computeCashVariance, computeVariance, formatCurrency, formatDateTime, filterByPreset, getGreeting, toLatinDigits } from '../lib/utils'
import { ClosureRowComp } from '../components/ClosureRow'
import { Calculator, type TransferField } from '../components/Calculator'
import { CashCalculator } from '../components/CashCalculator'
import { BankOperationsCalculator } from '../components/BankOperationsCalculator'
import { Toast } from '../components/Toast'
import { useCashBoxRows } from '../hooks/useCashBoxRows'
import { useClosingCountdown } from '../hooks/useClosingCountdown'
import { useExpenseModal } from '../hooks/useExpenseModal'
import type { ClosureRow, FilterPreset } from '../types'
import type { ThemeMode } from '../App'
import { toggleTheme as doToggleTheme } from '../lib/theme'

const UNDO_SECONDS = 10
/** أقصى فرق (ريال) بين انحراف الكاش وانحراف البنك لاعتبارها "نفس القيمة" وتنبيه احتمال الخلط نقداً ↔ شبكة */
const VARIANCE_SWAP_TOLERANCE_SAR = 2

/** كود الأدمن من متغير البيئة — لا يُخزَّن في الكود. */
function getAdminCode(): string {
  return typeof import.meta.env.VITE_ADMIN_CODE === 'string' ? import.meta.env.VITE_ADMIN_CODE : ''
}

const FILTERS: { id: FilterPreset; label: string }[] = [
  { id: 'today', label: 'اليوم' },
  { id: 'yesterday', label: 'أمس' },
  { id: 'lastWeek', label: 'الأسبوع الماضي' },
]

const BRANCH_LABELS: Record<Branch, string> = {
  corniche: 'الكورنيش',
  andalusia: 'الأندلس',
}

interface CashBoxProps {
  name: string
  branch: Branch
  onExit: () => void
  onSwitchBranch: (newBranch: Branch) => void
  theme: ThemeMode
  onToggleTheme: () => void
}

function handleThemeToggle() {
  doToggleTheme()
}

export function CashBox({ name, branch, onExit, onSwitchBranch, theme, onToggleTheme: _onToggleTheme }: CashBoxProps) {
  const themeToggleRef = useRef<HTMLButtonElement>(null)
  const [switchBranchConfirm, setSwitchBranchConfirm] = useState<Branch | null>(null)
  const { rows, setRows, loadRows, loading, debounceRef, rowDataRef, currentClosedPage, goToClosedPage, hasMoreClosedPages } = useCashBoxRows(name, branch)
  const {
    liveNow,
    closingRowId,
    setClosingRowId,
    closingEndsAt,
    setClosingEndsAt,
    closingSecondsLeft,
    setClosingSecondsLeft,
  } = useClosingCountdown()

  const [filter, setFilter] = useState<FilterPreset>('today')
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' | 'warning' | 'info'; autoHideMs?: number } | null>(null)
  /** تأكيد الترحيل عندما يوجد رقم في الخانة (كاش أو مدى أو فيزا أو تحويل بنكي) */
  const [transferConfirm, setTransferConfirm] = useState<{ amount: number; currentValue: number; field: TransferField } | null>(null)
  /** تأكيد ترحيل العمليات البنكية (مدى/فيزا/ماستر) عند وجود قيم في الخانات */
  const [bankTransferConfirm, setBankTransferConfirm] = useState<{
    mada: number
    visa: number
    mastercard: number
    currentMada: number
    currentVisa: number
    currentMaster: number
  } | null>(null)
  /** صفوف محددة للطباعة */
  const [selectedRowIds, setSelectedRowIds] = useState<Set<string>>(new Set())
  /** حذف صف: خطوة التأكيد ثم إدخال كود الأدمن */
  const [deleteConfirm, setDeleteConfirm] = useState<{ rowId: string; step: 'confirm' | 'code' } | null>(null)
  const [deleteAllClosedConfirm, setDeleteAllClosedConfirm] = useState<{ step: 'confirm' | 'code' } | null>(null)
  /** حذف بند مرحّل من نافذة المصروفات: تأكيد + كود الأدمن */
  const [deleteCarriedConfirm, setDeleteCarriedConfirm] = useState<{ rowId: string; itemIndex: number; step: 'confirm' | 'code' } | null>(null)
  const [adminCodeInput, setAdminCodeInput] = useState('')
  const [showAdminCode, setShowAdminCode] = useState(false)
  /** رسالة خطأ تظهر داخل نافذة كود الأدمن عند إدخال كود خاطئ */
  const [adminCodeError, setAdminCodeError] = useState(false)
  /** تأكيد الإغلاق عند وجود انحراف: انحراف الكاش/البنك — نعم يبدأ العد، لا يكمل التعديل */
  const [closeConfirmVariance, setCloseConfirmVariance] = useState<{
    rowId: string
    cashVar: number
    bankVar: number
  } | null>(null)
  /** يُحدَّث عند انتهاء مهلة الإغلاق لتصفير الحاسبتين (سجل العمليات + حاسبة الكاش) للتجهيز لشفت جديد */
  const [calculatorsResetKey, setCalculatorsResetKey] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)
  /** تفاصيل آخر استيراد إكسل (عمليات مدى/فيزا/ماستر/تحويل) لعرضها عند النقر على المبلغ */
  const [lastExcelDetails, setLastExcelDetails] = useState<ExcelDetails | null>(null)
  /** قائمة أسماء الموظفين من آخر استيراد (عند "أكثر من موظف") لعرضها عند النقر */
  const [lastExcelEmployeeNamesList, setLastExcelEmployeeNamesList] = useState<string[]>([])
  /** نافذة سجل التغيير (من إكسل / مرحّل / معدّل يدوياً) لعمود في صف معيّن */
  const [excelDetailModal, setExcelDetailModal] = useState<{ field: keyof ExcelDetails; rowId: string } | null>(null)
  /** نافذة أسماء الموظفين (عند النقر على "أكثر من موظف") */
  const [showEmployeeNamesModal, setShowEmployeeNamesModal] = useState(false)
  /** نافذة شرح سبب انحراف الكاش أو البنك (نوع + الصف) */
  const [varianceExplanationModal, setVarianceExplanationModal] = useState<{ type: 'cash' | 'bank'; row: ClosureRow } | null>(null)
  /** تأكيد إفراغ الصف: عرض نعم/لا قبل الإفراغ */
  const [clearRowConfirmId, setClearRowConfirmId] = useState<string | null>(null)
  /** تأكيد التعديل اليدوي لخانة تستقبل بيانات من الإكسل (مدى/فيزا/ماستر/تحويل بنكي) */
  const [bankEditConfirm, setBankEditConfirm] = useState<{ rowId: string; field: keyof ClosureRow; oldValue: number; newValue: number } | null>(null)

  useEffect(() => {
    const btn = themeToggleRef.current
    if (!btn) return
    const handler = (e: Event) => {
      e.preventDefault()
      e.stopPropagation()
      e.stopImmediatePropagation()
      handleThemeToggle()
    }
    btn.addEventListener('click', handler, true)
    return () => btn.removeEventListener('click', handler, true)
  }, [])

  const {
    expenseModal,
    setExpenseModal,
    pulseExpenseDescriptionIndex,
    setPulseExpenseDescriptionIndex,
    openExpenseDetails,
    expenseAmountRef,
    expenseModalFocusedRowIdRef,
  } = useExpenseModal(rows, rowDataRef)

  useEffect(() => {
    if (closingRowId === null || closingSecondsLeft > 0) return
    const rowId = closingRowId
    const fromState = rows.find((x) => x.id === rowId)
    if (!fromState || fromState.status === 'closed') {
      setClosingRowId(null)
      setClosingEndsAt(null)
      return
    }
    setClosingRowId(null)
    setClosingEndsAt(null)
    ;(async () => {
      try {
        const pending = debounceRef.current[rowId]
        if (pending) {
          clearTimeout(pending)
          delete debounceRef.current[rowId]
          updateRow(branch, rowId, fromState)
        }
        const fromStorage = getRowById(branch, rowId)
        const merged = fromStorage
          ? { ...fromStorage, ...fromState, id: rowId, status: 'active' as const }
          : fromState
        const v = computeVariance(merged)
        await closeRow(branch, rowId, { ...merged, employeeName: name, variance: v })
        const closedExpenses = merged.expenses ?? 0
        const closedCompensation = merged.expenseCompensation ?? 0
        const netCarried = Math.max(0, closedExpenses - closedCompensation)
        const closedItems = merged.expenseItems ?? []
        const hasCompensation = closedCompensation > 0
        const carriedItems = hasCompensation
          ? (netCarried > 0 ? [{ amount: netCarried, description: 'مرحّل (صافي بعد التعويض)' }] : [])
          : closedItems.map((it) => ({ amount: it.amount, description: it.description || '' }))
        addRow(branch, name, {
          expenses: netCarried,
          expenseItems: carriedItems,
          carriedExpenseCount: carriedItems.length,
        })
        await loadRows()
        setToast({ msg: 'تم إغلاق الشفت وإضافة صف جديد', type: 'success' })
        setCalculatorsResetKey((k) => k + 1)
      } catch (e) {
        setToast({ msg: 'فشل ترحيل الصف المغلَق إلى السحابة — تحقق من الاتصال', type: 'error' })
      }
    })()
  }, [closingSecondsLeft, closingRowId, rows, name, loadRows, branch])

  const displayRows = useMemo(() => {
    const active = rows.filter((r) => r.status !== 'closed').sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    const closed = filterByPreset(
      rows.filter((r) => r.status === 'closed'),
      filter
    ).sort((a, b) => new Date((b.closedAt ?? '').toString()).getTime() - new Date((a.closedAt ?? '').toString()).getTime())
    // الصف النشط يظهر فقط عند فلتر "اليوم"
    if (filter === 'today') return [...active, ...closed]
    return closed
  }, [rows, filter])

  const visibleRows = displayRows
  const firstActiveId = useMemo(
    () => displayRows.find((r) => r.status !== 'closed')?.id ?? null,
    [displayRows]
  )

  /** أحدث صف مغلق (تاريخ إغلاقه = بداية فترة الصف النشط) */
  const lastClosedRow = useMemo(() => {
    const closed = rows.filter((r) => r.status === 'closed' && r.closedAt)
    if (closed.length === 0) return null
    return closed.sort((a, b) => new Date((b.closedAt ?? '').toString()).getTime() - new Date((a.closedAt ?? '').toString()).getTime())[0] ?? null
  }, [rows])

  const firstActiveRow = useMemo(() => rows.find((r) => r.status !== 'closed') ?? null, [rows])

  const canCloseShift = useMemo(() => {
    if (!firstActiveRow) return false
    const cash = (firstActiveRow.cash as number) ?? 0
    const programCash = (firstActiveRow.programBalanceCash as number) ?? 0
    const programBank = (firstActiveRow.programBalanceBank as number) ?? 0
    return cash > 0 && programCash > 0 && programBank > 0
  }, [firstActiveRow])

  const handleExcelUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      e.target.value = ''
      if (!file) return
      const active = firstActiveRow
      if (!active) {
        setToast({ msg: 'لا يوجد صف نشط لملء البيانات', type: 'warning' })
        return
      }
      let buffer: ArrayBuffer
      try {
        buffer = await file.arrayBuffer()
      } catch {
        setToast({ msg: 'تعذر قراءة الملف', type: 'error' })
        return
      }
      /** استخراج قيم من كل التقرير (بدون فلتر تاريخ) */
      const afterDate = new Date(0)
      const { sums, counts, details, employeeName: excelEmployeeName, employeeNamesList, error } = parseBankTransactionsExcel(buffer, afterDate)
      if (error) {
        setToast({ msg: error, type: 'error' })
        return
      }
      setLastExcelDetails(details)
      setLastExcelEmployeeNamesList(employeeNamesList ?? [])
      const pending = debounceRef.current[active.id]
      if (pending) {
        clearTimeout(pending)
        delete debounceRef.current[active.id]
        updateRow(branch, active.id, rowDataRef.current[active.id] ?? active)
      }
      const current = (rowDataRef.current[active.id] ?? active) as ClosureRow
      /** استخراج فقط: مدى، فيزا، ماستر كارد، تحويل بنكي — لا نغيّر الكاش من التقرير */
      const filled = {
        mada: sums.mada,
        visa: sums.visa,
        mastercard: sums.mastercard,
        bankTransfer: sums.bankTransfer,
      }
      const totalExtracted = sums.mada + sums.visa + sums.mastercard
      const employeeName = (excelEmployeeName && excelEmployeeName.trim() !== '') ? excelEmployeeName.trim() : current.employeeName
      const nextRow = { ...current, ...filled, employeeName, variance: computeVariance({ ...current, ...filled, employeeName }) }
      updateRow(branch, active.id, nextRow)
      rowDataRef.current[active.id] = nextRow
      setRows((prev) => prev.map((r) => (r.id === active.id ? nextRow : r)))
      loadRows()
      const parts: string[] = []
      if (counts.mada > 0) parts.push(`مدى ${formatCurrency(sums.mada)}`)
      if (counts.visa > 0) parts.push(`فيزا ${formatCurrency(sums.visa)}`)
      if (counts.mastercard > 0) parts.push(`ماستر كارد ${formatCurrency(sums.mastercard)}`)
      if (counts.bankTransfer > 0) parts.push(`تحويل بنكي ${formatCurrency(sums.bankTransfer)}`)
      const detail = parts.length > 0 ? parts.join(' — ') + ` — المجموع: ${formatCurrency(totalExtracted)}` : ''
      setToast({
        msg: totalExtracted > 0 ? `تم استخراج: ${detail}` : 'لم يُعثر على مدى/فيزا/ماستر كارد/تحويل بنكي في الملف',
        type: totalExtracted > 0 ? 'success' : 'info',
      })
    },
    [firstActiveRow, loadRows]
  )

  const handleUploadFilesClick = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  /** مسح المصروف وتصنيفه فقط عند النقر على الحقل وهو فيه قيمة — إبقاء البنود المرحلة من الشفت السابق، مسح البنود الحالية فقط */
  const clearExpensesAndOpenModal = useCallback((rowId: string) => {
    const pending = debounceRef.current[rowId]
    if (pending) {
      clearTimeout(pending)
      delete debounceRef.current[rowId]
    }
    const row = rows.find((r) => r.id === rowId)
    const carriedCount = (row?.carriedExpenseCount ?? 0) as number
    const keptItems = (row?.expenseItems ?? []).slice(0, carriedCount)
    const newExpenses = keptItems.reduce((s, it) => s + it.amount, 0)
    updateRow(branch, rowId, { expenses: newExpenses, expenseItems: keptItems })
    if (row) {
      const next = { ...row, expenses: newExpenses, expenseItems: keptItems, variance: computeVariance({ ...row, expenses: newExpenses, expenseItems: keptItems }) }
      rowDataRef.current[rowId] = next
      setRows((prev) => prev.map((x) => (x.id !== rowId ? x : next)))
    }
    loadRows()
    expenseAmountRef.current = {}
  }, [rows, loadRows])

  const updateExpenseModalItem = useCallback((index: number, field: 'amount' | 'description', value: number | string) => {
    setExpenseModal((m) =>
      m
        ? {
            ...m,
            items: m.items.map((it, i) =>
              i === index ? { ...it, [field]: field === 'amount' ? String(value) : String(value) } : it
            ),
          }
        : null
    )
  }, [])

  const addExpenseModalRow = useCallback(() => {
    expenseAmountRef.current = {}
    setExpenseModal((m) => (m ? { ...m, items: [...m.items, { amount: '', description: '' }] } : null))
  }, [])

  const removeExpenseModalRow = useCallback((index: number) => {
    setExpenseModal((m) => {
      if (!m) return m
      const carried = m.carriedCount ?? 0
      if (index < carried) return m
      if (m.items.length <= 1) return m
      expenseAmountRef.current = {}
      return { ...m, items: m.items.filter((_, i) => i !== index) }
    })
  }, [])

  const requestDeleteCarriedItem = useCallback((rowId: string, itemIndex: number) => {
    setAdminCodeInput('')
    setAdminCodeError(false)
    setDeleteCarriedConfirm({ rowId, itemIndex, step: 'confirm' })
  }, [])

  const confirmDeleteCarriedItem = useCallback(() => {
    if (!deleteCarriedConfirm) return
    setDeleteCarriedConfirm((d) => (d ? { ...d, step: 'code' } : null))
  }, [deleteCarriedConfirm])

  const submitDeleteCarriedWithCode = useCallback(() => {
    if (!deleteCarriedConfirm) return
    if (adminCodeInput.trim() !== getAdminCode()) {
      setAdminCodeError(true)
      setToast({ msg: 'كود الأدمن غير صحيح — أدخل الكود الصحيح وأعد المحاولة', type: 'error' })
      return
    }
    setAdminCodeError(false)
    const { rowId, itemIndex } = deleteCarriedConfirm
    const row = rows.find((r) => r.id === rowId) ?? rowDataRef.current[rowId]
    if (!row) {
      setDeleteCarriedConfirm(null)
      setAdminCodeInput('')
      return
    }
    const items = (row.expenseItems ?? []).slice()
    const carriedCount = row.carriedExpenseCount ?? 0
    if (itemIndex >= items.length || itemIndex >= carriedCount) {
      setDeleteCarriedConfirm(null)
      setAdminCodeInput('')
      return
    }
    items.splice(itemIndex, 1)
    const newCarriedCount = Math.max(0, carriedCount - 1)
    const newExpenses = items.reduce((s, it) => s + it.amount, 0)
    updateRow(branch, rowId, { expenseItems: items, expenses: newExpenses, carriedExpenseCount: newCarriedCount })
    const updatedRow = { ...row, expenseItems: items, expenses: newExpenses, carriedExpenseCount: newCarriedCount }
    rowDataRef.current[rowId] = updatedRow
    setRows((prev) => prev.map((r) => (r.id === rowId ? updatedRow : r)))
    setExpenseModal((m) => {
      if (!m || m.rowId !== rowId) return m
      const newItems = m.items.filter((_, i) => i !== itemIndex)
      return { ...m, items: newItems, carriedCount: newCarriedCount }
    })
    expenseAmountRef.current = {}
    loadRows()
    setDeleteCarriedConfirm(null)
    setAdminCodeInput('')
    setShowAdminCode(false)
    setToast({ msg: 'تم حذف البند المرحّل', type: 'success' })
  }, [deleteCarriedConfirm, adminCodeInput, rows, loadRows, updateRow])

  const saveExpenseModal = useCallback(() => {
    if (!expenseModal) return
    const rowId = expenseModal.rowId
    const carriedCount = expenseModal.carriedCount ?? 0
    const items = expenseModal.items.map((it, index) => {
      const rawAmount = expenseAmountRef.current[index] !== undefined ? expenseAmountRef.current[index] : String(it.amount ?? '')
      const amount = Number(String(rawAmount).replace(/,/g, '')) || 0
      return { amount, description: String(it.description || '').trim(), index }
    })
    const missingDesc = items.find((it) => it.index >= carriedCount && it.amount > 0 && !it.description)
    if (missingDesc) {
      setToast({ msg: 'يجب إدخال وصف لكل بند فيه مبلغ', type: 'warning' })
      setPulseExpenseDescriptionIndex(missingDesc.index)
      return
    }
    const finalItems = items.map(({ amount, description }) => ({ amount, description }))
    const total = finalItems.reduce((sum, it) => sum + it.amount, 0)
    updateRow(branch, rowId, { expenseItems: finalItems, expenses: total })
    setExpenseModal(null)
    loadRows()
    // بعد إغلاق النافذة: تخطي رصيد البرنامج كاش [4] ونقل التركيز لأول حقل مفعّل بعده (مدى فما بعد)
    requestAnimationFrame(() => {
      setTimeout(() => {
        const inputs = document.querySelectorAll<HTMLInputElement>(
          `tr[data-row-id="${rowId}"] input.cashbox-input`
        )
        let target = inputs[5] ?? inputs[0]
        for (let i = 5; i < inputs.length; i++) {
          if (!inputs[i].disabled) {
            target = inputs[i]
            break
          }
        }
        target?.focus()
      }, 0)
    })
  }, [expenseModal, loadRows, updateRow])

  const handleLockedFieldClick = useCallback(() => {
    setToast({ msg: 'يجب إدخال رصيد البرنامج كاش أولاً', type: 'warning' })
  }, [])

  const handleExpenseCompensationExceeded = useCallback((maxAllowed: number) => {
    setToast({
      msg: `تعويض المصروفات يجب ألا يتخطى مبلغ المصروفات (المصروفات: ${formatCurrency(maxAllowed)})`,
      type: 'warning',
    })
  }, [])

  const handleClearRow = useCallback(
    (id: string) => {
      const r = rows.find((x) => x.id === id)
      if (!r || r.status === 'closed') return
      const patch: Partial<ClosureRow> = {
        cash: 0,
        sentToTreasury: 0,
        expenseCompensation: 0,
        expenses: 0,
        expenseItems: [],
        carriedExpenseCount: 0,
        mada: 0,
        visa: 0,
        mastercard: 0,
        bankTransfer: 0,
        programBalanceCash: 0,
        programBalanceBank: 0,
        variance: 0,
      }
      updateRow(branch, id, patch)
      flushSync(() => {
        setRows((prev) => {
          const next = prev.map((x) => (x.id !== id ? x : { ...x, ...patch }))
          const updated = next.find((x) => x.id === id)
          if (updated) rowDataRef.current[id] = updated
          return next
        })
      })
      loadRows()
      setClearRowConfirmId(null)
      setCalculatorsResetKey((k) => k + 1)
      setToast({ msg: 'تم إفراغ كل المدخلات في الصف النشط ومسح سجلات الحاسبات', type: 'success' })
    },
    [rows, loadRows]
  )

  const confirmClearRowYes = useCallback(() => {
    if (clearRowConfirmId) {
      handleClearRow(clearRowConfirmId)
    }
  }, [clearRowConfirmId, handleClearRow])

  const confirmClearRowNo = useCallback(() => {
    setClearRowConfirmId(null)
  }, [])

  const handleUpdate = useCallback(
    (id: string, field: keyof ClosureRow, value: number | string) => {
      const r = rows.find((x) => x.id === id)
      if (!r || r.status === 'closed') return
      const patch: Partial<ClosureRow> = { [field]: value }
      if (field === 'expenses' && typeof value === 'number') {
        const comp = (r.expenseCompensation as number) ?? 0
        if (value < comp) patch.expenseCompensation = value
      }
      const numField = NUM_FIELDS.includes(field as (typeof NUM_FIELDS)[number])
      if (numField) {
        const next = { ...r, ...patch }
        patch.variance = computeVariance(next)
      }
      const prev = debounceRef.current[id]
      if (prev) clearTimeout(prev)
      debounceRef.current[id] = setTimeout(() => {
        const fullRow = rowDataRef.current[id]
        if (fullRow) updateRow(branch, id, fullRow)
        loadRows()
      }, 400)
      flushSync(() => {
        setRows((prev) => {
          const next = prev.map((x) => (x.id !== id ? x : { ...x, ...patch }))
          const updated = next.find((x) => x.id === id)
          if (updated) rowDataRef.current[id] = updated
          return next
        })
      })
    },
    [rows, loadRows]
  )

  const handleCloseShift = useCallback((rowId: string) => {
    const r = rows.find((x) => x.id === rowId)
    if (!r || r.status !== 'active') return
    const cashVar = computeCashVariance(r)
    const bankVar = computeBankVariance(r)
    if (cashVar !== 0 || bankVar !== 0) {
      setCloseConfirmVariance({ rowId, cashVar, bankVar })
      return
    }
    setToast({ msg: 'الصندوق مظبوط — تم عمل جيد ✓', type: 'success' })
    setClosingRowId(rowId)
    setClosingEndsAt(Date.now() + UNDO_SECONDS * 1000)
    setClosingSecondsLeft(UNDO_SECONDS)
  }, [rows])

  const confirmCloseWithVariance = useCallback(() => {
    if (!closeConfirmVariance) return
    const { rowId } = closeConfirmVariance
    setCloseConfirmVariance(null)
    setClosingRowId(rowId)
    setClosingEndsAt(Date.now() + UNDO_SECONDS * 1000)
    setClosingSecondsLeft(UNDO_SECONDS)
  }, [closeConfirmVariance])

  const cancelCloseWithVariance = useCallback(() => {
    setCloseConfirmVariance(null)
  }, [])

  const handleUndoClose = useCallback(() => {
    setClosingRowId(null)
    setClosingEndsAt(null)
    setClosingSecondsLeft(0)
    setToast({ msg: 'تم التراجع — يمكنك تعديل الصف', type: 'info' })
  }, [])

  const printRows = useCallback(
    (list: ClosureRow[], title: string, opts?: { firstActiveId: string | null; currentUserName: string; branchLabel: string }) => {
      if (list.length === 0) {
        setToast({ msg: 'لا توجد تقفيلات للطباعة', type: 'warning' })
        return
      }
      const win = window.open('', '_blank', 'width=800,height=900')
      if (!win) {
        setToast({ msg: 'السماح بالنوافذ المنبثقة للطباعة', type: 'warning' })
        return
      }
      const { firstActiveId: optsFirstActiveId, currentUserName, branchLabel } = opts ?? {}
      const branchLabelHtml = branchLabel ? `<p class="page-branch">فرع ${branchLabel.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</p>` : ''
      const pagesHtml = list
        .map((r, idx) => {
          const rawName = r.status === 'closed' ? r.employeeName : (optsFirstActiveId && r.id === optsFirstActiveId && currentUserName ? currentUserName : r.employeeName)
          const employeeNameForPrint = (rawName ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
          const bankTotal = r.mada + r.visa + r.mastercard
          const bankVariance = computeBankVariance(r)
          const cashVariance = computeCashVariance(r)
          const expenses = (r as { expenses?: number }).expenses ?? 0
          const expenseComp = (r as { expenseCompensation?: number }).expenseCompensation ?? 0
          const sentToTreasury = (r as { sentToTreasury?: number }).sentToTreasury ?? 0
          const items = (r as { expenseItems?: { amount: number; description: string }[] }).expenseItems ?? []
          const cashVarClass = cashVariance > 0 ? 'variance pos' : cashVariance < 0 ? 'variance neg' : 'variance'
          const bankVarClass = bankVariance > 0 ? 'variance pos' : bankVariance < 0 ? 'variance neg' : 'variance'
          const expenseDetails =
            items.length > 0
              ? `<div class="block expenses-detail">
                  <div class="block-title">تفاصيل المصروفات</div>
                  <div class="block-body">${items.map((it) => `<div class="expense-item">${formatCurrency(it.amount)} — ${(it.description || '—').replace(/</g, '&lt;')}</div>`).join('')}</div>
                </div>`
              : ''
          const notesHtml = (r.notes || '').trim() ? `<div class="block notes-block"><div class="block-title">ملاحظات</div><div class="block-body">${(r.notes || '').replace(/</g, '&lt;')}</div></div>` : ''
          const pageBreakStyle = (idx > 0 ? 'page-break-before: always;' : '') + (idx < list.length - 1 ? 'page-break-after: always;' : '')
          return `
            <div class="page" ${pageBreakStyle ? `style="${pageBreakStyle}"` : ''}>
              <header class="page-header">
                <h1 class="page-title">تقرير تقفيلة</h1>
                ${branchLabelHtml}
                <p class="page-sub">${employeeNameForPrint}</p>
                <p class="page-time">${r.closedAt ? formatDateTime(r.closedAt) : '—'}</p>
              </header>
              <div class="grid">
                <div class="block cash-block">
                  <div class="block-title">الكاش</div>
                  <div class="block-body">
                    <div class="row"><span class="label">كاش</span><span class="val">${formatCurrency(r.cash)}</span></div>
                    <div class="row"><span class="label">مرسل للخزنة</span><span class="val">${formatCurrency(sentToTreasury)}</span></div>
                    <div class="row"><span class="label">المصروفات</span><span class="val">${formatCurrency(expenses)}</span></div>
                    <div class="row"><span class="label">تعويض مصروفات</span><span class="val">${formatCurrency(expenseComp)}</span></div>
                    <div class="row"><span class="label">رصيد البرنامج كاش</span><span class="val">${formatCurrency(r.programBalanceCash)}</span></div>
                    <div class="row highlight variance-row"><span class="label">انحراف الكاش</span><span class="val ${cashVarClass}">${formatCurrency(cashVariance)}</span></div>
                  </div>
                </div>
                <div class="block bank-block">
                  <div class="block-title">البنك</div>
                  <div class="block-body">
                    <div class="row"><span class="label">مدى</span><span class="val">${formatCurrency(r.mada)}</span></div>
                    <div class="row"><span class="label">فيزا</span><span class="val">${formatCurrency(r.visa)}</span></div>
                    <div class="row"><span class="label">ماستر كارد</span><span class="val">${formatCurrency(r.mastercard)}</span></div>
                    <div class="row"><span class="label">تحويل بنكي</span><span class="val">${formatCurrency(r.bankTransfer)}</span></div>
                    <div class="row"><span class="label">بنك نزيل (مدى+فيزا+ماستر)</span><span class="val total">${formatCurrency(bankTotal)}</span></div>
                    <div class="row"><span class="label">اجمالى الموازنه</span><span class="val">${formatCurrency((r.programBalanceBank as number) ?? 0)}</span></div>
                    <div class="row highlight variance-row"><span class="label">انحراف البنك</span><span class="val ${bankVarClass}">${formatCurrency(bankVariance)}</span></div>
                  </div>
                </div>
              </div>
              ${expenseDetails}
              ${notesHtml}
              <footer class="page-footer">
                <p class="footer-formulas">بنك نزيل = مدى + فيزا + ماستر كارد (تحويل بنكي للعرض فقط) — انحراف البنك = بنك نزيل − اجمالى الموازنه — انحراف الكاش = (كاش + مرسل للخزنة + مصروفات فعّالة) − رصيد البرنامج كاش</p>
                <p>${branchLabel ? `فرع ${branchLabel} — ` : ''}تاريخ الطباعة: ${formatDateTime(new Date())} ${list.length > 1 ? ` — تقفيلة ${idx + 1} من ${list.length}` : ''}</p>
              </footer>
            </div>`
        })
        .join('')
      win.document.write(`
        <!DOCTYPE html>
        <html dir="rtl" lang="ar">
          <head>
            <meta charset="utf-8">
            <title>${branchLabel ? `${title} — فرع ${branchLabel}` : title}</title>
            <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&display=swap" rel="stylesheet">
            <style>
              * { box-sizing: border-box; margin: 0; padding: 0; }
              @page { size: A4 portrait; margin: 10mm; }
              html, body {
                font-family: 'Cairo', sans-serif;
                background: #fff;
                color: #1e293b;
                font-size: 11px;
                line-height: 1.25;
                padding: 8px;
                margin: 0;
                height: auto;
              }
              @media print {
                html, body {
                  padding: 0 !important;
                  margin: 0 !important;
                  height: auto !important;
                  min-height: unset !important;
                  overflow: visible !important;
                  background: #fff;
                  font-size: 10px !important;
                }
                .page {
                  box-shadow: none !important;
                  margin: 0 auto !important;
                  min-height: 0 !important;
                  height: auto !important;
                  page-break-inside: avoid;
                }
                .page:last-child { page-break-after: avoid !important; }
              }
              .page {
                width: 100%;
                max-width: 210mm;
                margin: 0 auto 12px;
                padding: 0 8px 10px;
                background: #fff;
                box-shadow: 0 2px 8px rgba(0,0,0,0.06);
              }
              .page-header {
                text-align: center;
                padding: 8px 0 6px;
                border-bottom: 1px solid #0f172a;
                margin-bottom: 8px;
              }
              .page-title {
                font-size: 1.15rem;
                font-weight: 700;
                color: #0f172a;
                margin-bottom: 2px;
              }
              .page-sub {
                font-size: 0.95rem;
                font-weight: 600;
                color: #334155;
                margin-bottom: 1px;
              }
              .page-time {
                font-size: 0.8rem;
                color: #64748b;
              }
              .page-branch {
                font-size: 0.9rem;
                font-weight: 700;
                color: #0f172a;
                margin-bottom: 2px;
              }
              .grid {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 10px;
                margin-bottom: 8px;
              }
              .block {
                border: 1px solid #e2e8f0;
                border-radius: 4px;
                overflow: hidden;
              }
              .block-title {
                background: #f1f5f9;
                padding: 4px 8px;
                font-weight: 700;
                font-size: 0.8rem;
                color: #334155;
                border-bottom: 1px solid #e2e8f0;
              }
              .block-body {
                padding: 4px 8px;
                background: #fff;
              }
              .block .row {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 2px 0;
                border-bottom: 1px solid #f1f5f9;
                font-size: 0.8rem;
              }
              .block .row:last-child { border-bottom: none; }
              .block .row.highlight { font-weight: 700; background: #f8fafc; margin: 2px -8px -2px; padding: 4px 8px; }
              .block .row.variance-row {
                margin: 4px -8px -2px;
                padding: 6px 8px;
                background: #f1f5f9;
                border-top: 1px solid #cbd5e1;
                font-size: 0.9rem;
              }
              .block .row.variance-row .label {
                font-size: 0.9rem;
                font-weight: 800;
                color: #0f172a;
              }
              .block .row.variance-row .val { font-size: 0.9rem; font-weight: 800; }
              .block .label { color: #475569; }
              .block .val {
                font-variant-numeric: tabular-nums;
                font-weight: 500;
                color: #0f172a;
              }
              .block .val.total { font-weight: 700; }
              .block .val.variance.pos { color: #059669; }
              .block .val.variance.neg { color: #dc2626; }
              .expenses-detail, .notes-block {
                margin-top: 6px;
                border: 1px solid #e2e8f0;
                border-radius: 4px;
                overflow: hidden;
              }
              .expenses-detail .block-title, .notes-block .block-title {
                padding: 3px 8px;
                font-size: 0.75rem;
              }
              .expenses-detail .block-body, .notes-block .block-body {
                padding: 3px 8px;
              }
              .expense-item {
                padding: 2px 8px;
                font-size: 0.75rem;
                border-bottom: 1px solid #f1f5f9;
              }
              .expense-item:last-child { border-bottom: none; }
              .page-footer {
                margin-top: 8px;
                padding-top: 6px;
                border-top: 1px solid #e2e8f0;
                font-size: 0.7rem;
                color: #64748b;
                text-align: center;
              }
              .page-footer .footer-formulas {
                font-size: 0.6rem;
                color: #94a3b8;
                margin-bottom: 3px;
                line-height: 1.3;
              }
            </style>
          </head>
          <body>
            ${pagesHtml}
            <script>setTimeout(function(){ window.print(); window.close(); }, 350);</script>
          </body>
        </html>
      `)
      win.document.close()
    },
    []
  )

  const handlePrintAll = useCallback(async () => {
    const limit = filter === 'today' ? 50 : filter === 'yesterday' ? 100 : 200
    const closed = await getClosedRowsFromFirebase(branch, limit)
    const list = filterByPreset(closed, filter)
    printRows(list, `تقرير التقفيلات — ${filter === 'today' ? 'اليوم' : filter === 'yesterday' ? 'أمس' : 'الأسبوع الماضي'}`, { firstActiveId, currentUserName: name, branchLabel: BRANCH_LABELS[branch] })
  }, [filter, printRows, firstActiveId, name, branch])

  const toggleRowSelection = useCallback((id: string) => {
    setSelectedRowIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const handlePrintSelected = useCallback(() => {
    if (selectedRowIds.size === 0) {
      setToast({ msg: 'لم تحدد أي صفوف للطباعة', type: 'warning' })
      return
    }
    const list = displayRows.filter((r) => selectedRowIds.has(r.id))
    printRows(list, 'طباعة الصفوف المحددة', { firstActiveId, currentUserName: name, branchLabel: BRANCH_LABELS[branch] })
  }, [selectedRowIds, displayRows, printRows, firstActiveId, name, branch])

  const handlePrintRow = useCallback(
    (rowId: string) => {
      const row = displayRows.find((r) => r.id === rowId)
      if (!row) return
      printRows([row], 'طباعة تقفيلة', { firstActiveId, currentUserName: name, branchLabel: BRANCH_LABELS[branch] })
    },
    [displayRows, printRows, firstActiveId, name, branch]
  )

  const requestDeleteRow = useCallback((rowId: string) => {
    setAdminCodeInput('')
    setAdminCodeError(false)
    setDeleteConfirm({ rowId, step: 'confirm' })
  }, [])

  const confirmDeleteRow = useCallback(() => {
    if (!deleteConfirm) return
    setDeleteConfirm((d) => (d ? { ...d, step: 'code' } : null))
  }, [deleteConfirm])

  const submitDeleteWithCode = useCallback(async () => {
    if (!deleteConfirm) return
    if (adminCodeInput.trim() !== getAdminCode()) {
      setAdminCodeError(true)
      setToast({ msg: 'كود الأدمن غير صحيح — أدخل الكود الصحيح وأعد المحاولة', type: 'error' })
      return
    }
    setAdminCodeError(false)
    const row = rows.find((r) => r.id === deleteConfirm.rowId)
    const isClosed = row?.status === 'closed'
    await deleteRow(branch, deleteConfirm.rowId, isClosed)
    setSelectedRowIds((prev) => {
      const next = new Set(prev)
      next.delete(deleteConfirm.rowId)
      return next
    })
    await loadRows()
    setDeleteConfirm(null)
    setAdminCodeInput('')
    setShowAdminCode(false)
    setToast({ msg: 'تم حذف الصف', type: 'success' })
  }, [deleteConfirm, adminCodeInput, loadRows, branch, rows])

  const requestDeleteAllClosed = useCallback(() => {
    setAdminCodeInput('')
    setAdminCodeError(false)
    setDeleteAllClosedConfirm({ step: 'confirm' })
  }, [])

  const confirmDeleteAllClosed = useCallback(() => {
    if (!deleteAllClosedConfirm) return
    setDeleteAllClosedConfirm((d) => (d ? { ...d, step: 'code' } : null))
  }, [deleteAllClosedConfirm])

  const submitDeleteAllClosedWithCode = useCallback(async () => {
    if (!deleteAllClosedConfirm) return
    if (adminCodeInput.trim() !== getAdminCode()) {
      setAdminCodeError(true)
      setToast({ msg: 'كود الأدمن غير صحيح — أدخل الكود الصحيح وأعد المحاولة', type: 'error' })
      return
    }
    setAdminCodeError(false)
    await deleteAllClosedRows(branch)
    setSelectedRowIds(new Set())
    await loadRows()
    setDeleteAllClosedConfirm(null)
    setAdminCodeInput('')
    setShowAdminCode(false)
    setToast({ msg: 'تم حذف كل التقفيلات المغلقة', type: 'success' })
  }, [deleteAllClosedConfirm, adminCodeInput, loadRows, branch])

  const transferFieldLabel = (f: TransferField) =>
    f === 'cash' ? 'الكاش' : f === 'programBalanceBank' ? 'اجمالى الموازنه' : f === 'mada' ? 'مدى' : f === 'visa' ? 'فيزا' : f === 'mastercard' ? 'ماستر كارد' : 'تحويل بنكي'

  const handleApplyCashToRow = useCallback(
    (total: number) => {
      if (!firstActiveId) {
        setToast({ msg: 'لا يوجد صف نشط لترحيل الكاش إليه', type: 'warning' })
        return
      }
      const activeRow = rows.find((r) => r.id === firstActiveId)
      const currentCash = activeRow?.cash ?? 0
      if (currentCash > 0) {
        setTransferConfirm({ amount: total, currentValue: currentCash, field: 'cash' })
        return
      }
      handleUpdate(firstActiveId, 'cash', total)
      setToast({ msg: `تم ترحيل ${formatCurrency(total)} إلى خانة الكاش`, type: 'success' })
    },
    [firstActiveId, rows, handleUpdate]
  )

  const handleTransferFromBankOps = useCallback(
    (mada: number, visa: number, mastercard: number) => {
      if (!firstActiveId) {
        setToast({ msg: 'لا يوجد صف نشط لترحيل العمليات البنكية إليه', type: 'warning' })
        return
      }
      const activeRow = rows.find((r) => r.id === firstActiveId)
      if (!activeRow) return
      const curMada = (activeRow.mada as number) ?? 0
      const curVisa = (activeRow.visa as number) ?? 0
      const curMaster = (activeRow.mastercard as number) ?? 0
      const needConfirm = (curMada > 0 && mada > 0) || (curVisa > 0 && visa > 0) || (curMaster > 0 && mastercard > 0)
      if (needConfirm) {
        setBankTransferConfirm({
          mada,
          visa,
          mastercard,
          currentMada: curMada,
          currentVisa: curVisa,
          currentMaster: curMaster,
        })
        return
      }
      handleUpdate(firstActiveId, 'mada', curMada + mada)
      handleUpdate(firstActiveId, 'visa', curVisa + visa)
      handleUpdate(firstActiveId, 'mastercard', curMaster + mastercard)
      const parts: string[] = []
      if (mada > 0) parts.push(`مدى ${formatCurrency(mada)}`)
      if (visa > 0) parts.push(`فيزا ${formatCurrency(visa)}`)
      if (mastercard > 0) parts.push(`ماستر ${formatCurrency(mastercard)}`)
      setToast({ msg: `تم ترحيل العمليات البنكية: ${parts.join('، ') || '—'}`, type: 'success' })
    },
    [firstActiveId, rows, handleUpdate]
  )

  const handleBankTransferConfirmYes = useCallback(() => {
    if (!bankTransferConfirm || !firstActiveId) return
    const { mada, visa, mastercard, currentMada, currentVisa, currentMaster } = bankTransferConfirm
    handleUpdate(firstActiveId, 'mada', currentMada + mada)
    handleUpdate(firstActiveId, 'visa', currentVisa + visa)
    handleUpdate(firstActiveId, 'mastercard', currentMaster + mastercard)
    const parts: string[] = []
    if (mada > 0) parts.push(`مدى ${formatCurrency(mada)}`)
    if (visa > 0) parts.push(`فيزا ${formatCurrency(visa)}`)
    if (mastercard > 0) parts.push(`ماستر ${formatCurrency(mastercard)}`)
    setToast({ msg: `تم ترحيل العمليات البنكية: ${parts.join('، ') || '—'}`, type: 'success' })
    setBankTransferConfirm(null)
  }, [bankTransferConfirm, firstActiveId, handleUpdate])

  const handleBankTransferConfirmNo = useCallback(() => {
    setBankTransferConfirm(null)
  }, [])

  const handleBankEditConfirmYes = useCallback(() => {
    if (!bankEditConfirm) return
    handleUpdate(bankEditConfirm.rowId, bankEditConfirm.field, bankEditConfirm.newValue)
    const label = transferFieldLabel(bankEditConfirm.field as TransferField)
    setToast({ msg: `تم تعديل ${label} إلى ${formatCurrency(bankEditConfirm.newValue)}`, type: 'success' })
    setBankEditConfirm(null)
  }, [bankEditConfirm, handleUpdate])

  const handleBankEditConfirmNo = useCallback(() => {
    setBankEditConfirm(null)
  }, [])

  const handleTransferConfirmYes = useCallback(() => {
    if (!transferConfirm || !firstActiveId) return
    handleUpdate(firstActiveId, transferConfirm.field, transferConfirm.amount)
    setToast({ msg: `تم ترحيل ${formatCurrency(transferConfirm.amount)} إلى ${transferFieldLabel(transferConfirm.field)}`, type: 'success' })
    setTransferConfirm(null)
  }, [transferConfirm, firstActiveId, handleUpdate])

  const handleTransferConfirmNo = useCallback(() => {
    setTransferConfirm(null)
  }, [])

  const handleTransferFromCalculator = useCallback(
    (amount: number, field: TransferField) => {
      if (!firstActiveId) {
        setToast({ msg: 'لا يوجد صف نشط لترحيل إليه', type: 'warning' })
        return
      }
      const activeRow = rows.find((r) => r.id === firstActiveId)
      const currentValue = activeRow ? (activeRow[field] as number) ?? 0 : 0
      if (currentValue > 0) {
        setTransferConfirm({ amount, currentValue, field })
        return
      }
      handleUpdate(firstActiveId, field, amount)
      setToast({ msg: `تم ترحيل ${formatCurrency(amount)} إلى ${transferFieldLabel(field)}`, type: 'success' })
    },
    [firstActiveId, rows, handleUpdate]
  )

  return (
    <div className="min-h-screen min-h-[100dvh] page-bg-warm dark:bg-slate-900 text-stone-900 dark:text-slate-200 font-cairo page-bg-pattern flex flex-col">
      <header className="sticky top-0 z-40 border-b border-stone-300 dark:border-white/10 bg-stone-50 dark:bg-slate-900/95 backdrop-blur shadow-sm safe-top">
        <div className="mx-auto w-full max-w-[100%] max-w-7xl lg:max-w-[1400px] xl:max-w-[1600px] px-3 sm:px-4 py-2 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {(() => {
              const { label, kind } = getGreeting(liveNow)
              const iconClass = 'w-4 h-4 shrink-0'
              const icons: Record<string, JSX.Element> = {
                morning: (
                  <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <circle cx="12" cy="12" r="4.5" />
                    <path d="M12 2v1.5M12 20.5V22M4.22 4.22l1.06 1.06M18.72 18.72l1.06 1.06M2 12h1.5M20.5 12H22M4.22 19.78l1.06-1.06M18.72 5.28l1.06-1.06" />
                  </svg>
                ),
                noon: (
                  <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <circle cx="12" cy="12" r="4.5" />
                    <path d="M12 2.5v2M12 19.5V22M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M2.5 12H5M19 12h2.5M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
                    <path d="M12 7.5v4l2.5 2.5" strokeWidth="1.8" />
                  </svg>
                ),
                evening: (
                  <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                    <path d="M12 2v3M12 19v3M3.5 12H6.5M17.5 12h3M4.93 4.93l2.12 2.12M16.95 16.95l2.12 2.12M4.93 19.07l2.12-2.12M16.95 7.05l2.12-2.12" strokeWidth="1.2" opacity="0.7" />
                  </svg>
                ),
                night: (
                  <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                  </svg>
                ),
              }
              const isNight = kind === 'night'
              return (
                <h1 className="flex items-center gap-1.5 sm:gap-2 py-1.5 px-2 sm:px-3 rounded-lg sm:rounded-xl border border-stone-300 dark:border-white/10 bg-stone-200 dark:bg-slate-800/50 shadow-sm dark:shadow-[0_2px_8px_rgba(0,0,0,0.2)]">
                  <span className={`flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 rounded-lg shrink-0 ${isNight ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300' : 'bg-teal-100 text-teal-700 dark:bg-amber-500/15 dark:text-amber-400'}`}>
                    {icons[kind]}
                  </span>
                  <span className="text-xs sm:text-sm font-semibold text-stone-800 dark:text-slate-200 tracking-tight flex items-center gap-1 min-w-0 truncate max-w-[120px] sm:max-w-none">
                    <span className={isNight ? 'text-indigo-700 dark:text-indigo-300/90' : 'text-teal-700 dark:text-amber-400/95'}>{label}</span>
                    <span className="text-stone-600 dark:text-slate-400 font-normal">،</span>
                    <span className="text-stone-600 dark:text-slate-400 text-xs font-cairo text-right">{name}</span>
                  </span>
                </h1>
              )
            })()}
            <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-teal-100 dark:bg-amber-500/15 text-teal-800 dark:text-amber-300 text-xs font-cairo font-semibold border border-teal-300 dark:border-amber-500/30">
              فرع {BRANCH_LABELS[branch]}
            </span>
            <div className="relative z-[50] rounded-xl border border-stone-300 dark:border-slate-600/50 bg-stone-200 dark:bg-slate-800/60 px-1.5 py-1 shadow-sm dark:shadow-[0_2px_6px_rgba(0,0,0,0.15)]">
              <button
                ref={themeToggleRef}
                type="button"
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  handleThemeToggle()
                }}
                className="flex items-center justify-center w-9 h-9 rounded-lg text-stone-700 hover:text-teal-600 hover:bg-teal-500/15 dark:text-slate-400 dark:hover:text-teal-400 dark:hover:bg-teal-500/10 transition cursor-pointer select-none touch-manipulation"
                title={theme === 'dark' ? 'الوضع الفاتح' : 'الوضع الداكن'}
                aria-label={theme === 'dark' ? 'الوضع الفاتح' : 'الوضع الداكن'}
              >
                {theme === 'dark' ? (
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg>
                ) : (
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
                )}
              </button>
            </div>
            <div className="rounded-xl border border-stone-300 dark:border-slate-600/50 bg-stone-200 dark:bg-slate-800/60 px-1.5 py-1 shadow-sm dark:shadow-[0_2px_6px_rgba(0,0,0,0.15)]">
              <button
                type="button"
                onClick={() => setSwitchBranchConfirm(branch === 'corniche' ? 'andalusia' : 'corniche')}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-stone-800 hover:text-teal-600 hover:bg-teal-500/15 dark:text-slate-400 dark:hover:text-amber-400 dark:hover:bg-amber-500/10 text-xs font-cairo transition"
                title="تغيير الفرع"
              >
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                  <polyline points="9 22 9 12 15 12 15 22" />
                </svg>
                <span>تغيير الفرع</span>
              </button>
            </div>
            <div className="rounded-xl border border-stone-300 dark:border-slate-600/50 bg-stone-200 dark:bg-slate-800/60 px-1.5 py-1 shadow-sm dark:shadow-[0_2px_6px_rgba(0,0,0,0.15)]">
              <button
                type="button"
                onClick={onExit}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-red-600 hover:text-red-700 hover:bg-red-500/15 dark:text-red-400 dark:hover:text-red-300 dark:hover:bg-red-500/10 text-xs font-cairo font-semibold transition border border-red-200 dark:border-red-500/30"
                title="خروج — العودة لتسجيل الاسم والفرع"
              >
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
                <span>خروج</span>
              </button>
            </div>
            <div className="rounded-xl border border-stone-300 dark:border-slate-600/50 bg-stone-200 dark:bg-slate-800/60 px-1.5 py-1 shadow-sm dark:shadow-[0_2px_6px_rgba(0,0,0,0.15)]">
              <button
                type="button"
                onClick={onExit}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-stone-800 hover:text-teal-600 hover:bg-teal-500/15 dark:text-slate-400 dark:hover:text-amber-400 dark:hover:bg-amber-500/10 text-xs font-cairo transition"
                title="تغيير المستخدم"
              >
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="12" cy="8" r="4" />
                  <path d="M4 20c0-3.3 2.7-6 6-6s6 2.7 6 6" />
                  <path d="M16 11l3 3-3 3" />
                  <path d="M19 14h-5" />
                </svg>
                <span>تغيير المستخدم</span>
              </button>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              aria-hidden
              onChange={handleExcelUpload}
            />
            <div className="rounded-xl border border-violet-300 dark:border-violet-500/25 bg-violet-100 dark:bg-violet-500/10 px-1.5 py-1 shadow-sm dark:shadow-[0_2px_8px_rgba(139,92,246,0.12)]">
              <button
                type="button"
                onClick={handleUploadFilesClick}
                className="inline-flex items-center justify-center gap-2 px-3 py-1.5 rounded-lg text-sm font-cairo font-bold bg-teal-500 hover:bg-teal-600 dark:bg-gradient-to-r dark:from-violet-600 dark:to-indigo-600 dark:hover:from-violet-500 dark:hover:to-indigo-500 text-white border border-teal-400/50 dark:border-violet-400/30 shadow-md transition-all hover:scale-[1.02] active:scale-[0.98]"
                title="استخراج قيم مدى، فيزا، ماستر كارد، تحويل بنكي من تقرير إكسل"
              >
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                  <path d="M17 8l-5-5-5 5" />
                  <path d="M12 3v12" />
                </svg>
                <span>استخراج قيم</span>
              </button>
            </div>
            <span className="w-px h-5 bg-stone-300 dark:bg-white/10 rounded-full" aria-hidden="true" />
            <div className="flex items-center gap-1 rounded-xl border-2 border-teal-300 dark:border-amber-500/25 bg-teal-50 dark:bg-amber-500/10 px-1.5 py-1 shadow-sm dark:shadow-[0_2px_6px_rgba(245,158,11,0.08)]">
              <span className="flex items-center justify-center w-6 h-6 rounded-md bg-teal-200 text-teal-800 dark:bg-amber-500/15 dark:text-amber-400/90 shrink-0" aria-hidden="true">
                <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                  <path d="M16 2v4M8 2v4M3 10h18" />
                </svg>
              </span>
              {FILTERS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFilter(f.id)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition ${
                    filter === f.id
                      ? 'bg-teal-500/20 text-teal-800 border border-teal-600 dark:bg-amber-500/25 dark:text-amber-300 dark:border-amber-500/40 shadow-sm'
                      : 'text-stone-700 border border-transparent hover:bg-stone-300 hover:text-stone-900 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-slate-300'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <span className="w-px h-5 bg-stone-300 dark:bg-white/10 rounded-full" aria-hidden="true" />
            <div className="flex items-center gap-1.5 rounded-xl border border-stone-300 dark:border-sky-500/25 bg-stone-200 dark:bg-sky-500/10 px-1.5 py-1 shadow-sm dark:shadow-[0_2px_6px_rgba(14,165,233,0.08)]">
              <button
                type="button"
                onClick={handlePrintAll}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-500 hover:bg-teal-600 dark:bg-sky-600 dark:hover:bg-sky-500 text-white text-xs font-bold transition"
                title="طباعة كل الصفوف المعروضة"
              >
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M6 9V2h12v7" />
                  <path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2" />
                  <path d="M6 14h12v8H6z" />
                </svg>
                <span>الكل</span>
              </button>
              {selectedRowIds.size > 0 && (
                <button
                  type="button"
                  onClick={handlePrintSelected}
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-400 hover:bg-teal-500 dark:bg-sky-500/90 dark:hover:bg-sky-500 text-white text-xs font-bold transition"
                  title={`طباعة ${selectedRowIds.size} صف محدد`}
                >
                  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M6 9V2h12v7" />
                    <path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2" />
                    <path d="M6 14h12v8H6z" />
                  </svg>
                  <span>المحددة ({selectedRowIds.size})</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[100%] max-w-7xl lg:max-w-[1400px] xl:max-w-[1600px] px-3 sm:px-4 py-1 sm:py-2 flex flex-col gap-2 sm:gap-3 flex-1 min-h-0">
        {/* جدول الصفوف — تصميم 2026: زجاجية خفيفة، تباين ناعم، تسلسل بصري واضح */}
        <div
          className="rounded-2xl sm:rounded-3xl overflow-x-auto overflow-hidden flex flex-col border-2 border-stone-400 dark:border-amber-500/20 bg-stone-50 dark:bg-slate-800/30 backdrop-blur-sm shadow-[0_4px_24px_rgba(0,0,0,0.08),0_0_0_1px_rgba(41,37,36,0.12)] dark:shadow-[0_4px_24px_rgba(0,0,0,0.25),0_0_1px_rgba(255,255,255,0.06)] min-h-[200px] sm:min-h-[240px]"
        >
          <div className="cashbox-table-scroll overflow-x-auto scrollbar-thin" style={{ scrollbarGutter: 'stable' }}>
            <table className="w-full text-xs sm:text-sm border-separate table-fixed" style={{ tableLayout: 'fixed', width: '100%', minWidth: '880px', borderSpacing: 0 }}>
              <colgroup>
                <col style={{ width: '3%' }} />
                <col style={{ width: '2.5%' }} />
                <col style={{ width: '6.35%' }} />
                <col style={{ width: '6.35%' }} />
                <col style={{ width: '6.35%' }} />
                <col style={{ width: '6.35%' }} />
                <col style={{ width: '6.35%' }} />
                <col style={{ width: '6.35%' }} />
                <col style={{ width: '6.35%' }} />
                <col style={{ width: '6.35%' }} />
                <col style={{ width: '6.35%' }} />
                <col style={{ width: '6.35%' }} />
                <col style={{ width: '6.35%' }} />
                <col style={{ width: '6.35%' }} />
                <col style={{ width: '6.35%' }} />
                <col style={{ width: '12%' }} />
              </colgroup>
              <thead className="border-b-2 border-stone-500 dark:border-amber-500/20">
                <tr className="h-12 sm:h-14 bg-stone-100 dark:bg-amber-500/[0.08]">
                  <th className="px-1.5 sm:px-2 py-2 sm:py-3 text-center text-[10px] sm:text-[11px] font-bold text-stone-900 dark:text-amber-200/90 tracking-tight align-middle border-r-2 border-stone-500 dark:border-amber-500/15 font-cairo">تحديد</th>
                  <th className="px-1.5 sm:px-2 py-2 sm:py-3 text-center text-[10px] sm:text-[11px] font-bold text-stone-900 dark:text-amber-200/90 tracking-tight align-middle border-r-2 border-stone-500 dark:border-amber-500/15 font-cairo">م</th>
                  <th className="px-1.5 sm:px-2 py-2 sm:py-3 text-center text-[10px] sm:text-[11px] font-bold text-stone-900 dark:text-amber-200/90 tracking-tight align-middle border-r-2 border-stone-500 dark:border-amber-500/15 font-cairo">كاش</th>
                  <th className="px-1.5 sm:px-2 py-2 sm:py-3 text-center text-[10px] sm:text-[11px] font-bold text-stone-900 dark:text-amber-200/90 tracking-tight align-middle border-r-2 border-stone-500 dark:border-amber-500/15 font-cairo" title="مرسل للخزنة — يدخل في معادلة انحراف الكاش">مرسل للخزنة</th>
                  <th className="px-1.5 sm:px-2 py-2 sm:py-3 text-center text-[10px] sm:text-[11px] font-bold text-stone-900 dark:text-amber-200/90 tracking-tight align-middle border-r-2 border-stone-500 dark:border-amber-500/15 font-cairo" title="يُخصم من المصروفات في انحراف الكاش">تعويض مصروفات</th>
                  <th className="px-1.5 sm:px-2 py-2 sm:py-3 text-center text-[10px] sm:text-[11px] font-bold text-stone-900 dark:text-amber-200/90 tracking-tight align-middle border-r-2 border-stone-500 dark:border-amber-500/15 font-cairo">المصروفات</th>
                  <th className="px-1.5 sm:px-2 py-2 sm:py-3 text-center text-[10px] sm:text-[11px] font-semibold text-teal-800 dark:text-teal-300 tracking-tight align-middle border-r-2 border-stone-500 dark:border-amber-500/15 font-cairo">رصيد البرنامج كاش</th>
                  <th className="px-1.5 sm:px-2 py-2 sm:py-3 text-center text-[10px] sm:text-[11px] font-bold text-red-700 dark:text-red-400 tracking-tight align-middle border-r-2 border-stone-500 dark:border-amber-500/15 bg-red-100 dark:bg-red-500/10 font-cairo rounded-sm shadow-sm" title="خانة مهمة: الفرق بين المتوقع والفعلي للكاش">انحراف الكاش</th>
                  <th className="px-1.5 sm:px-2 py-2 sm:py-3 text-center text-[10px] sm:text-[11px] font-bold text-stone-900 dark:text-amber-200/90 tracking-tight align-middle border-r-2 border-stone-500 dark:border-amber-500/15 font-cairo">مدى</th>
                  <th className="px-1.5 sm:px-2 py-2 sm:py-3 text-center text-[10px] sm:text-[11px] font-bold text-stone-900 dark:text-amber-200/90 tracking-tight align-middle border-r-2 border-stone-500 dark:border-amber-500/15 font-cairo">فيزا</th>
                  <th className="px-1.5 sm:px-2 py-2 sm:py-3 text-center text-[10px] sm:text-[11px] font-bold text-stone-900 dark:text-amber-200/90 tracking-tight align-middle border-r-2 border-stone-500 dark:border-amber-500/15 font-cairo">ماستر كارد</th>
                  <th className="px-1.5 sm:px-2 py-2 sm:py-3 text-center text-[10px] sm:text-[11px] font-semibold text-sky-700 dark:text-sky-300 tracking-tight align-middle border-r-2 border-stone-500 dark:border-amber-500/15 font-cairo" title="للعرض فقط — لا يدخل في بنك نزيل ولا انحراف البنك">تحويل بنكي</th>
                  <th className="px-1.5 sm:px-2 py-2 sm:py-3 text-center text-[10px] sm:text-[11px] font-semibold text-teal-800 dark:text-teal-300 tracking-tight align-middle border-r-2 border-stone-500 dark:border-amber-500/15 font-cairo" title="بنك نزيل = مدى + فيزا + ماستر كارد (تحويل بنكي للعرض فقط)">بنك نزيل</th>
                  <th className="px-1.5 sm:px-2 py-2 sm:py-3 text-center text-[10px] sm:text-[11px] font-bold text-stone-900 dark:text-amber-200/90 tracking-tight align-middle border-r-2 border-stone-500 dark:border-amber-500/15 font-cairo">اجمالى الموازنه</th>
                  <th className="px-1.5 sm:px-2 py-2 sm:py-3 text-center text-[10px] sm:text-[11px] font-bold text-red-700 dark:text-red-400 tracking-tight align-middle border-r-2 border-stone-500 dark:border-amber-500/15 bg-red-100 dark:bg-red-500/10 font-cairo rounded-sm shadow-sm" title="خانة مهمة: الفرق بين بنك نزيل واجمالى الموازنه">انحراف البنك</th>
                  <th className="px-1 sm:px-1.5 py-2 sm:py-3 text-center text-[10px] font-semibold text-stone-900 dark:text-amber-200/90 tracking-tight align-middle border-r-2 border-stone-500 dark:border-amber-500/15 overflow-hidden min-w-0 font-cairo">
                    <div className="flex flex-col items-center justify-center gap-1 h-full min-w-0">
                      <span className="truncate max-w-full">الحالة / إجراءات</span>
                      <button
                        type="button"
                        onClick={requestDeleteAllClosed}
                        aria-label="حذف كل التقفيلات المغلقة"
                        className="inline-flex items-center justify-center w-7 h-7 rounded-lg border-2 border-stone-400 dark:border-white/10 bg-stone-200 dark:bg-slate-700/50 text-stone-800 dark:text-slate-400 hover:bg-red-100 dark:hover:bg-red-500/15 hover:text-red-600 dark:hover:text-red-400 hover:border-red-400 dark:hover:border-red-500/30 transition-all shrink-0 shadow-sm"
                        title="حذف كل التقفيلات المغلقة"
                      >
                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                          <path d="M10 11v6M14 11v6" />
                        </svg>
                      </button>
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((r, idx) => (
                  <ClosureRowComp
                    key={r.id}
                    row={r}
                    rowNumber={idx + 1}
                    isFirstActive={r.id === firstActiveId}
                    liveNow={liveNow}
                    closingRowId={closingRowId}
                    closingSecondsLeft={closingRowId === r.id ? closingSecondsLeft : 0}
                    onUpdate={handleUpdate}
                    isSelected={selectedRowIds.has(r.id)}
                    onToggleSelect={toggleRowSelection}
                    onDeleteRow={requestDeleteRow}
                    onPrintRow={handlePrintRow}
                    onOpenExpenseDetails={openExpenseDetails}
                    onClearExpensesAndOpen={clearExpensesAndOpenModal}
                    onLockedFieldClick={handleLockedFieldClick}
                    onExpenseCompensationExceeded={handleExpenseCompensationExceeded}
                    lastExcelDetails={lastExcelDetails}
                    onShowExcelDetails={(field, rowId) => setExcelDetailModal({ field, rowId })}
                    onRequestConfirmBankEdit={lastExcelDetails ? (rowId, field, oldValue, newValue) => setBankEditConfirm({ rowId, field, oldValue, newValue }) : undefined}
                    onShowEmployeeNames={lastExcelEmployeeNamesList.length > 0 ? () => setShowEmployeeNamesModal(true) : undefined}
                    onShowVarianceExplanation={(type, row) => setVarianceExplanationModal({ type, row })}
                    currentUserName={name}
                    onClearRow={(id) => setClearRowConfirmId(id)}
                    isStickyRows={false}
                  />
                ))}
              </tbody>
            </table>
          </div>
          {(currentClosedPage > 1 || hasMoreClosedPages) && (
            <div className="px-3 sm:px-4 py-2 sm:py-3 border-t border-stone-300 dark:border-white/[0.06] flex items-center justify-center gap-2 flex-wrap rounded-b-2xl sm:rounded-b-3xl bg-stone-200 dark:bg-slate-800/50 backdrop-blur-sm">
              <button
                type="button"
                onClick={() => goToClosedPage(currentClosedPage - 1)}
                disabled={currentClosedPage <= 1}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-sm font-cairo font-medium border border-teal-200 dark:border-amber-500/25 bg-teal-50 dark:bg-amber-500/10 text-teal-700 dark:text-amber-400/95 hover:bg-teal-100 hover:border-teal-300 dark:hover:bg-amber-500/20 dark:hover:border-amber-500/40 disabled:opacity-40 disabled:pointer-events-none disabled:border-stone-300 disabled:bg-stone-300 disabled:text-stone-600 dark:disabled:border-white/10 dark:disabled:bg-slate-800/60 dark:disabled:text-slate-500 transition-all"
                aria-label="الصفحة السابقة"
              >
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M15 18l-6-6 6-6" />
                </svg>
                السابق
              </button>
              <div className="flex items-center gap-1">
                {Array.from({ length: Math.max(currentClosedPage, 1) }, (_, i) => i + 1).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => goToClosedPage(p)}
                    className={`inline-flex items-center justify-center min-w-[2.25rem] px-2 py-2 rounded-xl text-sm font-cairo font-medium transition-all ${
                      p === currentClosedPage
                        ? 'bg-teal-500 dark:bg-amber-500/40 text-white border border-teal-500 dark:border-amber-500/50'
                        : 'border border-teal-200 dark:border-amber-500/25 bg-teal-50 dark:bg-amber-500/10 text-teal-700 dark:text-amber-400/95 hover:bg-teal-100 dark:hover:bg-amber-500/20'
                    }`}
                    aria-label={p === 1 ? 'الرئيسية' : `صفحة ${p}`}
                  >
                    {p === 1 ? '١' : p}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => goToClosedPage(currentClosedPage + 1)}
                disabled={!hasMoreClosedPages}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-sm font-cairo font-medium border border-teal-200 dark:border-amber-500/25 bg-teal-50 dark:bg-amber-500/10 text-teal-700 dark:text-amber-400/95 hover:bg-teal-100 hover:border-teal-300 dark:hover:bg-amber-500/20 dark:hover:border-amber-500/40 disabled:opacity-40 disabled:pointer-events-none disabled:border-stone-300 disabled:bg-stone-300 disabled:text-stone-600 dark:disabled:border-white/10 dark:disabled:bg-slate-800/60 dark:disabled:text-slate-500 transition-all"
                aria-label="الصفحة التالية"
              >
                التالي
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </button>
            </div>
          )}
          {displayRows.length === 0 && (
            <div className="py-16 px-4 text-center rounded-b-3xl bg-stone-100 dark:bg-slate-800/20">
              <p className="text-stone-600 dark:text-slate-500 font-cairo mb-1">لا توجد تقفيلات</p>
              <p className="text-stone-700 dark:text-slate-600 text-sm font-cairo">اختر فلتراً مختلفاً أو ابدأ شفتاً جديداً</p>
            </div>
          )}
        </div>

        {/* شريط إغلاق الشفت والتراجع — تحت الجدول، فوق الحاسبتين */}
        <div className="flex flex-col items-center justify-center gap-1.5 py-2 px-3 rounded-xl border-2 border-teal-500 dark:border-amber-500/30 bg-gradient-to-b from-teal-50 to-stone-200 dark:from-amber-500/10 dark:to-slate-800/60 min-h-0 shadow-md dark:shadow-[0_4px_20px_rgba(245,158,11,0.12),0_0_1px_rgba(255,255,255,0.06)]">
          {closingRowId ? (
            <div className="flex flex-wrap items-center justify-center w-full" dir="ltr">
              {closingSecondsLeft > 0 ? (
                <button
                  type="button"
                  onClick={handleUndoClose}
                  className="btn-close-shift inline-flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-5 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-cairo font-bold whitespace-nowrap border-2 border-teal-400 bg-teal-500 hover:bg-teal-600 text-white shadow-md dark:border-emerald-500/60 dark:bg-gradient-to-b dark:from-emerald-500/30 dark:to-emerald-600/20 dark:text-emerald-50 dark:shadow-[0_4px_24px_rgba(16,185,129,0.25)] dark:hover:from-emerald-500/40 dark:hover:to-emerald-600/30 dark:hover:shadow-[0_6px_28px_rgba(16,185,129,0.3)] hover:scale-[1.02] active:scale-[0.98] transition-all select-none touch-manipulation min-h-[36px]"
                >
                  <svg className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 10h10a5 5 0 015 5v2" />
                    <path d="M7 15l-4-4 4-4" />
                  </svg>
                  <span className="tracking-wide">تراجع</span>
                  <span className="tabular-nums font-cairo">({closingSecondsLeft} ثانية)</span>
                </button>
              ) : (
                <span className="text-sm font-cairo font-medium text-teal-800 dark:text-amber-400 tabular-nums">جاري الإغلاق...</span>
              )}
            </div>
          ) : firstActiveId && firstActiveRow ? (
            <button
              type="button"
              onClick={() => handleCloseShift(firstActiveId)}
              disabled={!canCloseShift}
              className={`btn-close-shift inline-flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-5 py-2 sm:py-2.5 w-full sm:w-auto sm:min-w-[180px] rounded-xl text-xs sm:text-sm font-cairo font-bold whitespace-nowrap border-2 select-none transition-all touch-manipulation min-h-[36px]
                ${canCloseShift
                  ? 'bg-teal-500 hover:bg-teal-600 text-white border-teal-400 shadow-md dark:bg-gradient-to-b dark:from-amber-500/50 dark:to-amber-600/40 dark:text-amber-50 dark:border-amber-400 dark:shadow-[0_4px_24px_rgba(245,158,11,0.3)] dark:hover:from-amber-500/60 dark:hover:to-amber-600/50 dark:hover:shadow-[0_6px_28px_rgba(245,158,11,0.35)] hover:scale-[1.02] active:scale-[0.98]'
                  : 'opacity-60 bg-stone-200 text-stone-500 border-stone-300 dark:opacity-50 dark:bg-slate-800/40 dark:text-slate-500 dark:border-slate-600/50 cursor-not-allowed'
                }`}
              title={canCloseShift ? 'إغلاق الشفت وحفظ التقفيلة' : 'أدخل رصيد البرنامج كاش وإجمالي الموازنة (البنك) أولاً'}
            >
              <svg className={`btn-close-shift-icon w-5 h-5 shrink-0 ${canCloseShift ? 'text-white dark:text-amber-200' : 'text-stone-500 dark:text-slate-500'}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0110 0v4" />
              </svg>
              <span className="tracking-wide">
                {name ? `إغلاق شفت ${name}` : 'إغلاق الشفت الحالي'}
              </span>
            </button>
          ) : null}
        </div>

        {/* الحاسبات — تُصفَّر عند انتهاء مهلة الإغلاق للتجهيز لشفت جديد */}
        <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-[minmax(260px,320px)_1fr_1fr] gap-2 sm:gap-3 w-full max-w-[100%] max-w-7xl lg:max-w-[1400px] xl:max-w-[1600px] items-stretch min-h-[280px] sm:min-h-[340px] xl:min-h-[380px] [&>div]:min-h-[240px] sm:[&>div]:min-h-[300px] xl:[&>div]:min-h-[340px]">
          <div className="min-h-0 flex flex-col">
            <Calculator key={`calculator-${calculatorsResetKey}`} onTransfer={handleTransferFromCalculator} hasActiveRow={!!firstActiveId} />
          </div>
          <div className="min-h-0 flex flex-col">
            <CashCalculator key={`cashCalculator-${calculatorsResetKey}`} onApplyToCash={handleApplyCashToRow} hasActiveRow={!!firstActiveId} />
          </div>
          <div className="min-h-0 flex flex-col">
            <BankOperationsCalculator key={`bankOps-${calculatorsResetKey}`} onTransfer={handleTransferFromBankOps} hasActiveRow={!!firstActiveId} />
          </div>
        </section>
      </main>

      {toast && (
        <Toast
          message={toast.msg}
          type={toast.type}
          onClose={() => setToast(null)}
          position="center"
          autoHideMs={toast.autoHideMs}
        />
      )}

      {excelDetailModal && lastExcelDetails && (() => {
        const { field, rowId } = excelDetailModal
        const list = lastExcelDetails[field] ?? []
        const fromExcel = list.reduce((s, t) => s + t.amount, 0)
        const row = rows.find((r) => r.id === rowId)
        const currentInCell = row ? ((row[field] as number) ?? 0) : 0
        const diff = currentInCell - fromExcel
        const labels: Record<keyof ExcelDetails, string> = {
          mada: 'مدى',
          visa: 'فيزا',
          mastercard: 'ماستر كارد',
          bankTransfer: 'تحويل بنكي',
        }
        const title = `سجل التغيير — ${labels[field]}`
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm cursor-default" role="dialog" aria-modal="true" aria-labelledby="excel-detail-title" onClick={() => setExcelDetailModal(null)}>
            <div className="rounded-2xl border border-stone-300 dark:border-white/10 bg-stone-50 dark:bg-slate-800 shadow-2xl max-w-[95vw] sm:max-w-sm w-full max-h-[85vh] overflow-hidden flex flex-col font-cairo cursor-auto" onClick={(e) => e.stopPropagation()}>
              <h2 id="excel-detail-title" className="text-base font-bold text-teal-800 dark:text-amber-400 p-4 pb-2 border-b-2 border-stone-400 dark:border-white/10">
                {title}
              </h2>
              <div className="p-3 space-y-2 border-b border-stone-200 dark:border-white/10">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-stone-600 dark:text-slate-400">من إكسل (مرفوع):</span>
                  <span className="tabular-nums font-medium text-teal-600 dark:text-amber-200/95">{formatCurrency(fromExcel)}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-stone-600 dark:text-slate-400">الحالي في الخانة:</span>
                  <span className="tabular-nums font-medium text-stone-800 dark:text-slate-200">{formatCurrency(currentInCell)}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-stone-600 dark:text-slate-400">الفرق (ترحيل أو تعديل يدوي):</span>
                  <span className={`tabular-nums font-medium ${diff >= 0 ? 'text-teal-600 dark:text-amber-400' : 'text-rose-600 dark:text-rose-400'}`}>{formatCurrency(diff)}</span>
                </div>
              </div>
              {list.length > 0 && (
                <>
                  <div className="overflow-y-auto flex-1 min-h-0 p-3 space-y-2">
                    <p className="text-xs font-cairo text-stone-500 dark:text-slate-400 mb-1">{list.length} عملية من الإكسل</p>
                    {list.map((t, i) => (
                      <div key={i} className="py-2 border-b border-stone-200 dark:border-white/5">
                        <div className="flex justify-between items-center gap-2 text-sm text-stone-800 dark:text-slate-300">
                          <div className="flex flex-col items-start gap-0.5 min-w-0">
                            {t.employeeName ? (
                              <span className="text-xs text-stone-500 font-cairo">{t.employeeName}</span>
                            ) : null}
                          </div>
                          <span className="tabular-nums font-medium text-teal-600 dark:text-amber-200/95 shrink-0">{formatCurrency(t.amount)}</span>
                        </div>
                        {t.purpose && (
                          <p className="text-xs font-cairo text-stone-600 dark:text-amber-200/80 mt-1 pr-0 border-t border-stone-300 dark:border-amber-500/20 pt-1">
                            {t.purpose}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                  <div className="p-4 pt-2 border-t border-stone-300 dark:border-amber-500/30 flex justify-between items-center bg-stone-100 dark:bg-slate-900/50">
                    <span className="font-bold text-stone-800 dark:text-slate-200">إجمالي الإكسل</span>
                    <span className="tabular-nums font-bold text-teal-600 dark:text-amber-400">{formatCurrency(fromExcel)}</span>
                  </div>
                </>
              )}
              <div className="p-3">
                <button
                  type="button"
                  onClick={() => setExcelDetailModal(null)}
                  className="w-full py-2.5 rounded-xl text-sm font-bold bg-teal-500 hover:bg-teal-600 dark:bg-slate-600 dark:hover:bg-slate-500 text-white dark:text-slate-200 transition"
                >
                  إغلاق
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {showEmployeeNamesModal && lastExcelEmployeeNamesList.length > 0 && (() => {
        const employeeStats: { name: string; count: number; total: number }[] = lastExcelEmployeeNamesList.map((name) => {
          let count = 0
          let total = 0
          if (lastExcelDetails) {
            for (const key of ['mada', 'visa', 'mastercard', 'bankTransfer'] as const) {
              const list = lastExcelDetails[key] ?? []
              for (const t of list) {
                if ((t.employeeName ?? '').trim() === name) {
                  count += 1
                  total += t.amount
                }
              }
            }
          }
          return { name, count, total }
        })
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm cursor-default" role="dialog" aria-modal="true" aria-labelledby="employee-names-title" onClick={() => setShowEmployeeNamesModal(false)}>
            <div className="rounded-2xl border border-stone-300 dark:border-white/10 bg-stone-50 dark:bg-slate-800 shadow-2xl max-w-[95vw] sm:max-w-md w-full max-h-[85vh] overflow-hidden flex flex-col font-cairo cursor-auto" onClick={(e) => e.stopPropagation()}>
              <h2 id="employee-names-title" className="text-base font-bold text-teal-700 dark:text-amber-400 p-4 pb-2 border-b border-white/10">
                أسماء الموظفين في العمليات المستوردة
              </h2>
              <div className="overflow-y-auto flex-1 min-h-0 p-3 space-y-1.5">
                {employeeStats.map((s, i) => (
                  <div key={i} className="flex flex-wrap items-center justify-between gap-2 text-sm text-slate-300 py-2 px-3 rounded-lg bg-slate-900/50 border border-white/5 font-cairo">
                    <span className="font-medium text-slate-200">{s.name}</span>
                    <span className="tabular-nums text-teal-600 dark:text-amber-200/90 text-xs">
                      {s.count} عملية — الإجمالي: {formatCurrency(s.total)}
                    </span>
                  </div>
                ))}
              </div>
              <div className="p-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setShowEmployeeNamesModal(false)}
                  className="w-full py-2.5 rounded-xl text-sm font-bold bg-slate-600 hover:bg-slate-500 text-slate-200 transition"
                >
                  إغلاق
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {varianceExplanationModal && (() => {
        const { type, row } = varianceExplanationModal
        const cash = (row.cash ?? 0)
        const sentToTreasury = (row.sentToTreasury ?? 0)
        const expenses = (row.expenses ?? 0)
        const expenseCompensation = (row.expenseCompensation ?? 0)
        const effectiveExpenses = Math.max(0, expenses - expenseCompensation)
        const programBalanceCash = row.programBalanceCash ?? 0
        const expectedProgramCash = cash + sentToTreasury + effectiveExpenses
        const cashVariance = computeCashVariance(row)
        const bankTotal = row.mada + row.visa + row.mastercard
        const programBalanceBank = row.programBalanceBank ?? 0
        const bankVariance = computeBankVariance(row)
        const isCash = type === 'cash'
        const title = isCash ? 'شرح انحراف الكاش' : 'شرح انحراف البنك'
        const oppositeSigns = cashVariance !== 0 && bankVariance !== 0 && (cashVariance > 0) !== (bankVariance > 0)
        const diffWithin2 = Math.abs(Math.abs(cashVariance) - Math.abs(bankVariance)) <= VARIANCE_SWAP_TOLERANCE_SAR
        const showSwapAlert = oppositeSigns && diffWithin2
        const swapAmount = showSwapAlert ? Math.abs(cashVariance) : 0
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm cursor-default" role="dialog" aria-modal="true" aria-labelledby="variance-explanation-title" onClick={() => setVarianceExplanationModal(null)}>
            <div className="rounded-2xl border border-stone-300 dark:border-white/10 bg-stone-50 dark:bg-slate-800 shadow-2xl max-w-[95vw] sm:max-w-md w-full max-h-[85vh] overflow-hidden flex flex-col font-cairo cursor-auto" onClick={(e) => e.stopPropagation()}>
              <h2 id="variance-explanation-title" className="text-base font-bold text-teal-800 dark:text-amber-400 p-4 pb-2 border-b-2 border-stone-400 dark:border-white/10">
                {title}
              </h2>
              <div className="overflow-y-auto flex-1 min-h-0 p-4 space-y-3 text-sm text-stone-800 dark:text-slate-300">
                {isCash ? (
                  <>
                    <p className="text-stone-800 dark:text-slate-200 font-semibold text-teal-800 dark:text-teal-300">انحراف الكاش = (كاش + مرسل للخزنة + مصروفات فعّالة) − رصيد البرنامج كاش</p>
                    <ul className="space-y-1.5 list-none">
                      <li className="flex justify-between gap-2"><span>كاش</span><span className="tabular-nums font-medium text-teal-700 dark:text-teal-400">{formatCurrency(cash)}</span></li>
                      <li className="flex justify-between gap-2"><span>مرسل للخزنة</span><span className="tabular-nums font-medium text-teal-700 dark:text-teal-400">{formatCurrency(sentToTreasury)}</span></li>
                      <li className="flex justify-between gap-2"><span>مصروفات</span><span className="tabular-nums font-medium text-teal-700 dark:text-teal-400">{formatCurrency(expenses)}</span></li>
                      <li className="flex justify-between gap-2"><span>تعويض مصروفات</span><span className="tabular-nums font-medium text-teal-700 dark:text-teal-400">− {formatCurrency(expenseCompensation)}</span></li>
                      <li className="flex justify-between gap-2 border-t border-stone-300 dark:border-white/10 pt-1.5"><span>مصروفات فعّالة (صافي)</span><span className="tabular-nums font-medium text-teal-700 dark:text-teal-400">{formatCurrency(effectiveExpenses)}</span></li>
                      <li className="flex justify-between gap-2 font-medium"><span>كاش + مرسل للخزنة + مصروفات فعّالة</span><span className="tabular-nums font-bold text-teal-800 dark:text-teal-300">{formatCurrency(expectedProgramCash)}</span></li>
                      <li className="flex justify-between gap-2"><span>رصيد البرنامج كاش</span><span className="tabular-nums font-medium text-teal-700 dark:text-teal-400">− {formatCurrency(programBalanceCash)}</span></li>
                      <li className="flex justify-between gap-2 border-t-2 border-teal-400 dark:border-amber-500/30 pt-2 font-bold text-teal-800 dark:text-amber-300"><span>انحراف الكاش</span><span className="tabular-nums">{cashVariance > 0 ? '+' : ''}{formatCurrency(cashVariance)}</span></li>
                    </ul>
                    <p className="text-xs text-stone-600 dark:text-slate-400 pt-1">
                      {cashVariance > 0 ? 'زيادة: الكاش الفعلي (أو المرسل + المصروف الفعلي) أكبر من رصيد البرنامج.' : cashVariance < 0 ? 'عجز: رصيد البرنامج كاش أكبر من المتوقّع من الكاش والمرسل والمصروف.' : 'لا يوجد انحراف.'}
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-stone-800 dark:text-slate-200 font-semibold text-teal-800 dark:text-teal-300">انحراف البنك = بنك نزيل − اجمالى الموازنه</p>
                    <ul className="space-y-1.5 list-none">
                      <li className="flex justify-between gap-2"><span>مدى</span><span className="tabular-nums font-medium text-teal-700 dark:text-teal-400">{formatCurrency(row.mada)}</span></li>
                      <li className="flex justify-between gap-2"><span>فيزا</span><span className="tabular-nums font-medium text-teal-700 dark:text-teal-400">{formatCurrency(row.visa)}</span></li>
                      <li className="flex justify-between gap-2"><span>ماستر كارد</span><span className="tabular-nums font-medium text-teal-700 dark:text-teal-400">{formatCurrency(row.mastercard)}</span></li>
                      <li className="flex justify-between gap-2"><span>تحويل بنكي <span className="text-stone-500 dark:text-slate-500 text-[10px]">(للعرض فقط)</span></span><span className="tabular-nums font-medium text-teal-700 dark:text-teal-400">{formatCurrency(row.bankTransfer)}</span></li>
                      <li className="flex justify-between gap-2 border-t border-stone-300 dark:border-white/10 pt-1.5 font-medium"><span>بنك نزيل (مدى+فيزا+ماستر)</span><span className="tabular-nums font-bold text-teal-800 dark:text-teal-300">{formatCurrency(bankTotal)}</span></li>
                      <li className="flex justify-between gap-2"><span>اجمالى الموازنه</span><span className="tabular-nums font-medium text-teal-700 dark:text-teal-400">− {formatCurrency(programBalanceBank)}</span></li>
                      <li className="flex justify-between gap-2 border-t-2 border-teal-400 dark:border-amber-500/30 pt-2 font-bold text-teal-800 dark:text-amber-300"><span>انحراف البنك</span><span className="tabular-nums">{bankVariance > 0 ? '+' : ''}{formatCurrency(bankVariance)}</span></li>
                    </ul>
                    <p className="text-xs text-stone-600 dark:text-slate-400 pt-1">
                      {bankVariance > 0 ? 'زيادة: بنك نزيل أكبر من اجمالى الموازنه المدخل.' : bankVariance < 0 ? 'عجز: اجمالى الموازنه أكبر من بنك نزيل.' : 'لا يوجد انحراف.'}
                    </p>
                  </>
                )}
                {showSwapAlert && (
                  <div className="mt-3 p-3 rounded-xl border-2 border-teal-400/60 dark:border-amber-500/30 bg-teal-50 dark:bg-amber-900/20 text-teal-800 dark:text-amber-200 text-sm font-medium">
                    تنبيه: قد تكون سندات بقيمة <strong>{swapAmount.toLocaleString('ar-SA', { minimumFractionDigits: 2 })}</strong> ريال دخلت في خانة خاطئة (نقداً ↔ شبكة). راجع تحويل المبلغ بين الكاش وبنك نزيل.
                  </div>
                )}
              </div>
              <div className="p-3 border-t-2 border-stone-400 dark:border-white/10">
                <button
                  type="button"
                  onClick={() => setVarianceExplanationModal(null)}
                  className="w-full py-2.5 rounded-xl text-sm font-bold bg-teal-600 hover:bg-teal-500 text-white transition"
                >
                  إغلاق
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {closeConfirmVariance && (() => {
        const { cashVar, bankVar } = closeConfirmVariance
        const cashTip = cashVar !== 0 ? (cashVar > 0 ? 'زيادة في صندوق الكاش — راجع الرصيد الفعلي' : 'عجز في صندوق الكاش — راجع الكاش والرصيد والمصروف') : ''
        const bankTip = bankVar !== 0 ? (bankVar > 0 ? 'زيادة في البنك — راجع إدخالات مدى/فيزا/ماستر أو اجمالى الموازنه' : 'عجز في البنك — راجع بنك نزيل أو اجمالى الموازنه') : ''
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="close-variance-title">
            <div className="rounded-2xl border-2 border-teal-300 dark:border-amber-500/30 bg-stone-50 dark:bg-slate-800 shadow-2xl max-w-md w-full p-5 font-cairo">
              <h2 id="close-variance-title" className="text-lg font-bold text-teal-800 dark:text-amber-400 mb-3">
                تنبيه: يوجد انحراف
              </h2>
              <div className="text-stone-800 dark:text-slate-300 text-sm leading-relaxed mb-4 space-y-2">
                {cashVar !== 0 && (
                  <p className="block">
                    <span className="font-medium">انحراف الكاش: </span>
                    <span className="font-bold tabular-nums text-teal-700 dark:text-teal-400">{cashVar > 0 ? '+' : ''}{formatCurrency(cashVar)}</span>
                    {cashTip && <span className="block text-stone-600 dark:text-amber-200/90 text-xs mt-0.5">{cashTip}</span>}
                  </p>
                )}
                {bankVar !== 0 && (
                  <p className="block">
                    <span className="font-medium">انحراف البنك: </span>
                    <span className="font-bold tabular-nums text-teal-700 dark:text-teal-400">{bankVar > 0 ? '+' : ''}{formatCurrency(bankVar)}</span>
                    {bankTip && <span className="block text-stone-600 dark:text-amber-200/90 text-xs mt-0.5">{bankTip}</span>}
                  </p>
                )}
                <p className="pt-2 text-stone-700 dark:text-slate-200">هل تريد الإغلاق مع هذا الانحراف؟</p>
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={confirmCloseWithVariance}
                  className="flex-1 py-2.5 rounded-xl text-sm font-bold bg-teal-600 hover:bg-teal-500 text-white transition"
                >
                  نعم، إغلاق الشفت
                </button>
                <button
                  type="button"
                  onClick={cancelCloseWithVariance}
                  className="flex-1 py-2.5 rounded-xl text-sm font-bold bg-slate-600 hover:bg-slate-500 text-slate-200 transition"
                >
                  لا، متابعة التعديل
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {transferConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="transfer-confirm-title">
          <div className="rounded-2xl border border-stone-300 dark:border-white/10 bg-stone-50 dark:bg-slate-800 shadow-2xl max-w-md w-full p-5 font-cairo">
            <h2 id="transfer-confirm-title" className="text-lg font-bold text-teal-700 dark:text-amber-400 mb-3">
              ترحيل إلى {transferFieldLabel(transferConfirm.field)}
            </h2>
            <p className="text-stone-600 dark:text-slate-300 text-sm leading-relaxed mb-4">
              هل تريد ترحيل الرقم الجديد وهو <span className="font-bold text-white tabular-nums">{formatCurrency(transferConfirm.amount)}</span>؟ يوجد رقم في الخانة وهو <span className="font-bold text-white tabular-nums">{formatCurrency(transferConfirm.currentValue)}</span>.
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleTransferConfirmYes}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition"
              >
                نعم
              </button>
              <button
                type="button"
                onClick={handleTransferConfirmNo}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold bg-slate-600 hover:bg-slate-500 text-slate-200 transition"
              >
                لا
              </button>
            </div>
          </div>
        </div>
      )}

      {bankTransferConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="bank-transfer-confirm-title">
          <div className="rounded-2xl border border-stone-300 dark:border-white/10 bg-stone-50 dark:bg-slate-800 shadow-2xl max-w-md w-full p-5 font-cairo">
            <h2 id="bank-transfer-confirm-title" className="text-lg font-bold text-teal-700 dark:text-amber-400 mb-3">
              ترحيل العمليات البنكية
            </h2>
            <p className="text-stone-600 dark:text-slate-300 text-sm leading-relaxed mb-3">
              هل تريد ترحيل الأرقام الجديدة؟ توجد قيم في الخانات:
            </p>
            <ul className="text-sm text-stone-700 dark:text-slate-300 space-y-1.5 mb-4">
              {bankTransferConfirm.mada > 0 && (
                <li className="flex justify-between gap-2">
                  <span>مدى:</span>
                  <span className="tabular-nums">مرحّل <strong className="text-teal-600 dark:text-amber-400">{formatCurrency(bankTransferConfirm.mada)}</strong> — في الخانة <strong>{formatCurrency(bankTransferConfirm.currentMada)}</strong></span>
                </li>
              )}
              {bankTransferConfirm.visa > 0 && (
                <li className="flex justify-between gap-2">
                  <span>فيزا:</span>
                  <span className="tabular-nums">مرحّل <strong className="text-teal-600 dark:text-amber-400">{formatCurrency(bankTransferConfirm.visa)}</strong> — في الخانة <strong>{formatCurrency(bankTransferConfirm.currentVisa)}</strong></span>
                </li>
              )}
              {bankTransferConfirm.mastercard > 0 && (
                <li className="flex justify-between gap-2">
                  <span>ماستر:</span>
                  <span className="tabular-nums">مرحّل <strong className="text-teal-600 dark:text-amber-400">{formatCurrency(bankTransferConfirm.mastercard)}</strong> — في الخانة <strong>{formatCurrency(bankTransferConfirm.currentMaster)}</strong></span>
                </li>
              )}
            </ul>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleBankTransferConfirmYes}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition"
              >
                نعم
              </button>
              <button
                type="button"
                onClick={handleBankTransferConfirmNo}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold bg-slate-600 hover:bg-slate-500 text-slate-200 transition"
              >
                لا
              </button>
            </div>
          </div>
        </div>
      )}

      {bankEditConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="bank-edit-confirm-title">
          <div className="rounded-2xl border border-stone-300 dark:border-white/10 bg-stone-50 dark:bg-slate-800 shadow-2xl max-w-md w-full p-5 font-cairo">
            <h2 id="bank-edit-confirm-title" className="text-lg font-bold text-teal-700 dark:text-amber-400 mb-3">
              تعديل خانة {transferFieldLabel(bankEditConfirm.field as TransferField)}
            </h2>
            <p className="text-stone-600 dark:text-slate-300 text-sm leading-relaxed mb-4">
              هل تريد تعديل الرقم من <span className="font-bold tabular-nums">{formatCurrency(bankEditConfirm.oldValue)}</span> إلى <span className="font-bold tabular-nums text-teal-600 dark:text-amber-400">{formatCurrency(bankEditConfirm.newValue)}</span>؟
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleBankEditConfirmYes}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition"
              >
                نعم
              </button>
              <button
                type="button"
                onClick={handleBankEditConfirmNo}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold bg-slate-600 hover:bg-slate-500 text-slate-200 transition"
              >
                لا
              </button>
            </div>
          </div>
        </div>
      )}

      {clearRowConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="clear-row-confirm-title">
          <div className="rounded-2xl border border-stone-300 dark:border-white/10 bg-stone-50 dark:bg-slate-800 shadow-2xl max-w-md w-full p-5 font-cairo">
            <h2 id="clear-row-confirm-title" className="text-lg font-bold text-teal-700 dark:text-amber-400 mb-3">
              إفراغ الصف
            </h2>
            <p className="text-stone-600 dark:text-slate-300 text-sm leading-relaxed mb-4">
              هل تريد إفراغ كل المدخلات في هذا الصف؟ (كاش، مدى، فيزا، ماستر، اجمالى الموازنه، مصروفات، وغيرها)
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={confirmClearRowYes}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition"
              >
                نعم
              </button>
              <button
                type="button"
                onClick={confirmClearRowNo}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold bg-slate-600 hover:bg-slate-500 text-slate-200 transition"
              >
                لا
              </button>
            </div>
          </div>
        </div>
      )}

      {expenseModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm cursor-default"
          role="dialog"
          aria-modal="true"
          aria-labelledby="expense-modal-title"
          onClick={() => setExpenseModal(null)}
        >
          <div
            className="rounded-2xl border border-stone-300 dark:border-white/10 bg-stone-50 dark:bg-slate-800 shadow-2xl max-w-lg w-full max-h-[85vh] flex flex-col font-cairo cursor-auto"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !expenseModal.readOnly) {
                e.preventDefault()
                saveExpenseModal()
              }
            }}
          >
            <div className="flex items-center justify-between p-4 border-b border-white/10">
              <h2 id="expense-modal-title" className="text-lg font-bold text-teal-700 dark:text-amber-400">
                {expenseModal.readOnly ? 'تفاصيل المصروفات' : 'تصنيف المبلغ المصروف'}
              </h2>
              <button
                type="button"
                onClick={() => setExpenseModal(null)}
                className="p-2 rounded-lg text-stone-500 hover:text-white hover:bg-white/10 transition"
                aria-label="إغلاق"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
            {!expenseModal.readOnly && (
              <>
                <p className="text-stone-500 text-sm px-4 pt-2">أدخل تفاصيل المصروف (مثال: 10 ريال كتب، 10 ريال مسطرة)</p>
                {(expenseModal.carriedCount ?? 0) > 0 && (
                  <p className="text-stone-600 dark:text-amber-200/80 text-xs px-4 pt-0.5 font-cairo">البنود المرحّلة للعرض فقط — يمكنك إضافة تصنيف ومبلغ جديد فقط، ويُحدَّث المجموع وخانة المصروفات تلقائياً.</p>
                )}
              </>
            )}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {!expenseModal.readOnly && expenseModal.items.length > 0 && (
                <div className="flex gap-2 items-center pb-0.5">
                  <span className="flex-1 text-xs font-medium text-stone-700 font-cairo">بند المصروف</span>
                  <span className="w-24 text-xs font-medium text-stone-700 font-cairo text-center">مبلغ المصروف</span>
                  <span className="w-10 shrink-0" aria-hidden="true" />
                </div>
              )}
              {expenseModal.items.map((item, index) => {
                const carriedCount = expenseModal.carriedCount ?? 0
                const isLocked = !expenseModal.readOnly && index < carriedCount
                return (
                  <div key={index} className="flex gap-2 items-center">
                    {expenseModal.readOnly || isLocked ? (
                      <>
                        <span className="w-24 px-3 py-2 rounded-lg bg-slate-900/60 border border-white/10 text-slate-200 text-sm text-center tabular-nums">
                          {formatCurrency(Number(item.amount) || 0)}
                        </span>
                        <span className="flex-1 px-3 py-2 rounded-lg bg-slate-900/60 border border-white/10 text-slate-200 text-sm font-cairo">
                          {item.description || '—'}
                          {isLocked && (
                            <span className="mr-1 text-[10px] text-stone-600 font-cairo" title="من الشفت السابق"> (مرحّل)</span>
                          )}
                        </span>
                        {!expenseModal.readOnly && isLocked ? (
                          <button
                            type="button"
                            onClick={() => requestDeleteCarriedItem(expenseModal.rowId, index)}
                            className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg border border-red-500/20 text-slate-400 hover:text-red-400 hover:border-red-500/40"
                            title="حذف البند المرحّل (يتطلب كود أدمن)"
                            aria-label="حذف بند مرحّل"
                          >
                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
                          </button>
                        ) : (
                          <span className="w-10 shrink-0" aria-hidden="true" />
                        )}
                      </>
                    ) : (
                      <>
                        {(() => {
                          const amountVal = expenseAmountRef.current[index] !== undefined ? expenseAmountRef.current[index] : String(item.amount ?? '')
                          const hasAmount = (Number(String(amountVal).replace(/,/g, '')) || 0) > 0
                          const descEmpty = !String(item.description || '').trim()
                          const needsDesc = hasAmount && descEmpty
                          const isPulsing = pulseExpenseDescriptionIndex === index
                          return (
                            <input
                              ref={(el) => {
                                if (!el || index !== carriedCount) return
                                if (expenseModal.readOnly || expenseModalFocusedRowIdRef.current === expenseModal.rowId) return
                                expenseModalFocusedRowIdRef.current = expenseModal.rowId
                                el.focus()
                              }}
                              type="text"
                              tabIndex={index === carriedCount ? 0 : -1}
                              value={item.description}
                              onChange={(e) => {
                                updateExpenseModalItem(index, 'description', e.target.value)
                                if (pulseExpenseDescriptionIndex === index) setPulseExpenseDescriptionIndex(null)
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault()
                                  saveExpenseModal()
                                }
                              }}
                              placeholder={hasAmount ? 'الوصف إلزامي' : 'الوصف'}
                              title={hasAmount ? 'الوصف إلزامي عند وجود مبلغ' : undefined}
                              aria-required={hasAmount}
                              className={`flex-1 px-3 py-2 rounded-lg bg-stone-50 dark:bg-slate-900/80 border text-stone-900 dark:text-white text-sm font-cairo placeholder:text-stone-500 dark:placeholder:text-slate-500 focus:border-teal-500/50 dark:focus:border-amber-500/50 focus:ring-1 focus:ring-teal-500/25 dark:focus:ring-amber-500/25 ${needsDesc ? 'border-teal-500 dark:border-amber-500/50 ring-1 ring-teal-500/25' : 'border-stone-300 dark:border-amber-500/25'} ${isPulsing ? 'expense-description-pulse' : ''}`}
                            />
                          )
                        })()}
                        <input
                          type="text"
                          inputMode="decimal"
                          tabIndex={-1}
                          dir="ltr"
                          value={toLatinDigits(expenseAmountRef.current[index] !== undefined ? expenseAmountRef.current[index] : String(item.amount ?? ''))}
                          onChange={(e) => {
                            let v = toLatinDigits(e.target.value).replace(/[^\d.]/g, '')
                            const dotIdx = v.indexOf('.')
                            if (dotIdx >= 0) v = v.slice(0, dotIdx + 1) + v.slice(dotIdx + 1).replace(/\./g, '')
                            expenseAmountRef.current[index] = v
                            updateExpenseModalItem(index, 'amount', v)
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault()
                              saveExpenseModal()
                            }
                          }}
                          placeholder="مبلغ"
                          className="cashbox-input w-24 px-3 py-2 rounded-lg bg-stone-50 dark:bg-slate-900/80 border border-stone-300 dark:border-amber-500/25 text-stone-900 dark:text-white text-sm text-center focus:border-teal-500/50 dark:focus:border-amber-500/50 focus:ring-1 focus:ring-teal-500/25 dark:focus:ring-amber-500/25"
                        />
                        <button
                          type="button"
                          tabIndex={-1}
                          onClick={() => removeExpenseModalRow(index)}
                          disabled={expenseModal.items.length <= 1}
                          className="p-2 rounded-lg text-stone-500 hover:text-red-400 hover:bg-red-500/20 disabled:opacity-40 disabled:pointer-events-none transition"
                          aria-label="حذف السطر"
                          title="حذف"
                        >
                          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M18 6L6 18M6 6l12 12" />
                          </svg>
                        </button>
                      </>
                    )}
                  </div>
                )
              })}
            </div>
            <div className="p-4 border-t border-white/10 flex flex-wrap items-center gap-3">
              {!expenseModal.readOnly && (
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={addExpenseModalRow}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-teal-100 text-teal-700 border-2 border-teal-400 hover:bg-teal-200 transition"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                  إضافة سطر
                </button>
              )}
              <div className="flex-1" />
              {!expenseModal.readOnly ? (
                <div className="flex flex-col items-end gap-2">
                  <span className="text-stone-500 text-sm font-cairo">
                    المجموع: <span className="font-bold text-teal-700 dark:text-amber-400 tabular-nums">{formatCurrency(expenseModal.items.reduce((s, it) => s + (Number(it.amount) || 0), 0))}</span>
                  </span>
                  <button
                    type="button"
                    onClick={saveExpenseModal}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ' || e.key === 'Tab') {
                        e.preventDefault()
                        saveExpenseModal()
                      }
                    }}
                    className="px-4 py-2 rounded-xl text-sm font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2 focus:ring-offset-slate-800 focus:shadow-[0_0_16px_rgba(16,185,129,0.4)]"
                  >
                    تعديل مبلغ المصروفات
                  </button>
                </div>
              ) : (
                <span className="text-stone-500 text-sm font-cairo">
                  المجموع: <span className="font-bold text-teal-700 dark:text-amber-400 tabular-nums">{formatCurrency(expenseModal.items.reduce((s, it) => s + (Number(it.amount) || 0), 0))}</span>
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {deleteCarriedConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="delete-carried-dialog-title">
          <div className="rounded-2xl border border-stone-300 dark:border-white/10 bg-stone-50 dark:bg-slate-800 shadow-2xl max-w-md w-full p-5 font-cairo">
            <h2 id="delete-carried-dialog-title" className="text-lg font-bold text-teal-700 dark:text-amber-400 mb-3">
              {deleteCarriedConfirm.step === 'confirm' ? 'حذف بند مرحّل' : 'كود الأدمن'}
            </h2>
            {deleteCarriedConfirm.step === 'confirm' ? (
              <>
                <p className="text-stone-600 dark:text-slate-300 text-sm leading-relaxed mb-4">هل تريد حذف هذا البند المرحّل؟ يتطلب إدخال كود الأدمن في الخطوة التالية.</p>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={confirmDeleteCarriedItem}
                    className="flex-1 py-2.5 rounded-xl text-sm font-bold bg-red-600 hover:bg-red-500 text-white transition"
                  >
                    نعم
                  </button>
                  <button
                    type="button"
                    onClick={() => { setDeleteCarriedConfirm(null) }}
                    className="flex-1 py-2.5 rounded-xl text-sm font-bold bg-slate-600 hover:bg-slate-500 text-slate-200 transition"
                  >
                    لا
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="text-stone-600 dark:text-slate-300 text-sm leading-relaxed mb-3">ادخل كود الأدمن</p>
                {adminCodeError && (
                  <p className="mb-3 px-3 py-2 rounded-xl bg-red-100 dark:bg-red-500/20 border border-red-300 dark:border-red-500/30 text-red-700 dark:text-red-300 text-sm font-cairo font-semibold" role="alert">
                    كود الأدمن غير صحيح — أدخل الكود الصحيح وأعد المحاولة
                  </p>
                )}
                <div className="relative mb-4">
                  <input
                    type={showAdminCode ? 'text' : 'password'}
                    value={adminCodeInput}
                    onChange={(e) => { setAdminCodeInput(e.target.value); setAdminCodeError(false) }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') submitDeleteCarriedWithCode()
                      if (e.key === 'Escape') { setDeleteCarriedConfirm(null); setAdminCodeInput(''); setAdminCodeError(false) }
                    }}
                    placeholder="كود الأدمن"
                    className={`w-full pl-3 pr-10 py-2 rounded-xl bg-slate-900 border text-white text-sm font-cairo focus:ring-1 focus:ring-amber-500/25 ${adminCodeError ? 'border-red-500 dark:border-red-400' : 'border-white/10 focus:border-amber-500/50'}`}
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShowAdminCode((v) => !v)}
                    className="absolute left-2 top-1/2 -translate-y-1/2 p-1 rounded text-stone-500 hover:text-teal-600 transition"
                    aria-label={showAdminCode ? 'إخفاء الكود' : 'إظهار الكود'}
                  >
                    {showAdminCode ? (
                      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24 4.24" /><path d="M1 1l22 22" /></svg>
                    ) : (
                      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                    )}
                  </button>
                </div>
                <div className="flex gap-3">
                  <button type="button" onClick={submitDeleteCarriedWithCode} className="flex-1 py-2.5 rounded-xl text-sm font-bold bg-red-600 hover:bg-red-500 text-white transition">تأكيد</button>
                  <button type="button" onClick={() => { setDeleteCarriedConfirm(null); setAdminCodeInput(''); setShowAdminCode(false); setAdminCodeError(false) }} className="flex-1 py-2.5 rounded-xl text-sm font-bold bg-slate-600 hover:bg-slate-500 text-slate-200 transition">إلغاء</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="delete-dialog-title">
          <div className="rounded-2xl border border-stone-300 dark:border-white/10 bg-stone-50 dark:bg-slate-800 shadow-2xl max-w-md w-full p-5 font-cairo">
            <h2 id="delete-dialog-title" className="text-lg font-bold text-teal-700 dark:text-amber-400 mb-3">
              {deleteConfirm.step === 'confirm' ? 'حذف الصف' : 'كود الأدمن'}
            </h2>
            {deleteConfirm.step === 'confirm' ? (
              <>
                <p className="text-stone-600 dark:text-slate-300 text-sm leading-relaxed mb-4">هل تريد حذف الصف؟</p>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={confirmDeleteRow}
                    className="flex-1 py-2.5 rounded-xl text-sm font-bold bg-red-600 hover:bg-red-500 text-white transition"
                  >
                    نعم
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteConfirm(null)}
                    className="flex-1 py-2.5 rounded-xl text-sm font-bold bg-slate-600 hover:bg-slate-500 text-slate-200 transition"
                  >
                    لا
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="text-stone-600 dark:text-slate-300 text-sm leading-relaxed mb-3">ادخل كود الأدمن</p>
                {adminCodeError && (
                  <p className="mb-3 px-3 py-2 rounded-xl bg-red-100 dark:bg-red-500/20 border border-red-300 dark:border-red-500/30 text-red-700 dark:text-red-300 text-sm font-cairo font-semibold" role="alert">
                    كود الأدمن غير صحيح — أدخل الكود الصحيح وأعد المحاولة
                  </p>
                )}
                <div className="relative mb-4">
                  <input
                    type={showAdminCode ? 'text' : 'password'}
                    value={adminCodeInput}
                    onChange={(e) => { setAdminCodeInput(e.target.value); setAdminCodeError(false) }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') submitDeleteWithCode()
                      if (e.key === 'Escape') { setDeleteConfirm(null); setAdminCodeInput(''); setAdminCodeError(false) }
                    }}
                    placeholder="كود الأدمن"
                    className={`w-full pl-3 pr-10 py-2 rounded-xl bg-slate-900 border text-white text-sm font-cairo focus:ring-1 focus:ring-amber-500/25 ${adminCodeError ? 'border-red-500 dark:border-red-400' : 'border-white/10 focus:border-amber-500/50'}`}
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShowAdminCode((v) => !v)}
                    className="absolute left-2 top-1/2 -translate-y-1/2 p-1 rounded text-stone-500 hover:text-teal-600 transition"
                    aria-label={showAdminCode ? 'إخفاء الكود' : 'إظهار الكود'}
                    title={showAdminCode ? 'إخفاء' : 'إظهار'}
                  >
                    {showAdminCode ? (
                      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24 4.24" />
                        <path d="M1 1l22 22" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    )}
                  </button>
                </div>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={submitDeleteWithCode}
                    className="flex-1 py-2.5 rounded-xl text-sm font-bold bg-red-600 hover:bg-red-500 text-white transition"
                  >
                    تأكيد
                  </button>
                  <button
                    type="button"
                    onClick={() => { setDeleteConfirm(null); setAdminCodeInput(''); setShowAdminCode(false); setAdminCodeError(false) }}
                    className="flex-1 py-2.5 rounded-xl text-sm font-bold bg-slate-600 hover:bg-slate-500 text-slate-200 transition"
                  >
                    إلغاء
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {deleteAllClosedConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="delete-all-dialog-title">
          <div className="rounded-2xl border border-stone-300 dark:border-white/10 bg-stone-50 dark:bg-slate-800 shadow-2xl max-w-md w-full p-5 font-cairo">
            <h2 id="delete-all-dialog-title" className="text-lg font-bold text-teal-700 dark:text-amber-400 mb-3">
              {deleteAllClosedConfirm.step === 'confirm' ? 'حذف كل التقفيلات المغلقة' : 'كود الأدمن'}
            </h2>
            {deleteAllClosedConfirm.step === 'confirm' ? (
              <>
                <p className="text-stone-600 dark:text-slate-300 text-sm leading-relaxed mb-4">هل تريد حذف كل التقفيلات المغلقة؟</p>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={confirmDeleteAllClosed}
                    className="flex-1 py-2.5 rounded-xl text-sm font-bold bg-red-600 hover:bg-red-500 text-white transition"
                  >
                    نعم
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteAllClosedConfirm(null)}
                    className="flex-1 py-2.5 rounded-xl text-sm font-bold bg-slate-600 hover:bg-slate-500 text-slate-200 transition"
                  >
                    لا
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="text-stone-600 dark:text-slate-300 text-sm leading-relaxed mb-3">ادخل كود الأدمن</p>
                {adminCodeError && (
                  <p className="mb-3 px-3 py-2 rounded-xl bg-red-100 dark:bg-red-500/20 border border-red-300 dark:border-red-500/30 text-red-700 dark:text-red-300 text-sm font-cairo font-semibold" role="alert">
                    كود الأدمن غير صحيح — أدخل الكود الصحيح وأعد المحاولة
                  </p>
                )}
                <div className="relative mb-4">
                  <input
                    type={showAdminCode ? 'text' : 'password'}
                    value={adminCodeInput}
                    onChange={(e) => { setAdminCodeInput(e.target.value); setAdminCodeError(false) }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') submitDeleteAllClosedWithCode()
                      if (e.key === 'Escape') { setDeleteAllClosedConfirm(null); setAdminCodeInput(''); setAdminCodeError(false) }
                    }}
                    placeholder="كود الأدمن"
                    className={`w-full pl-3 pr-10 py-2 rounded-xl bg-slate-900 border text-white text-sm font-cairo focus:ring-1 focus:ring-amber-500/25 ${adminCodeError ? 'border-red-500 dark:border-red-400' : 'border-white/10 focus:border-amber-500/50'}`}
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShowAdminCode((v) => !v)}
                    className="absolute left-2 top-1/2 -translate-y-1/2 p-1 rounded text-stone-500 hover:text-teal-600 transition"
                    aria-label={showAdminCode ? 'إخفاء الكود' : 'إظهار الكود'}
                    title={showAdminCode ? 'إخفاء' : 'إظهار'}
                  >
                    {showAdminCode ? (
                      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24 4.24" />
                        <path d="M1 1l22 22" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    )}
                  </button>
                </div>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={submitDeleteAllClosedWithCode}
                    className="flex-1 py-2.5 rounded-xl text-sm font-bold bg-red-600 hover:bg-red-500 text-white transition"
                  >
                    تأكيد
                  </button>
                  <button
                    type="button"
                    onClick={() => { setDeleteAllClosedConfirm(null); setAdminCodeInput(''); setShowAdminCode(false); setAdminCodeError(false) }}
                    className="flex-1 py-2.5 rounded-xl text-sm font-bold bg-slate-600 hover:bg-slate-500 text-slate-200 transition"
                  >
                    إلغاء
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {switchBranchConfirm && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="switch-branch-dialog-title">
          <div className="rounded-2xl border border-stone-300 dark:border-white/10 bg-stone-50 dark:bg-slate-800 shadow-2xl max-w-md w-full p-5 font-cairo">
            <h2 id="switch-branch-dialog-title" className="text-lg font-bold text-teal-700 dark:text-amber-400 mb-3">
              تغيير الفرع
            </h2>
            <p className="text-stone-600 dark:text-slate-300 text-sm leading-relaxed mb-4">
              هل تريد الانتقال إلى فرع {BRANCH_LABELS[switchBranchConfirm]}؟
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => {
                  onSwitchBranch(switchBranchConfirm)
                  setSwitchBranchConfirm(null)
                }}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold bg-teal-600 hover:bg-teal-500 text-white transition"
              >
                نعم، الانتقال
              </button>
              <button
                type="button"
                onClick={() => setSwitchBranchConfirm(null)}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold bg-slate-600 hover:bg-slate-500 text-slate-200 transition"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const NUM_FIELDS = ['cash', 'sentToTreasury', 'expenseCompensation', 'expenses', 'mada', 'visa', 'mastercard', 'bankTransfer', 'programBalanceCash', 'programBalanceBank'] as const
