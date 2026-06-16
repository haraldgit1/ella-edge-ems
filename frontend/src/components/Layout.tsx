import { Outlet, NavLink } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { useTheme } from '../ThemeContext'

const FE_VERSION = 'F-V1.5'

const nav = [
  { to: '/operator/dashboard',   label: 'Dashboard',  group: 'Betreiber' },
  { to: '/operator/participants', label: 'Teilnehmer', group: 'Betreiber' },
  { to: '/operator/meters',       label: 'Zähler',    group: 'Betreiber' },
  { to: '/operator/devices',      label: 'Geräte',    group: 'Betreiber' },
  { to: '/operator/alarms',       label: 'Alarme',      group: 'Betreiber' },
  { to: '/operator/settlement',   label: 'Settlement', group: 'Betreiber' },
  { to: '/operator/reports',      label: 'Reports',    group: 'Betreiber' },
  { to: '/resident/dashboard',    label: 'Strommix',   group: 'Bewohner'  },
  { to: '/ops/rules',             label: 'Regelung',  group: 'Ops'       },
  { to: '/simulation',            label: 'Simulation', group: 'Demo'     },
  { to: '/documents',             label: 'Dokumente',  group: 'Info'     },
]

export default function Layout() {
  const [beVersion, setBeVersion] = useState<string | null>(null)
  const { isDark, toggle } = useTheme()

  useEffect(() => {
    fetch('/ella_ems/api/health')
      .then(r => r.json())
      .then(d => setBeVersion(`B-V${d.version}`))
      .catch(() => setBeVersion('B-V?'))
  }, [])

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-800 dark:text-gray-100 flex flex-col">
      <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-6 py-3 flex items-center gap-6 flex-wrap print:hidden">
        <span className="font-bold text-green-600 dark:text-green-400 text-lg tracking-tight shrink-0">
          Ella Edge EMS
        </span>
        <nav className="flex gap-1 flex-wrap">
          {nav.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `text-sm px-3 py-1.5 rounded-lg transition-colors ${
                  isActive
                    ? 'bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400 font-medium'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-200 dark:hover:bg-gray-800'
                }`
              }
            >
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-3 text-xs text-gray-500 shrink-0">
          <span className="font-mono">
            {FE_VERSION}
            {beVersion && <span className="ml-1">{beVersion}</span>}
          </span>
          <span>{new Date().toLocaleDateString('de-AT', { day: '2-digit', month: '2-digit', year: 'numeric' })}</span>
          <button
            onClick={toggle}
            title={isDark ? 'Hell-Modus aktivieren' : 'Dunkel-Modus aktivieren'}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-base bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700 transition-colors"
          >
            {isDark ? '☀' : '🌙'}
          </button>
        </div>
      </header>
      <main className="flex-1 p-6">
        <Outlet />
      </main>
    </div>
  )
}
