import { useEffect, useRef } from 'react'

type ToastType = 'success' | 'error' | 'warning' | 'info'

interface ToastProps {
  message: string
  type: ToastType
  onClose: () => void
  /** 'bottom' = أسفل الشاشة (افتراضي)، 'center' = منتصف الشاشة */
  position?: 'bottom' | 'center'
  /** مدة العرض بالميلي ثانية قبل الإخفاء التلقائي (افتراضي 3000) */
  autoHideMs?: number
}

const styles: Record<ToastType, { bg: string; border: string; icon: string }> = {
  success: {
    bg: 'bg-emerald-100 dark:bg-emerald-500/15',
    border: 'border-emerald-400 dark:border-emerald-500/40',
    icon: 'text-emerald-700 dark:text-emerald-400',
  },
  error: {
    bg: 'bg-red-100 dark:bg-red-500/15',
    border: 'border-red-400 dark:border-red-500/40',
    icon: 'text-red-700 dark:text-red-400',
  },
  warning: {
    bg: 'bg-amber-100 dark:bg-amber-500/15',
    border: 'border-amber-400 dark:border-amber-500/40',
    icon: 'text-amber-700 dark:text-amber-400',
  },
  info: {
    bg: 'bg-sky-100 dark:bg-sky-500/15',
    border: 'border-sky-400 dark:border-sky-500/40',
    icon: 'text-sky-700 dark:text-sky-400',
  },
}

const icons: Record<ToastType, JSX.Element> = {
  success: (
    <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6L9 17l-5-5" />
    </svg>
  ),
  error: (
    <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M15 9l-6 6M9 9l6 6" />
    </svg>
  ),
  warning: (
    <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 9v4M12 17h.01" />
      <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
    </svg>
  ),
  info: (
    <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4M12 8h.01" />
    </svg>
  ),
}

const DEFAULT_AUTO_HIDE_MS = 3000

export function Toast({ message, type, onClose, position = 'bottom', autoHideMs = DEFAULT_AUTO_HIDE_MS }: ToastProps) {
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose
  useEffect(() => {
    const ms = autoHideMs > 0 ? autoHideMs : DEFAULT_AUTO_HIDE_MS
    const t = setTimeout(() => onCloseRef.current(), ms)
    return () => clearTimeout(t)
  }, [message, autoHideMs])

  const s = styles[type]
  const positionClass =
    position === 'center'
      ? 'fixed top-1/2 left-1/2 z-50 -translate-x-1/2 -translate-y-1/2'
      : 'fixed bottom-6 left-1/2 z-50 -translate-x-1/2'
  return (
    <div
      role="alert"
      className={`${positionClass} flex items-center gap-3 px-4 py-3 rounded-2xl border ${s.bg} ${s.border} shadow-xl shadow-black/10 dark:shadow-black/20 backdrop-blur-md min-w-[200px] max-w-[90vw]`}
    >
      <span className={s.icon} aria-hidden="true">
        {icons[type]}
      </span>
      <span className="font-cairo text-sm text-stone-800 dark:text-slate-200 flex-1">{message}</span>
      <button
        type="button"
        onClick={onClose}
        className="p-1 rounded-lg text-stone-600 dark:text-slate-400 hover:text-stone-900 dark:hover:text-slate-200 hover:bg-stone-300 dark:hover:bg-white/10 transition focus-visible:ring-2 focus-visible:ring-teal-400 dark:focus-visible:ring-amber-400 focus-visible:ring-offset-2 focus-visible:ring-offset-stone-50 dark:focus-visible:ring-offset-slate-800 focus-visible:outline-none"
        aria-label="إغلاق"
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M18 6L6 18M6 6l12 12" />
        </svg>
      </button>
    </div>
  )
}
