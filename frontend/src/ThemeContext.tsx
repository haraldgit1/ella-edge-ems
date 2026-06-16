import { createContext, useContext, useState, useEffect, ReactNode } from 'react'

type Theme = 'dark' | 'light'

interface ThemeCtx {
  theme: Theme
  isDark: boolean
  toggle: () => void
}

const ThemeContext = createContext<ThemeCtx>({
  theme: 'dark',
  isDark: true,
  toggle: () => {},
})

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() =>
    (localStorage.getItem('ella-theme') as Theme) ?? 'dark'
  )

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
    localStorage.setItem('ella-theme', theme)
  }, [theme])

  const toggle = () => setTheme(t => t === 'dark' ? 'light' : 'dark')

  return (
    <ThemeContext.Provider value={{ theme, isDark: theme === 'dark', toggle }}>
      {children}
    </ThemeContext.Provider>
  )
}

export const useTheme = () => useContext(ThemeContext)

/** Chart-Farben je nach Theme — für Recharts inline-Props */
export function useChartTheme() {
  const { isDark } = useTheme()
  return {
    gridLine:       isDark ? '#1f2937' : '#e5e7eb',
    tick:           isDark ? '#6b7280' : '#4b5563',
    tickBlue:       isDark ? '#3b82f6' : '#2563eb',
    tooltipBg:      isDark ? '#111827' : '#ffffff',
    tooltipBorder:  isDark ? '#374151' : '#e5e7eb',
    tooltipText:    isDark ? '#9ca3af' : '#374151',
    legendText:     isDark ? '#9ca3af' : '#374151',
  }
}
