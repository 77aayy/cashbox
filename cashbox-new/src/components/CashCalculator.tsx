import { useCallback, useState } from 'react'
import { toLatinDigits } from '../lib/utils'

const DENOMS = [500, 200, 100, 50, 10, 5, 1]

interface CashCalculatorProps {
  onApplyToCash: (total: number) => void
  hasActiveRow: boolean
}

export function CashCalculator({ onApplyToCash, hasActiveRow }: CashCalculatorProps) {
  const [counts, setCounts] = useState<Record<number, number>>(
    Object.fromEntries(DENOMS.map((d) => [d, 0]))
  )

  const grandTotal = DENOMS.reduce((sum, d) => sum + (counts[d] ?? 0) * d, 0)

  const setCount = useCallback((denom: number, value: number) => {
    setCounts((c) => ({ ...c, [denom]: value }))
  }, [])

  const handleClear = useCallback(() => {
    setCounts(Object.fromEntries(DENOMS.map((d) => [d, 0])))
  }, [])

  const handleApply = useCallback(() => {
    if (!hasActiveRow) return
    onApplyToCash(grandTotal)
    handleClear()
  }, [hasActiveRow, grandTotal, onApplyToCash, handleClear])

  return (
    <div className="w-full h-full min-h-0 flex flex-col rounded-2xl overflow-hidden border border-slate-400 dark:border-amber-500/20 bg-white dark:bg-slate-800/50 shadow-[0_4px_24px_rgba(0,0,0,0.1),0_0_1px_rgba(0,0,0,0.08)] dark:shadow-[0_4px_24px_rgba(0,0,0,0.25),0_0_1px_rgba(255,255,255,0.06)] backdrop-blur-sm">
      {/* هيدر مطابق للآلة الحاسبة */}
      <div className="bg-gradient-to-b from-teal-100 to-slate-200 dark:from-amber-500/15 dark:to-slate-800/60 px-4 py-3 border-b-2 border-teal-300 dark:border-amber-500/25 flex items-center justify-between gap-2 shrink-0 shadow-sm dark:shadow-[0_2px_8px_rgba(0,0,0,0.1)]">
        <h3 className="flex items-center gap-2.5 text-base font-semibold text-teal-700 dark:text-amber-400 font-cairo tracking-wide">
          <span className="flex items-center justify-center w-9 h-9 rounded-xl bg-teal-100 dark:bg-amber-500/20 text-teal-600 dark:text-amber-400">
            <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="2" y="5" width="20" height="14" rx="2" />
              <path d="M2 10h20M2 14h20M7 8v8M12 8v8M17 8v8" />
            </svg>
          </span>
          حاسبة الكاش
        </h3>
        <span className="text-xs font-semibold text-slate-700 font-cairo">المجموع</span>
        <span className="text-sm font-semibold text-teal-700 dark:text-amber-400 font-cairo tabular-nums">{grandTotal > 0 ? `${grandTotal} ريال سعودي` : '— ريال سعودي'}</span>
      </div>

      <div className="flex-1 flex flex-col p-5 min-h-0 overflow-hidden gap-4">
        {/* صفّان: 4 + 3 خانات — نفس الحجم المريح */}
        <div className="grid grid-cols-4 gap-4 shrink-0">
          {DENOMS.map((d) => {
            const total = (counts[d] ?? 0) * d
            return (
              <div
                key={d}
                className="flex flex-col items-center gap-2.5 rounded-xl bg-slate-100 dark:bg-slate-800/60 border border-slate-400 dark:border-amber-500/15 px-4 py-3 shadow-sm dark:shadow-[0_2px_8px_rgba(0,0,0,0.1)]"
              >
                <span className="text-teal-700 dark:text-amber-400/90 text-xs font-cairo font-semibold tabular-nums">فئة النقد {d}</span>
                <div className="flex items-center gap-1.5 w-full justify-center">
                  <button
                    type="button"
                    aria-label="نقص واحد"
                    onClick={() => setCount(d, Math.max(0, (counts[d] ?? 0) - 1))}
                    disabled={(counts[d] ?? 0) <= 0}
                    className="flex items-center justify-center w-6 h-6 rounded-md bg-slate-300 dark:bg-slate-700/80 border border-slate-400 dark:border-white/10 text-slate-800 dark:text-slate-300 hover:bg-red-100 dark:hover:bg-red-500/20 hover:text-red-600 dark:hover:text-red-400 hover:border-red-300 dark:hover:border-red-500/30 disabled:opacity-40 disabled:pointer-events-none transition shrink-0 shadow-sm dark:shadow-[0_1px_3px_rgba(0,0,0,0.2)]"
                  >
                    <span className="text-sm font-bold leading-none">−</span>
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
                    className="w-full min-w-[3rem] max-w-[4.5rem] px-2 py-2 rounded-lg bg-white dark:bg-slate-900/80 border border-slate-400 dark:border-white/10 text-slate-900 dark:text-white text-center text-sm font-cairo tabular-nums cashbox-input focus:border-teal-500/50 focus:ring-2 focus:ring-teal-500/25 dark:focus:border-amber-500/50 dark:focus:ring-amber-500/25 focus:outline-none"
                  />
                  <button
                    type="button"
                    aria-label="زد واحد"
                    onClick={() => setCount(d, (counts[d] ?? 0) + 1)}
                    className="flex items-center justify-center w-6 h-6 rounded-md bg-slate-300 dark:bg-slate-700/80 border border-slate-400 dark:border-white/10 text-slate-800 dark:text-slate-300 hover:bg-teal-100 dark:hover:bg-emerald-500/20 hover:text-teal-700 dark:hover:text-emerald-400 hover:border-teal-300 dark:hover:border-emerald-500/30 transition shrink-0 shadow-sm dark:shadow-[0_1px_3px_rgba(0,0,0,0.2)]"
                  >
                    <span className="text-sm font-bold leading-none">+</span>
                  </button>
                </div>
                {total > 0 ? (
                  <span className="text-slate-800 dark:text-slate-300 text-[10px] font-semibold font-cairo tabular-nums whitespace-nowrap">{total} ريال سعودي</span>
                ) : (
                  <span className="text-slate-700 dark:text-slate-500/60 text-[10px] font-semibold font-cairo whitespace-nowrap">— ريال سعودي</span>
                )}
              </div>
            )
          })}
        </div>

        {/* المجموع */}
        <div className="w-full py-3 px-4 rounded-xl text-sm font-cairo font-semibold bg-teal-100 dark:bg-amber-500/15 border border-teal-300 dark:border-amber-500/30 text-teal-900 dark:text-amber-400 flex items-center justify-between gap-2 shrink-0 shadow-sm dark:shadow-[0_0_12px_rgba(245,158,11,0.08)]">
          <span>المجموع</span>
          <span className="text-base font-semibold tabular-nums">{grandTotal > 0 ? `${grandTotal} ريال سعودي` : '— ريال سعودي'}</span>
        </div>

        {/* أزرار */}
        <div className="flex gap-2 shrink-0">
          <button
            type="button"
            onClick={handleApply}
            disabled={!hasActiveRow || grandTotal === 0}
            className="flex-1 py-2.5 rounded-xl text-sm font-cairo font-medium bg-teal-500 hover:bg-teal-600 dark:bg-emerald-500/20 dark:hover:bg-emerald-500/30 text-white dark:text-emerald-400 border border-teal-400 dark:border-emerald-500/40 disabled:opacity-50 disabled:pointer-events-none transition-all shadow-md dark:shadow-[0_2px_8px_rgba(16,185,129,0.15)]"
          >
            <span className="inline-flex items-center gap-2">
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
              ترحيل للكاش
            </span>
          </button>
          <button
            type="button"
            onClick={handleClear}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-cairo font-medium bg-slate-300 dark:bg-slate-600/50 hover:bg-slate-400 dark:hover:bg-slate-500/60 text-slate-800 dark:text-slate-300 border border-slate-400 dark:border-white/10 transition-all"
          >
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/><path d="M10 11v6M14 11v6"/></svg>
            مسح
          </button>
        </div>
      </div>
    </div>
  )
}
