import { useCallback, useEffect, useMemo, useState } from 'react'
import { computeBankVariance, computeCashVariance, formatCurrency, formatDateTime, toLatinDigits } from '../lib/utils'
import type { ClosureRow as Row } from '../types'
import type { ExcelDetails } from '../lib/excelParser'

interface ClosureRowProps {
  row: Row
  rowNumber: number
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
  /** فتح نافذة تفاصيل عمليات طريقة الدفع (مدى، فيزا، ...) */
  onShowExcelDetails?: (field: keyof ExcelDetails) => void
  /** عند النقر على "أكثر من موظف" — فتح نافذة أسماء الموظفين */
  onShowEmployeeNames?: () => void
  /** عند النقر على انحراف الكاش أو انحراف البنك — فتح نافذة شرح سبب الانحراف (نوع + الصف) */
  onShowVarianceExplanation?: (type: 'cash' | 'bank', row: Row) => void
}

const NUM_KEYS: (keyof Row)[] = ['cash', 'sentToTreasury', 'expenseCompensation', 'expenses', 'programBalanceCash', 'mada', 'visa', 'mastercard', 'bankTransfer', 'programBalanceBank']

export function ClosureRowComp({
  row,
  rowNumber,
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
  onShowEmployeeNames,
  onShowVarianceExplanation,
}: ClosureRowProps) {
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
    cashVariance > 0 ? 'text-emerald-400' : cashVariance < 0 ? 'text-red-400' : 'text-slate-500'
  const bankVarianceColor =
    bankVariance > 0 ? 'text-emerald-400' : bankVariance < 0 ? 'text-red-400' : 'text-slate-500'

  /** رصيد البرنامج كاش إلزامي أولاً — المصروفات (المرحّل) منشط دائماً، باقي الحقول تُفعّل بعد إدخال رصيد البرنامج */
  const programBalanceFilled = (row.programBalanceCash as number) > 0
  const alwaysEnabledFields: (keyof Row)[] = ['programBalanceCash', 'expenses']

  const [programBalancePulse, setProgramBalancePulse] = useState(false)
  const [lockedPulseField, setLockedPulseField] = useState<keyof Row | null>(null)
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
            className="block w-full py-1.5 text-sm text-slate-300 font-cairo text-center hover:text-amber-400 hover:bg-white/[0.06] rounded-xl transition cursor-pointer"
            title="عرض تفاصيل المصروفات"
          >
            {v === 0 ? '—' : formatCurrency(v)}
          </button>
        )
      }
      if (isBankWithDetails) {
        return (
          <button
            type="button"
            onClick={() => onShowExcelDetails(field)}
            className="block w-full py-1.5 text-sm text-slate-300 font-cairo text-center hover:text-amber-400 hover:bg-white/5 rounded-lg transition cursor-pointer"
            title="عرض تفاصيل العمليات"
          >
            {v === 0 ? '—' : formatCurrency(v)}
          </button>
        )
      }
      return <span className="block py-1.5 text-sm text-slate-300 font-cairo text-center">{v === 0 ? '—' : formatCurrency(v)}</span>
    }
    // الصف مفتوح: مدى/فيزا/ماستر/تحويل وعندها تفاصيل إكسل → الرقم نفسه قابل للنقر لفتح التفاصيل (بدون زر منفصل)
    if (isBankWithDetails) {
      return (
        <button
          type="button"
          onClick={() => onShowExcelDetails(field)}
          className="block w-full py-1.5 text-sm font-cairo text-center hover:text-amber-400 hover:bg-white/[0.06] rounded-xl transition cursor-pointer border border-transparent hover:border-amber-500/20 cashbox-input bg-slate-900/70 text-white"
          title="عرض تفاصيل العمليات"
        >
          {v === 0 ? '—' : formatCurrency(v)}
        </button>
      )
    }
    const isExpenses = field === 'expenses'
    const disabled = opts?.disabled ?? (!alwaysEnabledFields.includes(field) && !programBalanceFilled)
    const tabIndex = opts?.tabIndex ?? (field === 'programBalanceCash' && isFirstActive ? 0 : disabled ? -1 : 1)
    const inputEl = (
      <input
        type="text"
        inputMode="decimal"
        value={v === 0 ? '' : String(v)}
        onChange={(e) => {
          const raw = toLatinDigits(e.target.value).replace(/[^\d.]/g, '')
          const dotIdx = raw.indexOf('.')
          const oneDot = dotIdx === -1 ? raw : raw.slice(0, dotIdx + 1) + raw.slice(dotIdx + 1).replace(/\./g, '')
          handleNumChange(field, oneDot)
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
        className="cashbox-input w-full px-2 py-2 rounded-xl bg-slate-900/70 border border-white/[0.06] text-white text-sm font-cairo text-center focus:border-amber-500/40 focus:ring-2 focus:ring-amber-500/20 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed transition-all"
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
    return inputEl
  }

  const pulseDuration = isUndoPeriod && closingSecondsLeft > 0
    ? closingSecondsLeft <= 1 ? '0.35s' : closingSecondsLeft <= 2 ? '0.6s' : closingSecondsLeft <= 3 ? '1s' : '1.5s'
    : undefined

  const labelDateTime = isClosed && row.closedAt ? formatDateTime(row.closedAt) : formatDateTime(liveNow)

  return (
    <>
      {/* صف التسمية: اسم الموظف + التاريخ — شريط لوني يسار + خط رفيع 2026 */}
      <tr data-row-id={row.id} className="bg-amber-500/[0.06] border-l-2 border-l-amber-500/40">
        <td
          colSpan={15}
          className="py-1.5 px-3 align-middle text-[11px] font-cairo text-amber-200/90 whitespace-nowrap"
          style={{ lineHeight: 1.2, verticalAlign: 'middle' }}
        >
          <span className="inline-flex items-center gap-2 flex-wrap">
            {row.employeeName === 'أكثر من موظف' && onShowEmployeeNames ? (
              <button
                type="button"
                onClick={onShowEmployeeNames}
                className="text-amber-400/95 hover:text-amber-300 underline underline-offset-1 cursor-pointer transition-colors"
                title="عرض أسماء الموظفين"
              >
                أكثر من موظف
              </button>
            ) : (
              <span className="font-medium">{row.employeeName}</span>
            )}
            <span className="text-slate-500">·</span>
            <span className="tabular-nums text-slate-400">{labelDateTime}</span>
          </span>
        </td>
      </tr>
      {/* صف البيانات — خلفية ناعمة، حدود خفيفة، hover خفيف */}
      <tr
        data-row-id={row.id}
        className={`${
          isUndoPeriod
            ? 'bg-sky-500/10 animate-pulse border-l-2 border-r-2 border-l-sky-400/30 border-r-sky-400/30 border-b border-slate-600/40'
            : isClosed ? 'bg-slate-800/30 border-b border-white/[0.04]' : 'bg-slate-800/20 hover:bg-slate-800/35 border-b border-white/[0.04] transition-colors'
        }`}
        style={pulseDuration ? { animationDuration: pulseDuration } : undefined}
      >
        <td className="p-1.5 text-center align-middle border-r border-white/[0.04]">
          {onToggleSelect && (
            <div className="flex items-center justify-center">
            <button
              type="button"
              onClick={() => onToggleSelect(row.id)}
              aria-label={isSelected ? 'إلغاء تحديد الصف' : 'تحديد الصف للطباعة'}
              className={`inline-flex items-center justify-center w-5 h-5 rounded-lg border-2 transition-all ${
                isSelected
                  ? 'border-amber-500/60 bg-amber-500/20 text-amber-400 ring-2 ring-amber-500/30 ring-offset-2 ring-offset-slate-800'
                  : 'border-white/20 bg-slate-800/60 text-slate-400 hover:border-amber-500/40 hover:text-amber-400/90'
              }`}
            >
              {isSelected ? (
                <svg className="w-2.5 h-2.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6L9 17l-5-5" />
                </svg>
              ) : (
                <span className="w-2.5 h-2.5 block shrink-0" />
              )}
            </button>
            </div>
          )}
        </td>
        <td className="p-1.5 text-center text-slate-500 text-sm font-cairo border-r border-white/[0.04] align-middle tabular-nums">{rowNumber}</td>
        {NUM_KEYS.slice(0, 4).map((k) => (
        <td
          key={k}
          className={`p-1.5 text-center border-r border-white/[0.04] align-middle ${lockedPulseField === k ? 'locked-cell-pulse' : ''}`}
        >
          {renderNum(k)}
        </td>
      ))}
      <td
        className={`p-1.5 text-center border-r border-white/[0.04] align-middle ${programBalancePulse && isFirstActive ? 'program-balance-pulse-cell' : ''}`}
        title={!programBalanceFilled && isFirstActive ? 'لا يمكن الإدخال في الخانات الأخرى قبل إدخال رصيد البرنامج كاش هنا' : undefined}
      >
        {renderNum('programBalanceCash')}
      </td>
      <td className={`p-1.5 text-center font-semibold font-cairo border-r border-red-500/15 bg-red-500/5 align-middle ${cashVarianceColor}`}>
        {onShowVarianceExplanation ? (
          <button
            type="button"
            onClick={() => onShowVarianceExplanation('cash', row)}
            className={`block w-full py-1.5 rounded-xl transition cursor-pointer hover:bg-white/[0.06] ${cashVariance === 0 ? 'cursor-default hover:bg-transparent' : ''}`}
            title={cashVariance === 0 ? undefined : 'شرح سبب انحراف الكاش'}
            disabled={cashVariance === 0}
          >
            {cashVariance === 0 ? '—' : formatCurrency(cashVariance)}
          </button>
        ) : (
          <span className="block py-1">{cashVariance === 0 ? '—' : formatCurrency(cashVariance)}</span>
        )}
      </td>
      {NUM_KEYS.slice(5).map((k) => (
        <td
          key={k}
          className={`p-1.5 text-center border-r border-white/[0.04] align-middle ${lockedPulseField === k ? 'locked-cell-pulse' : ''}`}
        >
          {renderNum(k)}
        </td>
      ))}
      <td className={`p-1.5 text-center font-semibold font-cairo border-r border-red-500/15 bg-red-500/5 align-middle ${bankVarianceColor}`}>
        {onShowVarianceExplanation ? (
          <button
            type="button"
            onClick={() => onShowVarianceExplanation('bank', row)}
            className={`block w-full py-1.5 rounded-xl transition cursor-pointer hover:bg-white/[0.06] ${bankVariance === 0 ? 'cursor-default hover:bg-transparent' : ''}`}
            title={bankVariance === 0 ? undefined : 'شرح سبب انحراف البنك'}
            disabled={bankVariance === 0}
          >
            {bankVariance === 0 ? '—' : formatCurrency(bankVariance)}
          </button>
        ) : (
          <span className="block py-1">{bankVariance === 0 ? '—' : formatCurrency(bankVariance)}</span>
        )}
      </td>
      <td className="p-1.5 text-center border-r border-white/[0.04] align-middle overflow-hidden min-w-0">
        {isClosed ? (
          <div className="flex flex-row items-center justify-center gap-1 flex-wrap min-w-0 w-full">
            <span className="inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 bg-emerald-500/15 border border-emerald-500/25 text-[9px] font-medium text-emerald-400/95 font-cairo whitespace-nowrap shrink-0">
              <svg className="w-2 h-2 text-emerald-500 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
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
                    className="inline-flex items-center justify-center w-5 h-5 rounded-md border border-red-500/20 bg-slate-700/50 text-slate-400 hover:bg-red-500/15 hover:text-red-400 hover:border-red-500/30 transition-all shrink-0"
                    title="حذف الصف"
                  >
                    <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M18 6L6 18M6 6l12 12" />
                    </svg>
                  </button>
                )}
                {onPrintRow && (
                  <button
                    type="button"
                    onClick={() => onPrintRow(row.id)}
                    aria-label="طباعة الصف"
                    className="inline-flex items-center justify-center w-5 h-5 rounded-md border border-amber-500/20 bg-slate-700/50 text-slate-400 hover:bg-amber-500/15 hover:text-amber-400 hover:border-amber-500/30 transition-all shrink-0"
                    title="طباعة هذه التقفيلة"
                  >
                    <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
          <span className="inline-flex items-center justify-center gap-0.5 rounded-full px-1.5 py-0.5 bg-amber-500/15 border border-amber-500/25 text-[9px] font-medium text-amber-400 font-cairo whitespace-nowrap w-full min-w-0 truncate">
            الشفت الحالي
          </span>
        )}
      </td>
      </tr>
    </>
  )
}
