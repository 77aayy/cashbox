import { useState, useEffect, useCallback } from 'react'
import { Welcome } from './pages/Welcome'
import { CashBox } from './pages/CashBox'
import { getThemeFromStorage, applyTheme, toggleTheme as doToggleTheme, type ThemeMode } from './lib/theme'
import type { Branch } from './lib/storage'

export type { ThemeMode }

const NAME_KEY = 'cashbox_name'
const BRANCH_KEY = 'cashbox_branch'
const SESSION_START_KEY = 'cashbox_session_start'
/** مدة الجلسة: 6 ساعات بحد أقصى */
const SESSION_MAX_MS = 6 * 60 * 60 * 1000

function isValidBranch(s: string | null): s is Branch {
  return s === 'corniche' || s === 'andalusia'
}

function isSessionExpired(): boolean {
  const start = sessionStorage.getItem(SESSION_START_KEY)
  if (!start) return true
  const t = parseInt(start, 10)
  if (Number.isNaN(t)) return true
  return Date.now() - t >= SESSION_MAX_MS
}

export default function App() {
  const [name, setName] = useState<string | null>(null)
  const [branch, setBranch] = useState<Branch>('corniche')
  const [ready, setReady] = useState(false)
  const [theme, setTheme] = useState<ThemeMode>('dark')

  useEffect(() => {
    const n = sessionStorage.getItem(NAME_KEY)
    const b = sessionStorage.getItem(BRANCH_KEY)
    if (n?.trim() && isValidBranch(b) && !isSessionExpired()) {
      setName(n.trim())
      setBranch(b!)
    }
    const t = getThemeFromStorage()
    setTheme(t)
    applyTheme(t)
    setReady(true)
  }, [])

  useEffect(() => {
    const handler = (e: Event) => setTheme((e as CustomEvent<ThemeMode>).detail)
    window.addEventListener('cashbox-theme-change', handler)
    return () => window.removeEventListener('cashbox-theme-change', handler)
  }, [])

  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  /** التحقق من انتهاء الجلسة كل دقيقة — مدة الجلسة 6 ساعات */
  useEffect(() => {
    if (!name) return
    const check = () => {
      if (isSessionExpired()) handleExit()
    }
    const id = setInterval(check, 60_000)
    return () => clearInterval(id)
  }, [name, handleExit])

  const handleEnter = (n: string, b: Branch) => {
    sessionStorage.setItem(NAME_KEY, n)
    sessionStorage.setItem(BRANCH_KEY, b)
    sessionStorage.setItem(SESSION_START_KEY, Date.now().toString())
    setName(n)
    setBranch(b)
  }

  const handleExit = useCallback(() => {
    sessionStorage.removeItem(NAME_KEY)
    sessionStorage.removeItem(BRANCH_KEY)
    sessionStorage.removeItem(SESSION_START_KEY)
    setName(null)
    setBranch('corniche')
  }, [])

  const handleSwitchBranch = (newBranch: Branch) => {
    sessionStorage.setItem(BRANCH_KEY, newBranch)
    setBranch(newBranch)
  }

  if (!ready) {
    return (
      <div className="min-h-screen page-bg-warm dark:bg-slate-900 flex items-center justify-center">
        <div className="text-slate-700 dark:text-slate-500 font-cairo">جاري التحميل...</div>
      </div>
    )
  }

  const toggleTheme = () => doToggleTheme()

  if (name) {
    return <CashBox key={branch} name={name} branch={branch} onExit={handleExit} onSwitchBranch={handleSwitchBranch} theme={theme} onToggleTheme={toggleTheme} />
  }

  return <Welcome onEnter={handleEnter} />
}
