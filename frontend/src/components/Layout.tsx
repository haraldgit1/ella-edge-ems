import { Outlet, NavLink } from 'react-router-dom'
import { useState, useEffect } from 'react'

const FE_VERSION = 'F-V1.4'

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

  useEffect(() => {
    fetch('/ella_ems/api/health')
      .then(r => r.json())
      .then(d => setBeVersion(`B-V${d.version}`))
      .catch(() => setBeVersion('B-V?'))
  }, [])

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 flex flex-col">
      <header className="bg-gray-900 border-b border-gray-800 px-6 py-3 flex items-center gap-6 flex-wrap">
        <span className="font-bold text-green-400 text-lg tracking-tight shrink-0">
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
                    ? 'bg-green-900/30 text-green-400 font-medium'
                    : 'text-gray-400 hover:text-gray-100 hover:bg-gray-800'
                }`
              }
            >
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-3 text-xs text-gray-600 shrink-0">
          <span className="font-mono text-gray-500">
            {FE_VERSION}
            {beVersion && <span className="ml-1">{beVersion}</span>}
          </span>
          <span>{new Date().toLocaleDateString('de-AT', { day: '2-digit', month: '2-digit', year: 'numeric' })}</span>
        </div>
      </header>
      <main className="flex-1 p-6">
        <Outlet />
      </main>
    </div>
  )
}
