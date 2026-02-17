/**
 * منطق الثيم مستقل عن React — التطبيق والتبديل مباشرة على DOM و localStorage
 * حتى يعمل التبديل في كل المتصفحات (بما فيها المضمّنة).
 */
const THEME_KEY = 'cashbox_theme'
export type ThemeMode = 'light' | 'dark'

const ROOT = typeof document !== 'undefined' ? document.documentElement : null
const BODY = typeof document !== 'undefined' ? document.body : null

export function getThemeFromStorage(): ThemeMode {
  try {
    if (typeof localStorage === 'undefined') return 'dark'
    const t = localStorage.getItem(THEME_KEY)
    return t === 'light' || t === 'dark' ? t : 'dark'
  } catch {
    return 'dark'
  }
}

export function applyTheme(value: ThemeMode): void {
  if (!ROOT) return
  const isDark = value === 'dark'
  ROOT.classList.toggle('dark', isDark)
  if (BODY) BODY.classList.toggle('dark', isDark)
  try {
    localStorage.setItem(THEME_KEY, value)
  } catch (_) {}
  void ROOT.offsetHeight
}

function dispatchThemeChange(value: ThemeMode): void {
  try {
    window.dispatchEvent(new CustomEvent<ThemeMode>('cashbox-theme-change', { detail: value }))
  } catch (_) {}
}

/** يقرأ الحالة الحالية من الـ DOM ويبدّل ثم يصدّر الحدث لمزامنة React */
export function toggleTheme(): void {
  if (!ROOT) return
  const isDarkNow = ROOT.classList.contains('dark')
  const next: ThemeMode = isDarkNow ? 'light' : 'dark'
  applyTheme(next)
  dispatchThemeChange(next)
}
