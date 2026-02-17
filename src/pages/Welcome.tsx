import { useState } from 'react'

const LETTERS_ONLY = /^[\p{L}\s]*$/u

function isLettersOnly(s: string): boolean {
  return LETTERS_ONLY.test(s) && s.length > 0 && /\p{L}/u.test(s)
}

interface WelcomeProps {
  onEnter: (name: string) => void
}

export function Welcome({ onEnter }: WelcomeProps) {
  const [name, setName] = useState('')
  const [error, setError] = useState('')

  const canSubmit = isLettersOnly(name.trim())

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value
    if (/\d/.test(v)) return
    setName(v)
    setError('')
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = name.trim()
    if (/\d/.test(trimmed)) {
      setError('الاسم حروف فقط — بدون أرقام')
      return
    }
    if (!/\p{L}/u.test(trimmed)) {
      setError('أدخل اسمك (حروف فقط)')
      return
    }
    setError('')
    onEnter(trimmed)
  }

  return (
    <div className="min-h-screen min-h-[100dvh] bg-gradient-to-br from-[#f4ebe0] via-[#f8f3ed] to-[#efe6dc] dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 flex flex-col items-center justify-center p-4 sm:p-6 safe-top safe-bottom">
      <div className="w-full max-w-[95vw] sm:max-w-md bg-stone-50 dark:bg-slate-800/60 backdrop-blur-xl rounded-2xl sm:rounded-3xl border border-stone-300 dark:border-white/20 shadow-xl dark:shadow-2xl p-5 sm:p-8">
        <div className="text-center mb-6 sm:mb-8">
          <h1 className="text-xl sm:text-2xl font-bold text-primary-500 font-cairo mb-2">أهلاً بك</h1>
          <p className="text-sm sm:text-base text-stone-700 dark:text-slate-400 font-cairo">اكتب اسمك للدخول</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
          {error && (
            <div className="p-3 rounded-xl bg-red-50 dark:bg-red-500/20 border border-red-200 dark:border-red-500/40 text-red-700 dark:text-red-300 text-sm font-cairo">
              {error}
            </div>
          )}
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-stone-800 dark:text-slate-300 mb-2 font-cairo">
              الاسم (حروف فقط)
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={handleChange}
              placeholder="أدخل اسمك"
              className="w-full px-4 py-3 rounded-xl bg-stone-100 dark:bg-slate-900/80 border border-stone-300 dark:border-white/20 text-stone-900 dark:text-white placeholder-stone-500 dark:placeholder-slate-500 focus:border-primary-500/50 focus:ring-1 focus:ring-primary-500/25 focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2 focus-visible:ring-offset-stone-50 dark:focus-visible:ring-offset-slate-900 font-cairo"
              autoComplete="off"
              autoFocus
            />
          </div>
          <button
            type="submit"
            disabled={!canSubmit}
            className="w-full py-3 sm:py-3.5 rounded-xl font-bold font-cairo text-sm sm:text-base bg-primary-500 hover:bg-primary-600 text-white disabled:opacity-40 disabled:cursor-not-allowed transition focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2 focus-visible:ring-offset-stone-50 dark:focus-visible:ring-offset-slate-800 focus-visible:outline-none min-h-[44px] touch-manipulation"
          >
            دخول
          </button>
        </form>
      </div>
    </div>
  )
}
