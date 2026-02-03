import { useState, useEffect } from 'react'
import { Welcome } from './pages/Welcome'
import { CashBox } from './pages/CashBox'

const NAME_KEY = 'cashbox_name'

export default function App() {
  const [name, setName] = useState<string | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const n = sessionStorage.getItem(NAME_KEY)
    if (n?.trim()) setName(n.trim())
    setReady(true)
  }, [])

  const handleEnter = (n: string) => {
    sessionStorage.setItem(NAME_KEY, n)
    setName(n)
  }

  const handleExit = () => {
    sessionStorage.removeItem(NAME_KEY)
    setName(null)
  }

  if (!ready) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-slate-500 font-cairo">جاري التحميل...</div>
      </div>
    )
  }

  if (name) {
    return <CashBox name={name} onExit={handleExit} />
  }

  return <Welcome onEnter={handleEnter} />
}
