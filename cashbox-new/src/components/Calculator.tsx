import { useCallback, useEffect, useRef, useState } from 'react'

type Op = '+' | '-' | '*' | '/' | '%'

export type TransferField = 'cash' | 'mada' | 'visa' | 'mastercard' | 'bankTransfer'

interface CalculatorProps {
  onTransfer?: (amount: number, field: TransferField) => void
  hasActiveRow?: boolean
}

const KEY_MAP: Record<string, string> = {
  Enter: '=',
  '=': '=',
  Backspace: '⌫',
  Escape: 'C',
  ',': '.',
}

/** ترحيل من الحاسبة: مدى، فيزا، ماستر كارد فقط (كاش من حاسبة الكاش، تحويل بنكي لا يُرحّل من الحاسبة) */
const TRANSFER_OPTIONS: { field: 'mada' | 'visa' | 'mastercard'; label: string; icon: JSX.Element }[] = [
  { field: 'mada', label: 'مدى', icon: <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="6" width="20" height="12" rx="1"/><path d="M2 10h20M7 14h2"/></svg> },
  { field: 'visa', label: 'فيزا', icon: <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="6" width="20" height="12" rx="1"/><path d="M2 12h20M9 9v6"/></svg> },
  { field: 'mastercard', label: 'ماستر كارد', icon: <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="6" width="20" height="12" rx="1"/><path d="M2 12h20M12 9v6"/></svg> },
]

export function Calculator({ onTransfer, hasActiveRow }: CalculatorProps = {}) {
  const [display, setDisplay] = useState('0')
  const [expression, setExpression] = useState('')
  const [history, setHistory] = useState<string[]>([])
  const [showHistory, setShowHistory] = useState(false)
  const [showTransferMenu, setShowTransferMenu] = useState(false)
  const currentRef = useRef('0')
  const prevRef = useRef('')
  const opRef = useRef<Op | null>(null)
  const resetOnNextRef = useRef(false)
  const handleKeyRef = useRef<(key: string) => void>(() => {})
  const containerRef = useRef<HTMLDivElement>(null)

  const updateDisplay = useCallback((v: string) => {
    currentRef.current = v
    setDisplay(v)
  }, [])

  /** تحديث الشاشة فقط دون تغيير currentRef (لعرض الناتج المباشر حتى يبقى الرقم الثاني صحيحاً عند =) */
  const setDisplayOnly = useCallback((v: string) => {
    setDisplay(v)
  }, [])

  const computeResult = useCallback((prevStr: string, op: Op | null, currStr: string): number => {
    const prev = parseFloat(prevStr) || 0
    const curr = parseFloat(currStr) || 0
    if (!op) return curr
    if (op === '+') return prev + curr
    if (op === '-') return prev - curr
    if (op === '*') return prev * curr
    if (op === '/') return curr === 0 ? 0 : prev / curr
    if (op === '%') return curr === 0 ? 0 : (prev * curr) / 100
    return curr
  }, [])

  const compute = useCallback(() => {
    const result = computeResult(prevRef.current, opRef.current, currentRef.current)
    const expr = `${prevRef.current} ${opRef.current} ${currentRef.current} = ${result}`
    setHistory((h) => [expr, ...h].slice(0, 20))
    updateDisplay(String(result))
    setExpression('')
    prevRef.current = ''
    opRef.current = null
    resetOnNextRef.current = true
  }, [updateDisplay, computeResult])

  const handleKey = useCallback(
    (key: string) => {
      if (key === 'C') {
        updateDisplay('0')
        setExpression('')
        setHistory([])
        setShowHistory(false)
        prevRef.current = ''
        opRef.current = null
        resetOnNextRef.current = false
        return
      }
      if (key === '⌫') {
        const s = currentRef.current
        if (s.length <= 1) {
          updateDisplay('0')
          return
        }
        updateDisplay(s.slice(0, -1))
        return
      }
      if (key === '=') {
        if (opRef.current) compute()
        return
      }
      if (['+', '-', '*', '/', '%'].includes(key)) {
        if (opRef.current) compute()
        prevRef.current = currentRef.current
        opRef.current = key as Op
        setExpression((e) => e + ' ' + key)
        resetOnNextRef.current = true
        return
      }
      if (key === '.') {
        if (resetOnNextRef.current) {
          updateDisplay('0.')
          currentRef.current = '0.'
          resetOnNextRef.current = false
          return
        }
        if (currentRef.current.includes('.')) return
        const next = currentRef.current + '.'
        currentRef.current = next
        if (opRef.current) {
          setDisplayOnly(String(computeResult(prevRef.current, opRef.current, next)))
        } else {
          updateDisplay(next)
        }
        setExpression((e) => e + key)
        return
      }
      if (/\d/.test(key)) {
        if (resetOnNextRef.current) {
          currentRef.current = key
          if (opRef.current) {
            setDisplayOnly(String(computeResult(prevRef.current, opRef.current, key)))
          } else {
            updateDisplay(key)
          }
          resetOnNextRef.current = false
        } else {
          const next = currentRef.current === '0' ? key : currentRef.current + key
          currentRef.current = next
          if (opRef.current) {
            setDisplayOnly(String(computeResult(prevRef.current, opRef.current, next)))
          } else {
            updateDisplay(next)
          }
        }
        setExpression((e) => e + key)
      }
    },
    [updateDisplay, setDisplayOnly, compute, computeResult]
  )
  handleKeyRef.current = handleKey

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      if (target.closest('input, textarea, select')) return
      if (!containerRef.current?.contains(target)) return
      const key = KEY_MAP[e.key] ?? (e.key.length === 1 ? e.key : '')
      if (!key) return
      const calcKeys = ['C', '⌫', '%', '/', '*', '-', '+', '=', '.', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9']
      if (!calcKeys.includes(key) && !/^\d$/.test(key)) return
      e.preventDefault()
      handleKeyRef.current(key)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const keys = [
    ['C', '⌫', '%', '/'],
    ['7', '8', '9', '*'],
    ['4', '5', '6', '-'],
    ['1', '2', '3', '+'],
    ['0', '.', '='],
  ]

  const isOp = (k: string) => ['+', '-', '*', '/', '%'].includes(k)
  const btnClass = (k: string) => {
    if (k === '=') return 'col-span-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 font-bold text-lg border border-amber-500/40'
    if (isOp(k)) return 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 font-bold border border-amber-500/40 flex items-center justify-center'
    if (k === 'C') return 'bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/40 text-base'
    if (k === '⌫') return 'bg-slate-600/40 hover:bg-slate-500/50 text-slate-300 border border-white/10 text-base'
    return 'bg-slate-700/40 hover:bg-slate-600/50 text-slate-200 border border-white/10 active:scale-[0.98] text-base'
  }

  const opIcons: Record<string, JSX.Element> = {
    '+': (
      <svg className="w-[0.875rem] h-[0.875rem]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
        <path d="M12 5v14M5 12h14" />
      </svg>
    ),
    '-': (
      <svg className="w-[0.875rem] h-[0.875rem]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
        <path d="M5 12h14" />
      </svg>
    ),
    '*': (
      <svg className="w-[0.875rem] h-[0.875rem]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M7 7l10 10M17 7L7 17" />
      </svg>
    ),
    '/': (
      <svg className="w-[0.875rem] h-[0.875rem]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M5 4l14 16" />
      </svg>
    ),
    '%': (
      <svg className="w-[0.875rem] h-[0.875rem]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="6" cy="6" r="2.5" />
        <circle cx="18" cy="18" r="2.5" />
        <path d="M6 18L18 6" />
      </svg>
    ),
  }

  const renderKeyContent = (k: string) => {
    if (opIcons[k]) return opIcons[k]
    return <span className="inline-block leading-none">{k}</span>
  }

  return (
    <div
      ref={containerRef}
      className="w-[80%] max-w-full h-full min-h-0 flex flex-col rounded-2xl overflow-hidden mx-auto border border-amber-500/20 bg-slate-800/50 shadow-[0_4px_24px_rgba(0,0,0,0.25),0_0_1px_rgba(255,255,255,0.06)] backdrop-blur-sm"
      tabIndex={0}
      title="انقر هنا ثم استخدم لوحة المفاتيح. النتيجة لا تتغير عند الكتابة في الجدول."
    >
      <div className="bg-gradient-to-b from-amber-500/15 to-slate-800/60 px-4 py-3 border-b-2 border-amber-500/25 flex items-center justify-between gap-2 shadow-[0_2px_8px_rgba(0,0,0,0.1)]">
        <h3 className="flex items-center gap-2.5 text-base font-semibold text-amber-400 font-cairo tracking-wide">
          <span className="flex items-center justify-center w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400">
            <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="4" y="2" width="16" height="20" rx="2" />
            <path d="M6 6h12M6 10h12" />
            <rect x="6.5" y="13.5" width="3" height="3" rx="0.5" />
            <rect x="10.5" y="13.5" width="3" height="3" rx="0.5" />
            <rect x="14.5" y="13.5" width="3" height="3" rx="0.5" />
            <rect x="6.5" y="17.5" width="3" height="3" rx="0.5" />
            <rect x="10.5" y="17.5" width="3" height="3" rx="0.5" />
            <rect x="14.5" y="17.5" width="3" height="3" rx="0.5" />
          </svg>
          </span>
          الآلة الحاسبة
        </h3>
        <button
          type="button"
          onClick={() => setShowHistory((v) => !v)}
          className={`p-1.5 rounded-lg transition ${showHistory ? 'bg-amber-500/20 text-amber-400' : 'text-slate-400 hover:text-amber-400 hover:bg-white/5'}`}
          title={showHistory ? 'إخفاء السجل' : 'سجل العمليات'}
          aria-label="سجل العمليات"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 6v6l4 2" />
          </svg>
        </button>
      </div>
      <div className="flex-1 flex flex-col p-4 space-y-3 min-h-0">
        <div className="rounded-xl bg-slate-900/80 border border-amber-500/30 p-2 shadow-[0_0_18px_rgba(245,158,11,0.14)]">
          <div className="text-right text-slate-500 text-xs min-h-[16px] font-cairo tabular-nums select-none" aria-hidden="true">
            {expression || '\u200b'}
          </div>
          <div
            className="w-full px-3 py-2.5 rounded-lg bg-slate-900/50 border-0 text-white text-right font-cairo text-2xl font-semibold tabular-nums min-h-[2.5rem] flex items-center justify-end"
            aria-live="polite"
            aria-label={`النتيجة: ${display}`}
          >
            {display}
          </div>
        </div>
        {onTransfer && (
          <div className="relative z-10">
            <button
              type="button"
              onClick={() => {
                const n = parseFloat(display) || 0
                if (!hasActiveRow || n <= 0) return
                setShowTransferMenu((v) => !v)
              }}
              disabled={!hasActiveRow || !(parseFloat(display) || 0)}
              title="ترحيل الرقم إلى عمود"
              className="w-full py-2 rounded-xl text-sm font-cairo font-medium bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/40 disabled:opacity-50 disabled:pointer-events-none transition flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
              ترحيل الرقم
            </button>
            {showTransferMenu && (
              <>
                <div className="absolute left-0 right-0 top-full mt-1 z-10 rounded-xl border border-white/10 bg-slate-800 shadow-xl py-2" role="menu">
                  <div className="text-xs text-slate-500 font-cairo px-3 mb-1.5">أين تريد الترحيل؟</div>
                  {TRANSFER_OPTIONS.map(({ field, label, icon }) => (
                    <button
                      key={field}
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        const amount = parseFloat(display) || 0
                        if (amount > 0) onTransfer(amount, field)
                        setShowTransferMenu(false)
                        updateDisplay('0')
                        setExpression('')
                      }}
                      className="w-full flex items-center gap-3 px-3 py-2 text-right font-cairo text-sm text-slate-200 hover:bg-amber-500/20 hover:text-amber-400 transition"
                    >
                      <span className="text-amber-400/90">{icon}</span>
                      {label}
                    </button>
                  ))}
                </div>
                <div className="fixed inset-0 z-[9]" aria-hidden="true" onClick={() => setShowTransferMenu(false)} />
              </>
            )}
          </div>
        )}
        <div className="grid grid-cols-4 gap-2">
          {keys.flat().map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => handleKey(k)}
              className={`py-2.5 rounded-xl font-cairo transition-all duration-150 ${btnClass(k)}`}
              aria-label={k === '⌫' ? 'حذف' : k}
            >
              {renderKeyContent(k)}
            </button>
          ))}
        </div>
        {showHistory && (
          <div className="mt-3 pt-3 rounded-xl bg-slate-900/40 border border-white/10 shadow-inner px-3 py-2.5">
            <div className="flex items-center gap-2 text-xs font-medium text-amber-400/80 font-cairo mb-2">
              <svg className="w-3.5 h-3.5 shrink-0 opacity-80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 8v4l2 2" />
                <circle cx="12" cy="12" r="10" />
              </svg>
              سجل العمليات
            </div>
            <div className="max-h-24 overflow-y-auto text-xs text-slate-300 font-cairo space-y-1.5 scrollbar-thin rounded-lg">
              {history.length === 0 ? (
                <div className="text-slate-500 py-3 text-center rounded-lg bg-slate-800/30">لا يوجد سجل بعد</div>
              ) : (
                history.map((h, i) => (
                  <div key={i} className="tabular-nums px-2 py-1 rounded-md bg-slate-800/40 text-slate-300 hover:bg-slate-800/60 transition">{h}</div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
