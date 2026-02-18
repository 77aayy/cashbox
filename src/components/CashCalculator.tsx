import { useCallback, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { toLatinDigits } from '../lib/utils'
import type { TransferFlyRect } from './TransferFlyAnimation'

const DENOMS = [500, 200, 100, 50, 10, 5, 1]

interface CashCalculatorProps {
  onApplyToCash: (total: number, sourceRect?: TransferFlyRect) => void
  hasActiveRow: boolean
}

const emptyCounts = () => Object.fromEntries(DENOMS.map((d) => [d, 0]))

export function CashCalculator({ onApplyToCash, hasActiveRow }: CashCalculatorProps) {
  const [counts, setCounts] = useState<Record<number, number>>(emptyCounts())
  const [lastTransferredCounts, setLastTransferredCounts] = useState<Record<number, number>>(emptyCounts())
  const [showLastTransferred, setShowLastTransferred] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const [popoverPosition, setPopoverPosition] = useState<{ right: number; bottom: number } | null>(null)

  useLayoutEffect(() => {
    if (!showLastTransferred) {
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
  }, [showLastTransferred])

  const grandTotal = DENOMS.reduce((sum, d) => sum + (counts[d] ?? 0) * d, 0)
  const lastTransferredTotal = DENOMS.reduce((sum, d) => sum + (lastTransferredCounts[d] ?? 0) * d, 0)

  const setCount = useCallback((denom: number, value: number) => {
    setCounts((c) => ({ ...c, [denom]: value }))
  }, [])

  const handleClear = useCallback(() => {
    setCounts(emptyCounts())
  }, [])

  const applyBtnRef = useRef<HTMLButtonElement>(null)
  const handleApply = useCallback(() => {
    if (!hasActiveRow) return
    let sourceRect: TransferFlyRect | undefined
    if (applyBtnRef.current) {
      const r = applyBtnRef.current.getBoundingClientRect()
      sourceRect = { x: r.x, y: r.y, width: r.width, height: r.height }
    }
    setLastTransferredCounts({ ...counts })
    onApplyToCash(grandTotal, sourceRect)
    handleClear()
  }, [hasActiveRow, grandTotal, onApplyToCash, handleClear, counts])

  return (
    <div className="w-full h-full min-h-0 flex flex-col rounded-2xl overflow-hidden border-2 border-stone-400 dark:border-teal-500/25 page-surface-warm-card dark:bg-slate-800/50 shadow-[0_4px_20px_rgba(0,0,0,0.08),0_0_0_1px_rgba(0,0,0,0.08)] dark:shadow-[0_4px_24px_rgba(0,0,0,0.25),0_0_1px_rgba(255,255,255,0.06)] backdrop-blur-sm">
      {/* هيدر — محايد في الوضع الفاتح */}
      <div className="relative bg-stone-200 dark:bg-slate-800 dark:border-slate-600 px-3 sm:px-4 py-2 sm:py-3 border-b-2 border-stone-400 dark:border-slate-600 flex items-center justify-between gap-2 shrink-0 shadow-sm">
        <div className="flex items-center gap-2 min-w-0">
          <h3 className="flex items-center gap-2 sm:gap-2.5 text-sm sm:text-base font-semibold text-stone-900 dark:text-slate-200 font-cairo tracking-wide min-w-0">
            <span className="flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-lg sm:rounded-xl bg-stone-300 dark:bg-slate-600 text-stone-800 dark:text-slate-200 shrink-0">
              <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="2" y="5" width="20" height="14" rx="2" />
                <path d="M2 10h20M2 14h20M7 8v8M12 8v8M17 8v8" />
              </svg>
            </span>
            حاسبة الكاش
          </h3>
          <button
            ref={triggerRef}
            type="button"
            onClick={() => setShowLastTransferred((v) => !v)}
            className={`p-1.5 rounded-lg transition shrink-0 ${showLastTransferred ? 'bg-stone-300 text-stone-800 dark:bg-teal-500/20 dark:text-teal-400' : 'text-stone-700 dark:text-slate-400 hover:text-stone-900 hover:bg-stone-300 dark:hover:text-teal-400 dark:hover:bg-white/5'}`}
            title="آخر عمليات رُحّلت إلى الكاش"
            aria-label="سجل العمليات"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 6v6l4 2" />
            </svg>
          </button>
        </div>
        <span className="text-xs font-semibold text-stone-800 dark:text-teal-300 font-cairo">المجموع</span>
        <span className="text-sm font-semibold text-stone-800 dark:text-teal-400 font-cairo tabular-nums">{grandTotal > 0 ? `${grandTotal} ريال سعودي` : '— ريال سعودي'}</span>
        {showLastTransferred && popoverPosition && createPortal(
          <>
            <div className="fixed inset-0 z-[100]" aria-hidden onClick={() => setShowLastTransferred(false)} />
            <div
              className="fixed z-[101] rounded-xl border-2 border-stone-400 dark:border-white/10 bg-white dark:bg-slate-800 shadow-xl py-2 px-3 text-xs font-cairo min-w-[160px] max-h-[280px] overflow-y-auto"
              style={{ right: popoverPosition.right, bottom: popoverPosition.bottom }}
            >
              <div className="font-semibold text-stone-800 dark:text-teal-400 mb-1.5">آخر عمليات رُحّلت إلى الكاش:</div>
              {lastTransferredTotal === 0 ? (
                <p className="text-stone-600 dark:text-slate-400">لم يُرحّل أي مبلغ بعد</p>
              ) : (
                <>
                  <ul className="space-y-0.5 mb-1">
                    {DENOMS.map((d) => {
                      const n = lastTransferredCounts[d] ?? 0
                      if (n === 0) return null
                      return (
                        <li key={d} className="tabular-nums text-stone-800 dark:text-slate-200">
                          فئة {d}: {n} × {d} = {n * d} ريال
                        </li>
                      )
                    })}
                  </ul>
                  <p className="border-t border-stone-300 dark:border-white/10 pt-1 font-semibold text-stone-800 dark:text-teal-400 tabular-nums">
                    المجموع: {lastTransferredTotal} ريال سعودي
                  </p>
                </>
              )}
              <button type="button" onClick={() => setShowLastTransferred(false)} className="mt-2 w-full py-1 rounded bg-stone-300 dark:bg-slate-600 text-stone-800 dark:text-slate-200 text-[10px] font-medium">إغلاق</button>
            </div>
          </>,
          document.body
        )}
      </div>

      <div className="flex-1 flex flex-col p-3 sm:p-4 min-h-0 overflow-hidden gap-3 sm:gap-4">
        {/* كروت مصغّرة ~50% — عمودان / 3 أعمدة */}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3 shrink-0">
          {DENOMS.map((d) => {
            const total = (counts[d] ?? 0) * d
            return (
              <div
                key={d}
                className="flex flex-col items-center gap-2 rounded-xl bg-white dark:bg-slate-800/60 border-2 border-stone-400 dark:border-teal-500/20 shadow-sm dark:shadow-[0_2px_8px_rgba(0,0,0,0.1)] px-2.5 py-2.5 sm:px-3 sm:py-3 overflow-hidden min-w-[120px]"
              >
                <span className="text-stone-800 dark:text-teal-400/90 text-xs font-cairo font-semibold tabular-nums w-full text-center">فئة النقد {d}</span>
                <div className="flex items-center gap-1.5 w-full min-w-0 justify-center">
                  <button
                    type="button"
                    aria-label="نقص واحد"
                    onClick={() => setCount(d, Math.max(0, (counts[d] ?? 0) - 1))}
                    disabled={(counts[d] ?? 0) <= 0}
                    className="flex items-center justify-center w-8 h-8 rounded-md bg-stone-400 dark:bg-slate-700/80 border-2 border-stone-500 dark:border-white/10 text-white dark:text-slate-300 hover:bg-red-100 dark:hover:bg-red-500/20 hover:text-red-600 dark:hover:text-red-400 hover:border-red-400 dark:hover:border-red-500/30 disabled:opacity-40 disabled:pointer-events-none transition shrink-0 shadow-sm dark:shadow-[0_1px_3px_rgba(0,0,0,0.2)]"
                  >
                    <span className="text-base font-bold leading-none">−</span>
                  </button>
                  <input
                    type="text"
                    inputMode="numeric"
                    dir="ltr"
                    value={counts[d] === 0 || counts[d] == null ? '' : String(counts[d])}
                    onChange={(e) => {
                      const raw = toLatinDigits(e.target.value).replace(/\D/g, '')
                      setCount(d, Math.max(0, parseInt(raw, 10) || 0))
                    }}
                    onFocus={(e) => {
                      const v = e.target.value
                      if (v === '' || Number(v) === 0) setCount(d, 0)
                    }}
                    className="flex-1 min-w-[2.5rem] max-w-[3.5rem] px-1.5 py-1.5 rounded-md bg-white dark:bg-slate-900/80 border-2 border-stone-400 dark:border-white/10 text-stone-900 dark:text-white text-center text-sm font-cairo tabular-nums cashbox-input focus:border-teal-500/50 focus:ring-2 focus:ring-teal-500/25 dark:focus:border-teal-500/50 dark:focus:ring-teal-500/25 focus:outline-none"
                  />
                  <button
                    type="button"
                    aria-label="زد واحد"
                    onClick={() => setCount(d, (counts[d] ?? 0) + 1)}
                    className="flex items-center justify-center w-8 h-8 rounded-md bg-stone-400 dark:bg-slate-700/80 border-2 border-stone-500 dark:border-white/10 text-white dark:text-slate-300 hover:bg-stone-500 dark:hover:bg-emerald-500/20 hover:text-white dark:hover:text-emerald-400 hover:border-stone-600 dark:hover:border-emerald-500/30 transition shrink-0 shadow-sm dark:shadow-[0_1px_3px_rgba(0,0,0,0.2)]"
                  >
                    <span className="text-base font-bold leading-none">+</span>
                  </button>
                </div>
                {total > 0 ? (
                  <span className="text-stone-800 dark:text-slate-300 text-xs font-semibold font-cairo tabular-nums w-full text-center">{total} ريال سعودي</span>
                ) : (
                  <span className="text-stone-600 dark:text-slate-400 text-xs font-semibold font-cairo w-full text-center">— ريال سعودي</span>
                )}
              </div>
            )
          })}
        </div>

        {/* المجموع */}
        <div className="w-full py-3 px-4 rounded-xl text-sm font-cairo font-semibold bg-stone-200 dark:bg-slate-700/80 border-2 border-stone-400 dark:border-slate-600 text-stone-900 dark:text-slate-200 flex items-center justify-between gap-2 shrink-0 shadow-sm">
          <span>المجموع</span>
          <span className="text-base font-semibold tabular-nums">{grandTotal > 0 ? `${grandTotal} ريال سعودي` : '— ريال سعودي'}</span>
        </div>

        {/* أزرار — متساوية العرض والارتفاع */}
        <div className="flex gap-2 shrink-0">
          <button
            ref={applyBtnRef}
            type="button"
            onClick={handleApply}
            disabled={!hasActiveRow || grandTotal === 0}
            className="flex-1 min-w-0 py-2.5 rounded-xl text-sm font-cairo font-medium bg-teal-500 hover:bg-teal-600 dark:bg-emerald-500/20 dark:hover:bg-emerald-500/30 text-white dark:text-emerald-400 border border-teal-400 dark:border-emerald-500/40 disabled:opacity-50 disabled:pointer-events-none transition-all flex items-center justify-center gap-2"
          >
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19V5M5 12l7-7 7 7"/></svg>
            ترحيل للكاش
          </button>
          <button
            type="button"
            onClick={handleClear}
            className="flex-1 min-w-0 py-2.5 rounded-xl text-sm font-cairo font-medium bg-stone-400 dark:bg-slate-600/50 hover:bg-stone-500 dark:hover:bg-slate-500/60 text-white dark:text-slate-300 border-2 border-stone-500 dark:border-white/10 transition-all flex items-center justify-center gap-2"
          >
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/><path d="M10 11v6M14 11v6"/></svg>
            مسح
          </button>
        </div>
      </div>
    </div>
  )
}
