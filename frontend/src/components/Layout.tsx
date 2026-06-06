import { Outlet, NavLink } from 'react-router-dom'

const nav = [
  { to: '/operator/dashboard', label: 'Dashboard' },
  { to: '/operator/participants', label: 'Teilnehmer' },
  { to: '/operator/meters', label: 'Zähler' },
  { to: '/operator/alarms', label: 'Alarme' },
  { to: '/ops/rules', label: 'Regelung' },
]

export default function Layout() {
  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 flex flex-col">
      <header className="bg-gray-900 border-b border-gray-800 px-6 py-3 flex items-center gap-8">
        <span className="font-bold text-ella-green text-lg tracking-tight">Ella Edge EMS</span>
        <nav className="flex gap-4">
          {nav.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `text-sm px-3 py-1 rounded transition-colors ${
                  isActive
                    ? 'bg-ella-green/20 text-ella-green font-medium'
                    : 'text-gray-400 hover:text-gray-100'
                }`
              }
            >
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="ml-auto text-xs text-gray-500">
          {new Date().toLocaleDateString('de-AT')}
        </div>
      </header>
      <main className="flex-1 p-6">
        <Outlet />
      </main>
    </div>
  )
}
