/**
 * منطق الثيم مستقل عن React — التطبيق والتبديل مباشرة على DOM و localStorage
 * حتى يعمل التبديل في كل المتصفحات (بما فيها المضمّنة).
 * الأوضاع: فاتح، داكن (تركواز)، داكن بينك بناتي.
 */
const THEME_KEY = 'cashbox_theme'
const PINK_STYLE_ID = 'cashbox-theme-pink-vars'

export type ThemeMode = 'light' | 'dark' | 'dark-pink'

const ROOT = typeof document !== 'undefined' ? document.documentElement : null
const BODY = typeof document !== 'undefined' ? document.body : null

const THEME_VALID: ThemeMode[] = ['light', 'dark', 'dark-pink']

/** قيم بينك بناتي لاستبدال التركواز (RGB بدون rgb()) لاستخدامها مع opacity في Tailwind */
const PINK_VARS: Record<string, string> = {
  '--tw-teal-50': '253 245 250',
  '--tw-teal-100': '252 235 245',
  '--tw-teal-200': '250 212 235',
  '--tw-teal-300': '248 195 222',
  '--tw-teal-400': '243 175 210',
  '--tw-teal-500': '238 160 200',
  '--tw-teal-600': '220 135 180',
  '--tw-teal-700': '195 110 158',
  '--tw-teal-800': '168 88 135',
  '--tw-teal-900': '140 70 112',
  '--tw-emerald-50': '253 245 250',
  '--tw-emerald-100': '252 235 245',
  '--tw-emerald-200': '250 212 235',
  '--tw-emerald-300': '248 195 222',
  '--tw-emerald-400': '243 175 210',
  '--tw-emerald-500': '238 160 200',
  '--tw-emerald-600': '220 135 180',
  '--tw-emerald-700': '195 110 158',
  '--tw-emerald-800': '168 88 135',
  '--tw-emerald-900': '140 70 112',
}

/** بناء نص CSS لتعيين متغيرات البينك على الجذر وكل العناصر الداخلية (مثل index.css) */
function getPinkVarsCss(): string {
  const decls = Object.entries(PINK_VARS)
    .map(([k, v]) => `${k}: ${v} !important`)
    .join(' ')
  return `:root, html, .theme-pink.dark, .theme-pink.dark * { ${decls} }`
}

/** إضافة أو إزالة <style> في head لضمان تطبيق متغيرات البينك بغض النظر عن الـ cascade */
function setPinkVariablesOnRoot(apply: boolean): void {
  if (typeof document === 'undefined') return
  const existing = document.getElementById(PINK_STYLE_ID)
  if (apply) {
    if (existing && existing instanceof HTMLStyleElement) {
      existing.textContent = getPinkVarsCss()
    } else {
      const style = document.createElement('style')
      style.id = PINK_STYLE_ID
      style.textContent = getPinkVarsCss()
      document.head.appendChild(style)
    }
  } else {
    if (existing) existing.remove()
  }
}

export function getThemeFromStorage(): ThemeMode {
  try {
    if (typeof localStorage === 'undefined') return 'dark'
    const t = localStorage.getItem(THEME_KEY)
    return THEME_VALID.includes(t as ThemeMode) ? (t as ThemeMode) : 'dark'
  } catch {
    return 'dark'
  }
}

export function applyTheme(value: ThemeMode): void {
  if (!ROOT) return
  const isDark = value === 'dark' || value === 'dark-pink'
  const isPink = value === 'dark-pink'
  ROOT.classList.toggle('dark', isDark)
  ROOT.classList.toggle('theme-pink', isPink)
  ROOT.setAttribute('data-theme', isPink ? 'pink' : '')
  setPinkVariablesOnRoot(isPink)
  if (BODY) {
    BODY.classList.toggle('dark', isDark)
    BODY.classList.toggle('theme-pink', isPink)
  }
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

/** يقرأ الحالة الحالية من الـ DOM ويبدّل: فاتح → داكن → داكن بينك → فاتح */
export function toggleTheme(): void {
  if (!ROOT) return
  const current = getThemeFromStorage()
  const next: ThemeMode = current === 'light' ? 'dark' : current === 'dark' ? 'dark-pink' : 'light'
  applyTheme(next)
  dispatchThemeChange(next)
}
