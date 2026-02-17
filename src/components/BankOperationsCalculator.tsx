import { useCallback, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { toLatinDigits } from '../lib/utils'

type BankOpField = 'mada' | 'visa' | 'mastercard'

const COLS: { field: BankOpField; label: string }[] = [
  { field: 'mada', label: 'مدى' },
  { field: 'visa', label: 'فيزا' },
  { field: 'mastercard', label: 'ماستر كارد' },
]

interface BankOperationsCalculatorProps {
  onTransfer: (mada: number, visa: number, mastercard: number) => void
  hasActiveRow: boolean
}

export function BankOperationsCalculator({ onTransfer, hasActiveRow }: BankOperationsCalculatorProps) {
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
  const [showListFor, setShowListFor] = useState<BankOpField | null>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const [popoverPosition, setPopoverPosition] = useState<{ right: number; bottom: number } | null>(null)

  useLayoutEffect(() => {
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
      right: window.innerWidth - rect.right,
      bottom: window.innerHeight - rect.top + 8,
    })
  }, [showListFor])

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
    (field: BankOpField) => {
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
      onTransfer(payload[0], payload[1], payload[2])
      setAmounts((a) => ({ ...a, [field]: [] }))
      setInputs((i) => ({ ...i, [field]: '' }))
    },
    [hasActiveRow, totalMada, totalVisa, totalMastercard, onTransfer, amounts]
  )

  const handleTransferAll = useCallback(() => {
    if (!hasActiveRow || (totalMada === 0 && totalVisa === 0 && totalMastercard === 0)) return
    setAllTransferred((prev) => ({
      mada: [...prev.mada, ...amounts.mada],
      visa: [...prev.visa, ...amounts.visa],
      mastercard: [...prev.mastercard, ...amounts.mastercard],
    }))
    onTransfer(totalMada, totalVisa, totalMastercard)
    handleClear()
  }, [hasActiveRow, totalMada, totalVisa, totalMastercard, onTransfer, amounts, handleClear])

  return (
    <div className="w-full h-full min-h-0 flex flex-col rounded-2xl overflow-hidden border-2 border-stone-400 dark:border-amber-500/20 bg-stone-50 dark:bg-slate-800/50 shadow-[0_4px_24px_rgba(0,0,0,0.08),0_0_0_1px_rgba(41,37,36,0.12)] dark:shadow-[0_4px_24px_rgba(0,0,0,0.25),0_0_1px_rgba(255,255,255,0.06)] backdrop-blur-sm">
      <div className="bg-gradient-to-b from-teal-100 to-slate-200 dark:from-amber-500/15 dark:to-slate-800/60 px-4 py-3 border-b-2 border-teal-300 dark:border-amber-500/25 flex items-center justify-between gap-2 shrink-0 shadow-sm dark:shadow-[0_2px_8px_rgba(0,0,0,0.1)]">
        <h3 className="flex items-center gap-2.5 text-base font-semibold text-teal-700 dark:text-amber-400 font-cairo tracking-wide">
          <span className="flex items-center justify-center w-9 h-9 rounded-xl bg-teal-100 dark:bg-amber-500/20 text-teal-600 dark:text-amber-400">
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
                className="relative flex flex-col rounded-xl bg-white dark:bg-slate-800/60 border-2 border-stone-400 dark:border-amber-500/15 px-3 py-3 shadow-md dark:shadow-[0_2px_8px_rgba(0,0,0,0.1)] min-h-0"
              >
                <div className="flex items-center justify-between gap-1 mb-1 shrink-0">
                  <span className="text-teal-700 dark:text-amber-400/90 text-xs font-cairo font-semibold">{label}</span>
                  <div className="relative shrink-0">
                    <button
                      ref={showListFor === field ? triggerRef : undefined}
                      type="button"
                      onClick={() => setShowListFor((f) => (f === field ? null : field))}
                      className={`p-1.5 rounded-lg transition ${showListFor === field ? 'bg-teal-100 text-teal-700 dark:bg-amber-500/20 dark:text-amber-400' : 'text-stone-700 dark:text-slate-400 hover:text-teal-600 hover:bg-stone-300 dark:hover:text-amber-400 dark:hover:bg-white/5'}`}
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
                        <div className="fixed inset-0 z-[100]" aria-hidden onClick={() => setShowListFor(null)} />
                        <div
                          className="fixed z-[101] rounded-xl border-2 border-stone-400 dark:border-white/10 bg-white dark:bg-slate-800 shadow-xl py-2 px-3 text-xs font-cairo min-w-[140px] max-h-[220px] overflow-y-auto"
                          style={{ right: popoverPosition.right, bottom: popoverPosition.bottom }}
                        >
                          <div className="font-semibold text-teal-700 dark:text-amber-400 mb-1.5">كل العمليات المرحّلة إلى الصف:</div>
                          {allTransferred[field].length === 0 ? (
                            <p className="text-stone-600 dark:text-slate-400">لم يُرحّل أي مبلغ بعد</p>
                          ) : (
                            <>
                              <ul className="space-y-0.5 mb-1">
                                {allTransferred[field].map((val, i) => (
                                  <li key={i} className="tabular-nums text-stone-800 dark:text-slate-200">{val} ريال</li>
                                ))}
                              </ul>
                              <p className="border-t border-stone-200 dark:border-white/10 pt-1 font-semibold text-teal-700 dark:text-amber-400 tabular-nums">
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
                    className="flex-1 min-w-0 px-2 py-2 rounded-lg bg-white dark:bg-slate-900/80 border-2 border-stone-400 dark:border-white/10 text-stone-900 dark:text-white text-center text-sm font-cairo tabular-nums placeholder:text-xs placeholder:text-stone-400 dark:placeholder:text-slate-500 focus:border-teal-500/50 focus:ring-2 focus:ring-teal-500/25 dark:focus:border-amber-500/50 dark:focus:ring-amber-500/25 focus:outline-none"
                  />
                  <button
                    type="button"
                    aria-label={`إضافة لـ ${label}`}
                    onClick={() => addAmount(field)}
                    className="flex items-center justify-center w-8 h-8 rounded-lg bg-stone-400 dark:bg-slate-700/80 border-2 border-stone-500 dark:border-white/10 text-white dark:text-slate-300 hover:bg-teal-100 dark:hover:bg-emerald-500/20 hover:text-teal-700 dark:hover:text-emerald-400 hover:border-teal-300 dark:hover:border-emerald-500/30 transition shrink-0 shadow-sm"
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
                  <span className="text-xs font-semibold font-cairo text-teal-700 dark:text-amber-400 tabular-nums block">
                    المجموع: {total > 0 ? `${total} ريال` : '—'}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleTransferOne(field)}
                    disabled={!hasActiveRow || total === 0}
                    title={`ترحيل ${label} إلى الصف النشط`}
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

        <div className="w-full py-2.5 px-4 rounded-xl text-xs font-cairo font-semibold bg-teal-100 dark:bg-amber-500/15 border-2 border-teal-400 dark:border-amber-500/30 text-teal-800 dark:text-amber-400 flex items-center justify-between gap-6 shrink-0">
          <span className="tabular-nums">مدى <span className="font-bold">{totalMada}</span></span>
          <span className="tabular-nums">فيزا <span className="font-bold">{totalVisa}</span></span>
          <span className="tabular-nums">ماستر <span className="font-bold">{totalMastercard}</span></span>
        </div>

        <div className="flex gap-2 shrink-0">
          <button
            type="button"
            onClick={handleTransferAll}
            disabled={!hasActiveRow || (totalMada === 0 && totalVisa === 0 && totalMastercard === 0)}
            title="ترحيل مدى + فيزا + ماستر كارد معاً إلى الصف النشط"
            className="flex-1 min-w-0 py-2.5 rounded-xl text-sm font-cairo font-medium bg-teal-500 hover:bg-teal-600 dark:bg-emerald-500/20 dark:hover:bg-emerald-500/30 text-white dark:text-emerald-400 border border-teal-400 dark:border-emerald-500/40 disabled:opacity-50 disabled:pointer-events-none transition-all flex items-center justify-center gap-2"
          >
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 19V5M5 12l7-7 7 7" />
            </svg>
            ترحيل الكل
          </button>
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
