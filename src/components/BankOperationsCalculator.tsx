import { useCallback, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { toLatinDigits } from '../lib/utils'
import type { TransferFlyRect } from './TransferFlyAnimation'

type BankOpField = 'mada' | 'visa' | 'mastercard'

const COLS: { field: BankOpField; label: string }[] = [
  { field: 'mada', label: 'مدى' },
  { field: 'visa', label: 'فيزا' },
  { field: 'mastercard', label: 'ماستر كارد' },
]

export type BankOpTransferOptions = {
  sourceRect: TransferFlyRect
  targetField: 'mada' | 'visa' | 'mastercard'
}

interface BankOperationsCalculatorProps {
  onTransfer: (mada: number, visa: number, mastercard: number, options?: BankOpTransferOptions) => void
  /** ترحيل المجموع (مدى+فيزا+ماستر) إلى خانة اجمالى الموازنه في الصف النشط */
  onTransferToBudget?: (total: number, sourceRect?: TransferFlyRect) => void
  hasActiveRow: boolean
  /** تعطيل أزرار ترحيل مدى/فيزا/ماستر عند جلب قيم من إكسل */
  disableTransferButtons?: boolean
}

export function BankOperationsCalculator({ onTransfer, onTransferToBudget, hasActiveRow, disableTransferButtons = false }: BankOperationsCalculatorProps) {
  const [amounts, setAmounts] = useState<Record<BankOpField, number[]>>({
    mada: [],
    visa: [],
    mastercard: [],
  })
  const [inputs, setInputs] = useState<Record<BankOpField, string>>({
    mada: '',
    visa: '',
    mastercard: '',
  })
  /** كل العمليات المرحّلة إلى الصف (تراكمي — لعرضها عند الضغط على زر السجل) */
  const [allTransferred, setAllTransferred] = useState<Record<BankOpField, number[]>>({
    mada: [],
    visa: [],
    mastercard: [],
  })
  /** ترحيلات إلى اجمالى الموازنه (لعرضها في السجل) */
  const [transferredToBudget, setTransferredToBudget] = useState<number[]>([])
  const [showListFor, setShowListFor] = useState<BankOpField | null>(null)
  const [showBudgetLog, setShowBudgetLog] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const budgetLogTriggerRef = useRef<HTMLButtonElement>(null)
  /** موضع النافذة: left و bottom — تفتح لليمين وفوق الزر حتى لا تختفي تحت */
  const [popoverPosition, setPopoverPosition] = useState<{ left: number; bottom: number } | null>(null)

  useLayoutEffect(() => {
    if (showBudgetLog) {
      const el = budgetLogTriggerRef.current
      if (!el) {
        setPopoverPosition(null)
        return
      }
      const rect = el.getBoundingClientRect()
      setPopoverPosition({
        left: rect.right + 8,
        bottom: window.innerHeight - rect.top + 8,
      })
      return
    }
    if (showListFor === null) {
      setPopoverPosition(null)
      return
    }
    const el = triggerRef.current
    if (!el) {
      setPopoverPosition(null)
      return
    }
    const rect = el.getBoundingClientRect()
    setPopoverPosition({
      left: rect.right + 8,
      bottom: window.innerHeight - rect.top + 8,
    })
  }, [showListFor, showBudgetLog])

  const sum = useCallback((list: number[]) => list.reduce((s, n) => s + n, 0), [])
  const totalMada = sum(amounts.mada)
  const totalVisa = sum(amounts.visa)
  const totalMastercard = sum(amounts.mastercard)
  const grandTotal = totalMada + totalVisa + totalMastercard

  const addAmount = useCallback((field: BankOpField) => {
    const raw = toLatinDigits(inputs[field]).replace(',', '.').replace(/[^\d.]/g, '')
    const value = parseFloat(raw) || 0
    if (value <= 0) return
    setAmounts((a) => ({ ...a, [field]: [...a[field], value] }))
    setInputs((i) => ({ ...i, [field]: '' }))
  }, [inputs])

  const removeAmount = useCallback((field: BankOpField, index: number) => {
    setAmounts((a) => ({ ...a, [field]: a[field].filter((_, i) => i !== index) }))
  }, [])

  const setInput = useCallback((field: BankOpField, value: string) => {
    setInputs((i) => ({ ...i, [field]: value }))
  }, [])

  const handleClear = useCallback(() => {
    setAmounts({ mada: [], visa: [], mastercard: [] })
    setInputs({ mada: '', visa: '', mastercard: '' })
  }, [])

  const handleTransferOne = useCallback(
    (field: BankOpField, sourceRect?: TransferFlyRect) => {
      if (!hasActiveRow) return
      const list = amounts[field]
      const total = field === 'mada' ? totalMada : field === 'visa' ? totalVisa : totalMastercard
      if (total === 0) return
      setAllTransferred((prev) => ({ ...prev, [field]: [...prev[field], ...list] }))
      const payload =
        field === 'mada'
          ? [total, 0, 0]
          : field === 'visa'
            ? [0, total, 0]
            : [0, 0, total]
      const options: BankOpTransferOptions | undefined = sourceRect
        ? { sourceRect, targetField: field }
        : undefined
      onTransfer(payload[0], payload[1], payload[2], options)
      setAmounts((a) => ({ ...a, [field]: [] }))
      setInputs((i) => ({ ...i, [field]: '' }))
    },
    [hasActiveRow, totalMada, totalVisa, totalMastercard, onTransfer, amounts]
  )

  const transferAllBtnRef = useRef<HTMLButtonElement>(null)
  const handleTransferAll = useCallback(() => {
    if (!hasActiveRow || grandTotal === 0) return
    if (onTransferToBudget) {
      setTransferredToBudget((prev) => [...prev, grandTotal])
      let sourceRect: TransferFlyRect | undefined
      if (transferAllBtnRef.current) {
        const r = transferAllBtnRef.current.getBoundingClientRect()
        sourceRect = { x: r.x, y: r.y, width: r.width, height: r.height }
      }
      onTransferToBudget(grandTotal, sourceRect)
      handleClear()
    } else {
      setAllTransferred((prev) => ({
        mada: [...prev.mada, ...amounts.mada],
        visa: [...prev.visa, ...amounts.visa],
        mastercard: [...prev.mastercard, ...amounts.mastercard],
      }))
      onTransfer(totalMada, totalVisa, totalMastercard)
      handleClear()
    }
  }, [hasActiveRow, grandTotal, totalMada, totalVisa, totalMastercard, onTransfer, onTransferToBudget, amounts, handleClear])

  return (
    <div className="w-full h-full min-h-0 flex flex-col rounded-2xl overflow-hidden border-2 border-stone-400 dark:border-teal-500/25 page-surface-warm-card dark:bg-slate-800/50 shadow-[0_4px_20px_rgba(0,0,0,0.08),0_0_0_1px_rgba(0,0,0,0.08)] dark:shadow-[0_4px_24px_rgba(0,0,0,0.25),0_0_1px_rgba(255,255,255,0.06)] backdrop-blur-sm">
      <div className="bg-stone-200 dark:bg-slate-800 dark:border-slate-600 px-4 py-3 border-b-2 border-stone-400 dark:border-slate-600 flex items-center justify-between gap-2 shrink-0 shadow-sm">
        <h3 className="flex items-center gap-2.5 text-base font-semibold text-stone-900 dark:text-slate-200 font-cairo tracking-wide">
          <span className="flex items-center justify-center w-9 h-9 rounded-xl bg-stone-300 dark:bg-slate-600 text-stone-800 dark:text-slate-200">
            <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="2" y="6" width="20" height="12" rx="1" />
              <path d="M2 10h20M7 14h2" />
            </svg>
          </span>
          حاسبه العمليات البنكيه
        </h3>
        <span className="text-xs font-semibold text-slate-700 font-cairo tabular-nums">
          {grandTotal > 0 ? `${grandTotal} ريال` : '—'}
        </span>
      </div>

      <div className="flex-1 flex flex-col p-4 min-h-0 overflow-hidden gap-4">
        <div className="grid grid-cols-3 gap-3 flex-1 min-h-0">
          {COLS.map(({ field, label }) => {
            const list = amounts[field]
            const total = sum(list)
            return (
              <div
                key={field}
                className="relative flex flex-col rounded-xl bg-white dark:bg-slate-800/60 border-2 border-stone-400 dark:border-teal-500/20 px-3 py-3 shadow-md dark:shadow-[0_2px_8px_rgba(0,0,0,0.1)] min-h-0"
              >
                <div className="flex items-center justify-between gap-1 mb-1 shrink-0">
                  <span className="text-stone-800 dark:text-teal-400/90 text-xs font-cairo font-semibold">{label}</span>
                  <div className="relative shrink-0">
                    <button
                      ref={showListFor === field ? triggerRef : undefined}
                      type="button"
                      onClick={() => {
                        setShowBudgetLog(false)
                        setShowListFor((f) => (f === field ? null : field))
                      }}
                      className={`p-1.5 rounded-lg transition ${showListFor === field ? 'bg-stone-300 text-stone-800 dark:bg-teal-500/20 dark:text-teal-400' : 'text-stone-700 dark:text-slate-400 hover:text-stone-900 hover:bg-stone-300 dark:hover:text-teal-400 dark:hover:bg-white/5'}`}
                      title="كل العمليات المرحّلة لهذا النوع"
                      aria-label="سجل العمليات"
                    >
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10" />
                        <path d="M12 6v6l4 2" />
                      </svg>
                    </button>
                    {showListFor === field && popoverPosition && createPortal(
                      <>
                        <div className="fixed inset-0 z-[100]" aria-hidden onClick={() => { setShowListFor(null); setShowBudgetLog(false) }} />
                        <div
                          className="fixed z-[101] rounded-xl border-2 border-stone-400 dark:border-white/10 bg-white dark:bg-slate-800 shadow-xl py-2 px-3 text-xs font-cairo min-w-[140px] max-h-[220px] overflow-y-auto"
                          style={{ left: popoverPosition.left, bottom: popoverPosition.bottom }}
                        >
                          <div className="font-semibold text-stone-800 dark:text-teal-400 mb-1.5">كل العمليات المرحّلة إلى الصف:</div>
                          {allTransferred[field].length === 0 ? (
                            <p className="text-stone-600 dark:text-slate-400">لم يُرحّل أي مبلغ بعد</p>
                          ) : (
                            <>
                              <ul className="space-y-0.5 mb-1">
                                {allTransferred[field].map((val, i) => (
                                  <li key={i} className="tabular-nums text-stone-800 dark:text-slate-200">{val} ريال</li>
                                ))}
                              </ul>
                              <p className="border-t border-stone-200 dark:border-white/10 pt-1 font-semibold text-stone-800 dark:text-teal-400 tabular-nums">
                                المجموع: {sum(allTransferred[field])} ريال
                              </p>
                            </>
                          )}
                          <button type="button" onClick={() => setShowListFor(null)} className="mt-2 w-full py-1 rounded bg-stone-300 dark:bg-slate-600 text-stone-800 dark:text-slate-200 text-[10px] font-medium">إغلاق</button>
                        </div>
                      </>,
                      document.body
                    )}
                  </div>
                </div>
                <p className="text-[9px] text-stone-500 dark:text-slate-500 font-cairo mb-1.5 shrink-0">أدخل المبلغ ثم +</p>
                <div className="flex items-center gap-1.5 mb-2 shrink-0">
                  <input
                    type="text"
                    inputMode="decimal"
                    dir="ltr"
                    placeholder="مبلغ العملية"
                    value={inputs[field]}
                    onChange={(e) => {
                      const v = toLatinDigits(e.target.value).replace(',', '.').replace(/[^\d.]/g, '')
                      const oneDot = (v.match(/^\d*\.?\d*/) || [''])[0]
                      setInput(field, oneDot)
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        addAmount(field)
                      }
                    }}
                    className="flex-1 min-w-0 px-2 py-2 rounded-lg bg-white dark:bg-slate-900/80 border-2 border-stone-400 dark:border-white/10 text-stone-900 dark:text-white text-center text-sm font-cairo tabular-nums placeholder:text-xs placeholder:text-stone-400 dark:placeholder:text-slate-500 focus:border-teal-500/50 focus:ring-2 focus:ring-teal-500/25 dark:focus:border-teal-500/50 dark:focus:ring-teal-500/25 focus:outline-none"
                  />
                  <button
                    type="button"
                    aria-label={`إضافة لـ ${label}`}
                    onClick={() => addAmount(field)}
                    className="flex items-center justify-center w-8 h-8 rounded-lg bg-stone-400 dark:bg-slate-700/80 border-2 border-stone-500 dark:border-white/10 text-white dark:text-slate-300 hover:bg-stone-500 dark:hover:bg-emerald-500/20 hover:text-white dark:hover:text-emerald-400 hover:border-stone-600 dark:hover:border-emerald-500/30 transition shrink-0 shadow-sm"
                  >
                    <span className="text-lg font-bold leading-none">+</span>
                  </button>
                </div>
                <div className="flex-1 min-h-0 overflow-auto space-y-1">
                  {list.length === 0 ? (
                    <span className="text-stone-600 dark:text-slate-500 text-[10px] font-cairo">لا عمليات — أضف مبالغ بالزر +</span>
                  ) : (
                    list.map((val, i) => (
                      <div key={`${field}-${i}`} className="flex items-center justify-between gap-1 rounded-lg bg-white dark:bg-slate-700/50 px-2 py-1 border-2 border-stone-400 dark:border-white/10 shadow-sm">
                        <span className="text-xs font-cairo tabular-nums text-stone-800 dark:text-slate-200">{val} ريال</span>
                        <button
                          type="button"
                          onClick={() => removeAmount(field, i)}
                          aria-label="حذف"
                          className="w-5 h-5 rounded flex items-center justify-center text-stone-600 hover:text-red-600 hover:bg-red-100 dark:hover:bg-red-500/20 transition shrink-0"
                        >
                          <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
                        </button>
                      </div>
                    ))
                  )}
                </div>
                <div className="pt-2 mt-auto border-t-2 border-stone-400 dark:border-white/10 shrink-0 space-y-2">
                  <span className="text-xs font-semibold font-cairo text-stone-800 dark:text-teal-400 tabular-nums block">
                    المجموع: {total > 0 ? `${total} ريال` : '—'}
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect()
                      const sourceRect: TransferFlyRect = { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
                      handleTransferOne(field, sourceRect)
                    }}
                    disabled={disableTransferButtons || !hasActiveRow || total === 0}
                    title={disableTransferButtons ? `معطّل — تم جلب القيم من إكسل` : `ترحيل ${label} إلى الصف النشط`}
                    className="w-full py-2 rounded-lg text-xs font-cairo font-medium bg-teal-500 hover:bg-teal-600 dark:bg-emerald-500/20 dark:hover:bg-emerald-500/30 text-white dark:text-emerald-400 border border-teal-400 dark:border-emerald-500/40 disabled:opacity-50 disabled:pointer-events-none transition-all flex items-center justify-center gap-1.5"
                  >
                    <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 19V5M5 12l7-7 7 7" />
                    </svg>
                    ترحيل {label}
                  </button>
                </div>
              </div>
            )
          })}
        </div>

        <div className="w-full py-2.5 px-4 rounded-xl text-xs font-cairo font-semibold bg-stone-200 dark:bg-slate-700/80 border-2 border-stone-400 dark:border-slate-600 text-stone-900 dark:text-slate-200 flex items-center justify-between gap-6 shrink-0 flex-wrap shadow-sm">
          <span className="tabular-nums">مدى <span className="font-bold">{totalMada}</span></span>
          <span className="tabular-nums">فيزا <span className="font-bold">{totalVisa}</span></span>
          <span className="tabular-nums">ماستر <span className="font-bold">{totalMastercard}</span></span>
          <span className="tabular-nums font-bold text-stone-900 dark:text-slate-200 px-2 py-0.5 rounded-md bg-white/60 dark:bg-slate-600/60 border border-stone-300 dark:border-slate-500">المجموع = <span className="font-bold">{grandTotal}</span></span>
        </div>

        <div className="flex gap-2 shrink-0 items-center">
          {onTransferToBudget ? (
            <div
              ref={transferAllBtnRef}
              className="flex flex-1 min-w-0 min-h-[56px] rounded-xl overflow-hidden border-2 border-teal-400 dark:border-emerald-500/40 bg-teal-500 dark:bg-emerald-500/20 hover:bg-teal-600 dark:hover:bg-emerald-500/30 disabled:opacity-50 disabled:pointer-events-none transition-all shadow-sm"
            >
              <button
                type="button"
                onClick={handleTransferAll}
                disabled={!hasActiveRow || grandTotal === 0}
                title="ترحيل المجموع إلى خانة اجمالى الموازنه في الصف النشط"
                className="flex-1 min-w-0 min-h-[52px] py-3 px-3 flex items-center justify-center gap-2 text-sm font-cairo font-medium text-white dark:text-emerald-400 whitespace-nowrap"
              >
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 19V5M5 12l7-7 7 7" />
                </svg>
                ترحيل الى اجمالى الموازنه
              </button>
              <button
                ref={budgetLogTriggerRef}
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  setShowListFor(null)
                  setShowBudgetLog((b) => !b)
                }}
                title="سجل ترحيلات اجمالى الموازنه"
                aria-label="سجل ترحيلات اجمالى الموازنه"
                className={`relative shrink-0 w-10 min-h-[52px] h-full flex items-center justify-center border-s-2 border-teal-400/50 dark:border-emerald-500/40 transition-colors ${showBudgetLog ? 'bg-teal-600/90 dark:bg-emerald-500/40 text-white' : 'hover:bg-teal-600/70 dark:hover:bg-emerald-500/30 text-white/90 hover:text-white'}`}
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 6v6l4 2" />
                </svg>
                {transferredToBudget.length > 0 && (
                  <span className="absolute top-0.5 end-0.5 min-w-[14px] h-3.5 px-0.5 rounded-full bg-white/90 dark:bg-black/40 text-teal-700 dark:text-emerald-300 text-[9px] font-bold flex items-center justify-center leading-none shadow-sm">
                    {transferredToBudget.length}
                  </span>
                )}
              </button>
            </div>
          ) : (
            <button
              ref={transferAllBtnRef}
              type="button"
              onClick={handleTransferAll}
              disabled={!hasActiveRow || grandTotal === 0}
              title="ترحيل مدى + فيزا + ماستر كارد معاً إلى الصف النشط"
              className="flex-1 min-w-0 py-2.5 rounded-xl text-sm font-cairo font-medium bg-teal-500 hover:bg-teal-600 dark:bg-emerald-500/20 dark:hover:bg-emerald-500/30 text-white dark:text-emerald-400 border-2 border-teal-400 dark:border-emerald-500/40 disabled:opacity-50 disabled:pointer-events-none transition-all flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 19V5M5 12l7-7 7 7" />
              </svg>
              ترحيل الكل
            </button>
          )}
          {showBudgetLog && popoverPosition && createPortal(
            <>
              <div className="fixed inset-0 z-[100]" aria-hidden onClick={() => setShowBudgetLog(false)} />
              <div
                className="fixed z-[101] rounded-xl border-2 border-stone-400 dark:border-white/10 bg-white dark:bg-slate-800 shadow-xl py-2 px-3 text-xs font-cairo min-w-[160px] max-h-[220px] overflow-y-auto"
                style={{ left: popoverPosition.left, bottom: popoverPosition.bottom }}
              >
                <div className="font-semibold text-stone-800 dark:text-teal-400 mb-1.5">ترحيلات إلى اجمالى الموازنه:</div>
                {transferredToBudget.length === 0 ? (
                  <p className="text-stone-600 dark:text-slate-400">لم يُرحّل أي مبلغ بعد</p>
                ) : (
                  <>
                    <ul className="space-y-0.5 mb-1">
                      {transferredToBudget.map((val, i) => (
                        <li key={i} className="tabular-nums text-stone-800 dark:text-slate-200">{val.toLocaleString('ar-SA', { minimumFractionDigits: 2 })} ريال</li>
                      ))}
                    </ul>
                    <p className="border-t border-stone-200 dark:border-white/10 pt-1 font-semibold text-stone-800 dark:text-teal-400 tabular-nums">
                      المجموع: {transferredToBudget.reduce((s, n) => s + n, 0).toLocaleString('ar-SA', { minimumFractionDigits: 2 })} ريال
                    </p>
                  </>
                )}
                <button type="button" onClick={() => setShowBudgetLog(false)} className="mt-2 w-full py-1 rounded bg-stone-300 dark:bg-slate-600 text-stone-800 dark:text-slate-200 text-[10px] font-medium">إغلاق</button>
              </div>
            </>,
            document.body
          )}
          <button
            type="button"
            onClick={handleClear}
            className="flex-1 min-w-0 py-2.5 rounded-xl text-sm font-cairo font-medium bg-stone-400 dark:bg-slate-600/50 hover:bg-stone-500 dark:hover:bg-slate-500/60 text-white dark:text-slate-300 border-2 border-stone-500 dark:border-white/10 transition-all flex items-center justify-center gap-2"
          >
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/><path d="M10 11v6M14 11v6"/></svg>
            مسح الكل
          </button>
        </div>
      </div>
    </div>
  )
}
