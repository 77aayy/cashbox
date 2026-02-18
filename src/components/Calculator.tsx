import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { TransferFlyRect } from './TransferFlyAnimation'

type Op = '+' | '-' | '*' | '/' | '%'

export type TransferField = 'cash' | 'mada' | 'visa' | 'mastercard' | 'bankTransfer' | 'programBalanceBank'

interface CalculatorProps {
  onTransfer?: (amount: number, field: TransferField, sourceRect?: TransferFlyRect) => void
  hasActiveRow?: boolean
}

const KEY_MAP: Record<string, string> = {
  Enter: '=',
  '=': '=',
  Backspace: '⌫',
  Escape: 'C',
  ',': '.',
}

/** ترحيل من الآلة الحاسبة حصراً إلى خانة واحدة: اجمالى الموازنه */
const CALCULATOR_TRANSFER_FIELD: TransferField = 'programBalanceBank'
const CALCULATOR_TRANSFER_LABEL = 'اجمالى الموازنه'

export function Calculator({ onTransfer, hasActiveRow }: CalculatorProps = {}) {
  const [display, setDisplay] = useState('0')
  const [expression, setExpression] = useState('')
  const [history, setHistory] = useState<string[]>([])
  const [showHistory, setShowHistory] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const transferBtnRef = useRef<HTMLButtonElement>(null)
  const [popoverPosition, setPopoverPosition] = useState<{ right: number; bottom: number } | null>(null)

  useLayoutEffect(() => {
    if (!showHistory) {
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
  }, [showHistory])

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
    if (k === '=') return 'col-span-2 bg-teal-500 hover:bg-teal-600 dark:bg-teal-500/20 dark:hover:bg-teal-500/30 text-white dark:text-teal-400 font-bold text-lg border-2 border-teal-400 dark:border-teal-500/40 shadow-sm'
    if (isOp(k)) return 'bg-teal-100 hover:bg-teal-200 dark:bg-teal-500/20 dark:hover:bg-teal-500/30 text-teal-700 dark:text-teal-400 font-bold border-2 border-teal-300 dark:border-teal-500/40 flex items-center justify-center shadow-sm'
    if (k === 'C') return 'bg-red-100 hover:bg-red-200 dark:bg-red-500/20 dark:hover:bg-red-500/30 text-red-600 dark:text-red-400 border-2 border-red-300 dark:border-red-500/40 text-base shadow-sm'
    if (k === '⌫') return 'bg-stone-400 hover:bg-stone-500 dark:bg-slate-600/40 dark:hover:bg-slate-500/50 text-white dark:text-slate-300 border-2 border-stone-500 dark:border-white/10 text-base shadow-sm'
    return 'bg-white dark:bg-slate-700/40 hover:bg-stone-100 dark:hover:bg-slate-600/50 text-stone-900 dark:text-slate-200 border-2 border-stone-400 dark:border-white/10 active:scale-[0.98] text-base shadow-sm'
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
      className="w-full h-full min-h-0 flex flex-col rounded-2xl overflow-hidden border-2 border-stone-400 dark:border-teal-500/25 page-surface-warm-card dark:bg-slate-800/50 shadow-[0_4px_20px_rgba(0,0,0,0.08),0_0_0_1px_rgba(0,0,0,0.08)] dark:shadow-[0_4px_24px_rgba(0,0,0,0.25),0_0_1px_rgba(255,255,255,0.06)] backdrop-blur-sm"
      tabIndex={0}
      title="انقر هنا ثم استخدم لوحة المفاتيح. النتيجة لا تتغير عند الكتابة في الجدول."
    >
      <div className="bg-stone-200 dark:bg-slate-800 dark:border-slate-600 px-3 sm:px-4 py-2 sm:py-3 border-b-2 border-stone-400 dark:border-slate-600 flex items-center justify-between gap-2 shadow-sm">
        <h3 className="flex items-center gap-2 sm:gap-2.5 text-sm sm:text-base font-semibold text-stone-900 dark:text-slate-200 font-cairo tracking-wide min-w-0">
          <span className="flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-lg sm:rounded-xl bg-stone-300 dark:bg-slate-600 text-stone-800 dark:text-slate-200 shrink-0">
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
          ref={triggerRef}
          type="button"
          onClick={() => setShowHistory((v) => !v)}
          className={`p-1.5 rounded-lg transition ${showHistory ? 'bg-stone-300 text-stone-800 dark:bg-teal-500/20 dark:text-teal-400' : 'text-stone-700 dark:text-slate-400 hover:text-stone-900 hover:bg-stone-300 dark:hover:text-teal-400 dark:hover:bg-white/5'}`}
          title={showHistory ? 'إخفاء السجل' : 'سجل العمليات'}
          aria-label="سجل العمليات"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 6v6l4 2" />
          </svg>
        </button>
      </div>
      <div className="flex-1 flex flex-col p-3 sm:p-4 space-y-2 sm:space-y-3 min-h-0">
        <div className="rounded-xl bg-stone-100 dark:bg-slate-900/80 border-2 border-stone-400 dark:border-slate-600 p-2 shadow-inner dark:ring-0">
          <div className="text-right text-stone-700 text-xs min-h-[16px] font-cairo tabular-nums select-none" aria-hidden="true">
            {expression || '\u200b'}
          </div>
          <div
            className="w-full px-3 py-2.5 rounded-lg bg-stone-50 dark:bg-slate-900/50 border-2 border-stone-300 dark:border-transparent text-stone-900 dark:text-white text-right font-cairo text-2xl font-semibold tabular-nums min-h-[2.5rem] flex items-center justify-end"
            aria-live="polite"
            aria-label={`النتيجة: ${display}`}
          >
            {display}
          </div>
        </div>
        {onTransfer && (
          <button
            ref={transferBtnRef}
            type="button"
            onClick={() => {
              const amount = parseFloat(display) || 0
              if (!hasActiveRow || amount <= 0) return
              let sourceRect: TransferFlyRect | undefined
              if (transferBtnRef.current) {
                const r = transferBtnRef.current.getBoundingClientRect()
                sourceRect = { x: r.x, y: r.y, width: r.width, height: r.height }
              }
              onTransfer(amount, CALCULATOR_TRANSFER_FIELD, sourceRect)
              setHistory((h) => [`مرحّل → ${CALCULATOR_TRANSFER_LABEL}: ${amount}`, ...h].slice(0, 20))
              updateDisplay('0')
              setExpression('')
            }}
            disabled={!hasActiveRow || !(parseFloat(display) || 0)}
            title={`ترحيل الرقم إلى ${CALCULATOR_TRANSFER_LABEL}`}
            className="w-full py-2 rounded-xl text-sm font-cairo font-medium bg-teal-500 hover:bg-teal-600 dark:bg-emerald-500/20 dark:hover:bg-emerald-500/30 text-white dark:text-emerald-400 border-2 border-teal-400 dark:border-emerald-500/40 disabled:opacity-50 disabled:pointer-events-none transition flex items-center justify-center gap-2 shadow-sm"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 19V5M5 12l7-7 7 7"/></svg>
            ترحيل إلى {CALCULATOR_TRANSFER_LABEL}
          </button>
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
        {showHistory && popoverPosition && createPortal(
          <>
            <div className="fixed inset-0 z-[100]" aria-hidden onClick={() => setShowHistory(false)} />
            <div
              className="fixed z-[101] rounded-xl border-2 border-stone-400 dark:border-white/10 bg-white dark:bg-slate-800 shadow-xl py-2 px-3 text-xs font-cairo min-w-[180px] max-h-[280px] overflow-y-auto"
              style={{ right: popoverPosition.right, bottom: popoverPosition.bottom }}
            >
              <div className="font-semibold text-stone-800 dark:text-teal-400 mb-1.5">سجل العمليات</div>
              {history.length === 0 ? (
                <p className="text-stone-600 dark:text-slate-400">لا يوجد سجل بعد</p>
              ) : (
                <ul className="space-y-1 mb-1 max-h-48 overflow-y-auto scrollbar-thin">
                  {history.map((h, i) => (
                    <li key={i} className="tabular-nums px-2 py-1 rounded-md bg-stone-100 dark:bg-slate-800/40 text-stone-800 dark:text-slate-300 border border-stone-300 dark:border-transparent">{h}</li>
                  ))}
                </ul>
              )}
              <button type="button" onClick={() => setShowHistory(false)} className="mt-2 w-full py-1 rounded bg-stone-300 dark:bg-slate-600 text-stone-800 dark:text-slate-200 text-[10px] font-medium">إغلاق</button>
            </div>
          </>,
          document.body
        )}
      </div>
    </div>
  )
}
