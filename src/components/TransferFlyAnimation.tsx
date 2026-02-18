import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

export interface TransferFlyRect {
  x: number
  y: number
  width: number
  height: number
}

interface TransferFlyAnimationProps {
  sourceRect: TransferFlyRect
  targetRect: TransferFlyRect
  amount: number
  formatCurrency: (n: number) => string
  rowId: string
  field: string
  onEnd: () => void
  onLanded?: (rowId: string, field: string) => void
}

const FLY_DURATION_MS = 550

/** عنصر يطير من مصدر (زر الترحيل) إلى الخانة المستهدفة في الجدول — إشارة مرئية لوجهة المبلغ */
export function TransferFlyAnimation({
  sourceRect,
  targetRect,
  amount,
  formatCurrency,
  rowId,
  field,
  onEnd,
  onLanded,
}: TransferFlyAnimationProps) {
  const [phase, setPhase] = useState<'start' | 'fly' | 'done'>('start')
  const targetRectRef = useRef(targetRect)
  targetRectRef.current = targetRect
  const onLandedRef = useRef(onLanded)
  onLandedRef.current = onLanded

  useEffect(() => {
    if (phase !== 'start') return
    const t = requestAnimationFrame(() => setPhase('fly'))
    return () => cancelAnimationFrame(t)
  }, [phase])

  useEffect(() => {
    if (phase !== 'done') return
    onLandedRef.current?.(rowId, field)
    const t = setTimeout(onEnd, 120)
    return () => clearTimeout(t)
  }, [phase, onEnd, rowId, field])

  const handleTransitionEnd = () => {
    setPhase('done')
  }

  const tx = phase === 'start' ? sourceRect.x : targetRectRef.current.x
  const ty = phase === 'start' ? sourceRect.y : targetRectRef.current.y

  const badge = (
    <div
      role="presentation"
      aria-hidden
      className="transfer-fly-badge pointer-events-none fixed z-[9999] flex items-center justify-center rounded-xl border-2 border-teal-500 dark:border-teal-500/80 bg-teal-500/95 dark:bg-teal-500/90 text-white font-cairo font-bold text-sm tabular-nums shadow-lg px-3 py-2 min-w-[72px]"
      style={{
        left: sourceRect.x,
        top: sourceRect.y,
        width: Math.max(72, sourceRect.width),
        height: sourceRect.height,
        transform: `translate(${tx - sourceRect.x}px, ${ty - sourceRect.y}px)`,
        transition: phase === 'fly' ? `transform ${FLY_DURATION_MS}ms cubic-bezier(0.25, 0.1, 0.25, 1)` : 'none',
      }}
      onTransitionEnd={handleTransitionEnd}
    >
      <span className="opacity-95">{formatCurrency(amount)}</span>
    </div>
  )

  return createPortal(badge, document.body)
}
