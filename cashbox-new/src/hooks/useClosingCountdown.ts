import { useEffect, useState } from 'react'

/**
 * Logic: حالة العد التنازلي للوقت الحي ولفترة التراجع بعد ضغط "إغلاق الشفت".
 * (الرول: Logic in hooks)
 */
export function useClosingCountdown() {
  const [liveNow, setLiveNow] = useState(() => new Date())
  const [closingRowId, setClosingRowId] = useState<string | null>(null)
  const [closingEndsAt, setClosingEndsAt] = useState<number | null>(null)
  const [closingSecondsLeft, setClosingSecondsLeft] = useState(0)

  useEffect(() => {
    const t = setInterval(() => {
      const now = Date.now()
      setLiveNow(new Date(now))
      if (closingEndsAt !== null) {
        setClosingSecondsLeft(Math.max(0, Math.ceil((closingEndsAt - now) / 1000)))
      }
    }, 1000)
    return () => clearInterval(t)
  }, [closingEndsAt])

  return {
    liveNow,
    closingRowId,
    setClosingRowId,
    closingEndsAt,
    setClosingEndsAt,
    closingSecondsLeft,
    setClosingSecondsLeft,
  }
}
