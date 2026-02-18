import { useCallback, useEffect, useMemo, useState } from 'react'
import { computeBankVariance, computeCashVariance, formatCurrency, formatDateTime, toLatinDigits } from '../lib/utils'
import type { ClosureRow as Row } from '../types'
import type { ExcelDetails } from '../lib/excelParser'

interface ClosureRowProps {
  row: Row
  rowNumber: number
  /** ترتيب الصف (0-based) لتباين زوجي/فردي */
  rowIndex?: number
  isFirstActive: boolean
  liveNow: Date
  closingRowId: string | null
  closingSecondsLeft: number
  onUpdate: (id: string, field: keyof Row, value: number | string) => void
  isSelected?: boolean
  onToggleSelect?: (id: string) => void
  onDeleteRow?: (id: string) => void
  onPrintRow?: (id: string) => void
  /** فتح نافذة تصنيف المصروفات بعد إدخال المبلغ */
  onOpenExpenseDetails?: (rowId: string) => void
  /** عند النقر على حقل المصروفات وهو فيه قيمة: مسح الرقم والتصنيف وفتح النافذة من جديد */
  onClearExpensesAndOpen?: (rowId: string) => void
  /** عند النقر على خانة معطّلة (قبل إدخال رصيد البرنامج كاش) لإظهار تنبيه */
  onLockedFieldClick?: () => void
  /** عند إدخال تعويض مصروفات أكبر من المصروفات (لإظهار تنبيه) */
  onExpenseCompensationExceeded?: (maxAllowed: number) => void
  /** تفاصيل آخر استيراد إكسل (عمليات مدى/فيزا/ماستر/تحويل) — عند النقر على المبلغ تظهر نافذة التفاصيل */
  lastExcelDetails?: ExcelDetails | null
  /** فتح نافذة سجل التغيير (من إكسل / مرحّل / معدّل يدوياً) لعمود معيّن في صف معيّن */
  onShowExcelDetails?: (field: keyof ExcelDetails, rowId: string) => void
  /** تأكيد التعديل اليدوي للخانات التي تستقبل بيانات من الإكسل (مدى/فيزا/ماستر/تحويل بنكي) */
  onRequestConfirmBankEdit?: (rowId: string, field: keyof Row, oldValue: number, newValue: number) => void
  /** عند النقر على "أكثر من موظف" — فتح نافذة أسماء الموظفين */
  onShowEmployeeNames?: () => void
  /** عند النقر على انحراف الكاش أو انحراف البنك — فتح نافذة شرح سبب الانحراف (نوع + الصف) */
  onShowVarianceExplanation?: (type: 'cash' | 'bank', row: Row) => void
  /** اسم المستخدم الحالي (الجلسة) — يُعرض للصف النشط الأول بدل row.employeeName ليكون موحّداً مع الهيدر وزر الإغلاق */
  currentUserName?: string
  /** إفراغ كل المدخلات في الصف النشط */
  onClearRow?: (id: string) => void
  /** جعل صفّي التسمية والبيانات ثابتين عند التمرير (مثل الترويسة) */
  isStickyRows?: boolean
}

const NUM_KEYS: (keyof Row)[] = ['cash', 'sentToTreasury', 'expenseCompensation', 'expenses', 'programBalanceCash', 'mada', 'visa', 'mastercard', 'bankTransfer', 'programBalanceBank']

/** إطار خفيف لتجميع خانات الكاش أو البنك في الصف — نفس استدارة الرؤوس (xl) للتماثل */
const FRAME = 'border-stone-200 dark:border-teal-500/20'
const FRAME_FIRST = `border-t-2 border-b-2 border-r-2 ${FRAME} rounded-s-xl`
const FRAME_MID = `border-t-2 border-b-2 ${FRAME}`
const FRAME_LAST = `border-t-2 border-b-2 border-l-2 ${FRAME} rounded-e-xl`

export function ClosureRowComp({
  row,
  rowNumber,
  rowIndex = 0,
  isFirstActive,
  liveNow,
  closingRowId,
  closingSecondsLeft,
  onUpdate,
  isSelected = false,
  onToggleSelect,
  onDeleteRow,
  onPrintRow,
  onOpenExpenseDetails,
  onClearExpensesAndOpen: _onClearExpensesAndOpen,
  onLockedFieldClick,
  onExpenseCompensationExceeded,
  lastExcelDetails,
  onShowExcelDetails,
  onRequestConfirmBankEdit,
  onShowEmployeeNames,
  onShowVarianceExplanation,
  currentUserName,
  onClearRow,
  isStickyRows = false,
}: ClosureRowProps) {
  const displayName = isFirstActive && currentUserName ? currentUserName : row.employeeName
  const bankVariance = useMemo(() => computeBankVariance(row), [
    row.mada,
    row.visa,
    row.mastercard,
    row.bankTransfer,
    row.programBalanceBank,
  ])
  const cashVariance = useMemo(
    () => computeCashVariance(row),
    [row.cash, row.sentToTreasury, row.programBalanceCash, row.expenses, row.expenseCompensation]
  )
  const carriedExpenseTotal = useMemo(() => {
    const n = row.carriedExpenseCount ?? 0
    const items = row.expenseItems ?? []
    return items.slice(0, n).reduce((s, it) => s + it.amount, 0)
  }, [row.carriedExpenseCount, row.expenseItems])
  const isClosed = row.status === 'closed'
  const isUndoPeriod = closingRowId === row.id

  const handleNumChange = useCallback(
    (field: keyof Row, raw: string) => {
      const normalized = toLatinDigits(raw)
      let v = parseFloat(normalized) || 0
      if (field === 'expenses' && carriedExpenseTotal > 0 && v < carriedExpenseTotal) v = carriedExpenseTotal
      const expenses = (row.expenses as number) ?? 0
      if (field === 'expenseCompensation' && v > expenses) {
        onExpenseCompensationExceeded?.(expenses)
        v = expenses
      }
      onUpdate(row.id, field, v)
    },
    [row.id, row.expenses, onUpdate, carriedExpenseTotal, onExpenseCompensationExceeded]
  )

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === 'Tab') {
      const row = e.currentTarget.closest('tr')
      if (!row) return
      const rowInputs = Array.from(row.querySelectorAll<HTMLInputElement>('input:not([disabled])'))
      const i = rowInputs.indexOf(e.currentTarget)
      const goPrev = e.key === 'Tab' && e.shiftKey
      const goNext = e.key === 'Enter' || (e.key === 'Tab' && !e.shiftKey)
      if (goPrev && i > 0) {
        e.preventDefault()
        rowInputs[i - 1].focus()
      } else if (goNext && i >= 0 && i < rowInputs.length - 1) {
        e.preventDefault()
        rowInputs[i + 1].focus()
      }
      // عند آخر حقل في الصف: عدم منع التاب فينتقل التركيز إلى زر إغلاق الشفت
    }
  }, [])

  const cashVarianceColor =
    cashVariance > 0 ? 'text-emerald-700 dark:text-emerald-400' : cashVariance < 0 ? 'text-red-700 dark:text-red-400' : 'text-stone-800 dark:text-slate-500'
  const bankVarianceColor =
    bankVariance > 0 ? 'text-emerald-700 dark:text-emerald-400' : bankVariance < 0 ? 'text-red-700 dark:text-red-400' : 'text-stone-800 dark:text-slate-500'

  /** رصيد البرنامج كاش إلزامي أولاً — المصروفات (المرحّل) منشط دائماً، باقي الحقول تُفعّل بعد إدخال رصيد البرنامج */
  const programBalanceFilled = (row.programBalanceCash as number) > 0
  const alwaysEnabledFields: (keyof Row)[] = ['programBalanceCash', 'expenses']

  const [programBalancePulse, setProgramBalancePulse] = useState(false)
  const [lockedPulseField, setLockedPulseField] = useState<keyof Row | null>(null)
  /** تعديل مؤقت لحقل بنكي (مدى/فيزا/ماستر/تحويل) قبل التأكيد */
  const [pendingBankEdit, setPendingBankEdit] = useState<{ field: keyof Row; value: number } | null>(null)
  const handleLockedClick = useCallback(
    (field: keyof Row) => {
      onLockedFieldClick?.()
      setProgramBalancePulse(true)
      setLockedPulseField(field)
    },
    [onLockedFieldClick]
  )
  useEffect(() => {
    if (!programBalancePulse) return
    const t = setTimeout(() => setProgramBalancePulse(false), 3000)
    return () => clearTimeout(t)
  }, [programBalancePulse])
  useEffect(() => {
    if (lockedPulseField === null) return
    const t = setTimeout(() => setLockedPulseField(null), 1200)
    return () => clearTimeout(t)
  }, [lockedPulseField])

  const renderNum = (field: keyof Row, opts?: { tabIndex?: number; disabled?: boolean }) => {
    const v = (row[field] as number) ?? 0
    const isBankWithDetails =
      (field === 'mada' || field === 'visa' || field === 'mastercard' || field === 'bankTransfer') &&
      lastExcelDetails?.[field]?.length > 0 &&
      onShowExcelDetails
    // أثناء الإغلاق أو فترة التراجع: عرض فقط — والمصروفات قابلة للنقر لعرض التفاصيل
    if (isClosed || isUndoPeriod) {
      if (field === 'expenses' && onOpenExpenseDetails) {
        return (
          <button
            type="button"
            onClick={() => onOpenExpenseDetails(row.id)}
            className="block w-full py-1.5 text-sm text-stone-800 dark:text-slate-300 font-cairo text-center hover:text-stone-900 hover:bg-stone-200 dark:hover:text-teal-400 dark:hover:bg-white/[0.06] rounded-xl transition cursor-pointer"
            title="عرض تفاصيل المصروفات"
          >
            {v === 0 ? '—' : formatCurrency(v)}
          </button>
        )
      }
      if (isBankWithDetails && onShowExcelDetails) {
        return (
          <div className="flex items-center gap-1 w-full">
            <span className="flex-1 min-w-0 py-1.5 text-sm text-stone-800 dark:text-slate-300 font-cairo text-center tabular-nums">{v === 0 ? '—' : formatCurrency(v)}</span>
            <button
              type="button"
              onClick={() => onShowExcelDetails(field, row.id)}
              className="shrink-0 p-1 rounded-lg text-stone-500 hover:text-stone-800 hover:bg-stone-200 dark:hover:text-teal-400 dark:hover:bg-white/10 transition"
              title="سجل التغيير (من إكسل / مرحّل / معدّل يدوياً)"
              aria-label="سجل التغيير"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 8v4l2 2"/><circle cx="12" cy="12" r="10"/></svg>
            </button>
          </div>
        )
      }
      return <span className="block py-1.5 text-sm text-stone-800 dark:text-slate-300 font-cairo text-center">{v === 0 ? '—' : formatCurrency(v)}</span>
    }
    // الصف مفتوح: مدى/فيزا/ماستر/تحويل — دائماً حقل قابل للتعديل اليدوي؛ إن وُجدت تفاصيل إكسل نضيف زر سجل التغيير
    const isExpenses = field === 'expenses'
    const disabled = opts?.disabled ?? (!alwaysEnabledFields.includes(field) && !programBalanceFilled)
    const tabIndex = opts?.tabIndex ?? (field === 'programBalanceCash' && isFirstActive ? 0 : disabled ? -1 : 1)
    const needsConfirmEdit = isBankWithDetails && onRequestConfirmBankEdit && ['mada', 'visa', 'mastercard', 'bankTransfer'].includes(field)
    const displayVal = needsConfirmEdit && pendingBankEdit?.field === field
      ? (pendingBankEdit.value === 0 ? '' : String(pendingBankEdit.value))
      : (v === 0 ? '' : String(v))
    const inputEl = (
      <input
        type="text"
        inputMode="decimal"
        value={displayVal}
        onChange={(e) => {
          const raw = toLatinDigits(e.target.value).replace(/[^\d.]/g, '')
          const dotIdx = raw.indexOf('.')
          const oneDot = dotIdx === -1 ? raw : raw.slice(0, dotIdx + 1) + raw.slice(dotIdx + 1).replace(/\./g, '')
          const parsed = parseFloat(oneDot) || 0
          if (needsConfirmEdit) {
            setPendingBankEdit({ field, value: parsed })
          } else {
            handleNumChange(field, oneDot)
          }
        }}
        onBlur={() => {
          if (needsConfirmEdit && pendingBankEdit?.field === field) {
            const newVal = pendingBankEdit.value
            setPendingBankEdit(null)
            if (newVal !== v) {
              onRequestConfirmBankEdit(row.id, field, v, newVal)
            }
          }
        }}
        dir="ltr"
        aria-label={field}
        onKeyDown={handleKeyDown}
        onFocus={(e) => {
          e.currentTarget.select()
          if (isExpenses && onOpenExpenseDetails) onOpenExpenseDetails(row.id)
        }}
        placeholder="—"
        tabIndex={tabIndex}
        disabled={disabled}
        title={disabled ? 'لا يمكن الإدخال قبل إدخال رصيد البرنامج كاش' : (field === 'expenseCompensation' ? 'يجب أن يكون مساوياً أو أقل من مبلغ المصروفات' : undefined)}
        className="cashbox-input w-full min-h-[2.25rem] px-2 py-2 rounded-xl bg-white dark:bg-slate-900/70 border-2 border-stone-400 dark:border-white/[0.06] text-stone-900 dark:text-white text-sm font-cairo text-center focus:border-teal-500/50 focus:ring-2 focus:ring-teal-500/20 dark:focus:border-teal-500/40 dark:focus:ring-teal-500/20 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
      />
    )
    if (disabled && onLockedFieldClick) {
      return (
        <div
          role="button"
          tabIndex={0}
          className="locked-field-wrapper w-full cursor-not-allowed rounded-lg"
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            handleLockedClick(field)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              handleLockedClick(field)
            }
          }}
          title="لا يمكن الإدخال قبل إدخال رصيد البرنامج كاش"
        >
          {inputEl}
        </div>
      )
    }
    // مدى/فيزا/ماستر/تحويل مع تفاصيل إكسل: حقل تعديل + زر سجل التغيير
    if (isBankWithDetails && onShowExcelDetails) {
      return (
        <div className="flex items-center gap-1 w-full">
          <div className="flex-1 min-w-0">{inputEl}</div>
          <button
            type="button"
            onClick={() => onShowExcelDetails(field, row.id)}
            className="shrink-0 p-1 rounded-lg text-stone-500 hover:text-stone-800 hover:bg-stone-200 dark:hover:text-teal-400 dark:hover:bg-white/10 transition"
            title="سجل التغيير (من إكسل / مرحّل / معدّل يدوياً)"
            aria-label="سجل التغيير"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 8v4l2 2"/><circle cx="12" cy="12" r="10"/></svg>
          </button>
        </div>
      )
    }
    return inputEl
  }

  const pulseDuration = isUndoPeriod && closingSecondsLeft > 0
    ? closingSecondsLeft <= 1 ? '0.35s' : closingSecondsLeft <= 2 ? '0.6s' : closingSecondsLeft <= 3 ? '1s' : '1.5s'
    : undefined

  const labelDateTime = isClosed && row.closedAt ? formatDateTime(row.closedAt) : formatDateTime(liveNow)

  /* ثابتان عند تمرير الصفحة: تحت الترويسة (top-14=56px) + thead (~48px) + label (~36px) — ليبقيا ظاهرين عند السكرول للأسفل */
  const stickyLabelClass = isStickyRows ? 'sticky top-[6.5rem] sm:top-[7rem] z-[9] bg-[#ebe6df]/98 dark:bg-slate-800/98 shadow-[0_2px_8px_rgba(0,0,0,0.08)] dark:shadow-[0_2px_8px_rgba(0,0,0,0.2)] border-b-2 border-stone-500 dark:border-teal-500/20' : ''
  const stickyDataClass = isStickyRows ? 'sticky top-[8.75rem] sm:top-[9.25rem] z-[9] bg-white dark:bg-slate-800/95 shadow-[0_2px_8px_rgba(0,0,0,0.08)] dark:shadow-[0_2px_8px_rgba(0,0,0,0.2)] border-b-2 border-stone-500 dark:border-teal-500/20' : ''

  /* خلفية صف البيانات — نضعها على الخانات الوسطى فقط؛ تحديد وم وإجراءات شفافة */
  const rowBgClass =
    isUndoPeriod
      ? 'bg-sky-100 dark:bg-sky-500/10'
      : isClosed
        ? rowIndex % 2 === 0
          ? 'bg-[#f2ede5] dark:bg-slate-800/40'
          : 'bg-[#ebe6df] dark:bg-slate-800/25'
        : rowIndex % 2 === 0
          ? 'bg-[#f8f4ee] dark:bg-slate-800/30 hover:bg-[#f2ede5] dark:hover:bg-slate-800/40'
          : 'bg-[#f2ede5] dark:bg-slate-800/20 hover:bg-[#ebe6df] dark:hover:bg-slate-800/35'

  return (
    <>
      {/* صف التسمية: اسم الموظف + التاريخ — خلفية شفافة + لمسة تركواز يسار فقط */}
      <tr data-row-id={row.id} className={`bg-transparent border-l-4 border-l-teal-500 dark:border-l-teal-500/40 border-b-2 border-stone-500 dark:border-teal-500/20 ${isStickyRows ? 'sticky-label-row' : ''}`}>
        <td
          colSpan={16}
          className={`py-1 px-2 sm:px-3 align-middle text-[10px] sm:text-[11px] font-semibold font-cairo whitespace-nowrap ${stickyLabelClass}`}
          style={{ lineHeight: 1.2, verticalAlign: 'middle', paddingInlineStart: '4%' }}
        >
          <span className="inline-flex items-center gap-2 flex-wrap rounded-lg border-2 border-stone-400 dark:border-teal-500/30 bg-stone-50 dark:bg-teal-500/10 px-2.5 py-1 shadow-sm dark:shadow-[0_2px_6px_rgba(20,184,166,0.08)]">
            {displayName === 'أكثر من موظف' && onShowEmployeeNames ? (
              <button
                type="button"
                onClick={onShowEmployeeNames}
                className="text-stone-800 dark:text-teal-400 hover:text-stone-900 dark:hover:text-teal-300 underline underline-offset-1 cursor-pointer transition-colors font-semibold"
                title="عرض أسماء الموظفين"
              >
                أكثر من موظف
              </button>
            ) : (
              <span className="font-semibold text-stone-900 dark:text-teal-300">{displayName}</span>
            )}
            <span className="text-stone-500 dark:text-slate-400">·</span>
            <span className="tabular-nums font-medium text-stone-600 dark:text-slate-400">{labelDateTime}</span>
          </span>
        </td>
      </tr>
      {/* صف البيانات — خلفية الصف على الخانات الوسطى فقط؛ تحديد وم وإجراءات شفافة */}
      <tr
        data-row-id={row.id}
        className={`bg-transparent ${
          isUndoPeriod
            ? 'animate-pulse border-l-2 border-r-2 border-l-sky-400/50 border-r-sky-400/50 border-b-2 border-stone-500 dark:border-teal-500/20'
            : 'border-b-2 border-stone-500 dark:border-slate-600 transition-colors'
        } ${isStickyRows ? 'sticky-data-row' : ''}`}
        style={pulseDuration ? { animationDuration: pulseDuration } : undefined}
      >
        <td className={`p-1 text-center align-middle bg-transparent ${stickyDataClass}`}>
          {onToggleSelect && (
            <div className="flex items-center justify-center">
            <button
              type="button"
              onClick={() => onToggleSelect(row.id)}
              aria-label={isSelected ? 'إلغاء تحديد الصف' : 'تحديد الصف للطباعة'}
              className={`inline-flex items-center justify-center w-4 h-4 rounded-md border-2 transition-all ${
                isSelected
                  ? 'border-teal-500 bg-teal-100 text-teal-600 ring-2 ring-teal-500/30 ring-offset-2 ring-offset-stone-50 dark:border-teal-500/60 dark:bg-teal-500/20 dark:text-teal-400 dark:ring-teal-500/30 dark:ring-offset-slate-800'
                  : 'border-2 border-stone-500 dark:border-white/20 bg-stone-300 dark:bg-slate-800/60 text-stone-800 dark:text-slate-400 hover:border-teal-400 dark:hover:border-teal-500/40 hover:text-teal-600 dark:hover:text-teal-400/90 shadow-sm'
              }`}
            >
              {isSelected ? (
                <svg className="w-2 h-2 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6L9 17l-5-5" />
                </svg>
              ) : (
                <span className="w-2 h-2 block shrink-0" />
              )}
            </button>
            </div>
          )}
        </td>
        <td className={`p-1 text-center text-stone-800 dark:text-slate-400 text-xs font-medium font-cairo align-middle tabular-nums bg-transparent ${stickyDataClass}`}>{rowNumber}</td>
        {NUM_KEYS.slice(0, 4).map((k) => (
        <td
          key={k}
          data-transfer-target
          data-field={k}
          data-row-id={row.id}
          className={`p-1.5 text-center align-middle ${rowBgClass} ${lockedPulseField === k ? 'locked-cell-pulse' : ''} ${stickyDataClass} ${k === 'cash' ? FRAME_FIRST : FRAME_MID}`}
        >
          {renderNum(k)}
        </td>
      ))}
      <td
        data-transfer-target
        data-field="programBalanceCash"
        data-row-id={row.id}
        className={`p-1.5 text-center align-middle ${rowBgClass} ${programBalancePulse && isFirstActive ? 'program-balance-pulse-cell' : ''} ${stickyDataClass} ${FRAME_MID}`}
        title={!programBalanceFilled && isFirstActive ? 'لا يمكن الإدخال في الخانات الأخرى قبل إدخال رصيد البرنامج كاش هنا' : undefined}
      >
        {renderNum('programBalanceCash')}
      </td>
      <td className={`p-1.5 text-center align-middle ${rowBgClass} ${stickyDataClass} ${FRAME_LAST}`}>
        {onShowVarianceExplanation ? (
          <button
            type="button"
            onClick={() => onShowVarianceExplanation('cash', row)}
            className={`block w-full min-h-[2.25rem] py-2 px-2 rounded-xl border-2 border-stone-400 dark:border-white/[0.06] bg-white dark:bg-slate-900/70 text-sm font-cairo text-center tabular-nums transition cursor-pointer hover:bg-stone-50 dark:hover:bg-white/[0.06] focus:outline-none focus:ring-2 focus:ring-teal-500/20 ${cashVariance === 0 ? 'cursor-default text-stone-500 dark:text-slate-500' : `${cashVarianceColor}`}`}
            title={cashVariance === 0 ? undefined : 'شرح سبب انحراف الكاش'}
            disabled={cashVariance === 0}
          >
            {cashVariance === 0 ? '—' : formatCurrency(cashVariance)}
          </button>
        ) : (
          <span className={`block w-full min-h-[2.25rem] py-2 px-2 rounded-xl border-2 border-stone-400 dark:border-white/[0.06] bg-white dark:bg-slate-900/70 text-sm font-cairo text-center tabular-nums ${cashVariance === 0 ? 'text-stone-500 dark:text-slate-500' : cashVarianceColor}`}>{cashVariance === 0 ? '—' : formatCurrency(cashVariance)}</span>
        )}
      </td>
      {NUM_KEYS.slice(5, 9).map((k) => (
        <td
          key={k}
          data-transfer-target
          data-field={k}
          data-row-id={row.id}
          className={`p-1.5 text-center align-middle ${rowBgClass} ${lockedPulseField === k ? 'locked-cell-pulse' : ''} ${stickyDataClass} ${k === 'mada' ? FRAME_FIRST : FRAME_MID}`}
        >
          {renderNum(k)}
        </td>
      ))}
      <td className={`p-1.5 text-center align-middle ${rowBgClass} ${stickyDataClass} ${FRAME_MID}`}>
        <span className="block w-full min-h-[2.25rem] py-2 px-2 rounded-xl border-2 border-stone-400 dark:border-white/[0.06] bg-white dark:bg-slate-900/70 text-sm font-cairo text-center tabular-nums text-stone-800 dark:text-slate-200 font-medium">
          {(() => {
            const total = row.mada + row.visa + row.mastercard
            return total === 0 ? '—' : formatCurrency(total)
          })()}
        </span>
      </td>
      <td
        data-transfer-target
        data-field="programBalanceBank"
        data-row-id={row.id}
        className={`p-1.5 text-center align-middle ${rowBgClass} ${lockedPulseField === 'programBalanceBank' ? 'locked-cell-pulse' : ''} ${stickyDataClass} ${FRAME_MID}`}
      >
        {renderNum('programBalanceBank')}
      </td>
      <td className={`p-1.5 text-center align-middle ${rowBgClass} ${stickyDataClass} ${FRAME_LAST}`}>
        {onShowVarianceExplanation ? (
          <button
            type="button"
            onClick={() => onShowVarianceExplanation('bank', row)}
            className={`block w-full min-h-[2.25rem] py-2 px-2 rounded-xl border-2 border-stone-400 dark:border-white/[0.06] bg-white dark:bg-slate-900/70 text-sm font-cairo text-center tabular-nums transition cursor-pointer hover:bg-stone-50 dark:hover:bg-white/[0.06] focus:outline-none focus:ring-2 focus:ring-teal-500/20 ${bankVariance === 0 ? 'cursor-default text-stone-500 dark:text-slate-500' : `${bankVarianceColor}`}`}
            title={bankVariance === 0 ? undefined : 'شرح سبب انحراف البنك'}
            disabled={bankVariance === 0}
          >
            {bankVariance === 0 ? '—' : formatCurrency(bankVariance)}
          </button>
        ) : (
          <span className={`block w-full min-h-[2.25rem] py-2 px-2 rounded-xl border-2 border-stone-400 dark:border-white/[0.06] bg-white dark:bg-slate-900/70 text-sm font-cairo text-center tabular-nums ${bankVariance === 0 ? 'text-stone-500 dark:text-slate-500' : bankVarianceColor}`}>{bankVariance === 0 ? '—' : formatCurrency(bankVariance)}</span>
        )}
      </td>
      <td className={`px-0.5 py-0.5 text-center align-middle overflow-hidden min-w-0 bg-transparent ${stickyDataClass}`}>
        {isClosed ? (
          <div className="flex flex-row items-center justify-center gap-0.5 flex-wrap min-w-0 w-full">
            <span className="inline-flex items-center gap-0.5 rounded-full px-1 py-0.5 bg-emerald-100 dark:bg-emerald-500/15 border border-emerald-300 dark:border-emerald-500/25 text-[8px] font-medium text-emerald-700 dark:text-emerald-400/95 font-cairo whitespace-nowrap shrink-0">
              <svg className="w-2 h-2 text-emerald-600 dark:text-emerald-500 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6L9 17l-5-5" />
              </svg>
              تم الإغلاق
            </span>
            {(onDeleteRow || onPrintRow) && (
              <div className="inline-flex items-center justify-center gap-0.5 shrink-0">
                {onDeleteRow && (
                  <button
                    type="button"
                    onClick={() => onDeleteRow(row.id)}
                    aria-label="حذف الصف"
                    className="inline-flex items-center justify-center w-4 h-4 rounded border border-stone-400 dark:border-red-500/20 bg-stone-400 dark:bg-slate-700/50 text-white dark:text-slate-400 hover:bg-red-100 dark:hover:bg-red-500/15 hover:text-red-600 dark:hover:text-red-400 transition-all shrink-0"
                    title="حذف الصف"
                  >
                    <svg className="w-2 h-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M18 6L6 18M6 6l12 12" />
                    </svg>
                  </button>
                )}
                {onPrintRow && (
                  <button
                    type="button"
                    onClick={() => onPrintRow(row.id)}
                    aria-label="طباعة الصف"
                    className="inline-flex items-center justify-center w-4 h-4 rounded border border-stone-500 dark:border-teal-500/25 bg-stone-400 dark:bg-slate-700/50 text-white dark:text-slate-400 hover:bg-stone-300 dark:hover:bg-teal-500/15 hover:text-teal-400 transition-all shrink-0"
                    title="طباعة هذه التقفيلة"
                  >
                    <svg className="w-2 h-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M6 9V2h12v7" />
                      <path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2" />
                      <path d="M6 14h12v8H6z" />
                    </svg>
                  </button>
                )}
              </div>
            )}
          </div>
        ) : (
          onClearRow ? (
            <button
              type="button"
              onClick={() => onClearRow(row.id)}
              title="افراغ كل المدخلات في الصف النشط"
              className="inline-flex items-center justify-center rounded px-0.5 py-0.5 bg-stone-200 dark:bg-teal-500/15 border border-stone-400 dark:border-teal-500/30 text-[8px] font-medium text-stone-800 dark:text-teal-400 font-cairo whitespace-nowrap w-full min-w-0 truncate hover:bg-stone-300 dark:hover:bg-teal-500/25 transition"
            >
              افراغ
            </button>
          ) : (
            <span className="inline-flex items-center justify-center rounded px-0.5 py-0.5 bg-stone-200 dark:bg-teal-500/15 border border-stone-400 dark:border-teal-500/30 text-[8px] font-medium text-stone-800 dark:text-teal-400 font-cairo whitespace-nowrap w-full min-w-0 truncate">
              الشفت الحالي
            </span>
          )
        )}
      </td>
      </tr>
    </>
  )
}
