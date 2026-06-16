import { Outlet, NavLink, useNavigate } from 'react-router-dom'

const tabs = [
  { to: '/mdm/participants',   label: 'Teilnehmer'     },
  { to: '/mdm/devices',        label: 'Geräte'          },
  { to: '/mdm/smartmeter-log', label: 'SmartMeter Log'  },
]

export default function MdmLayout() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-800 dark:text-gray-100 flex flex-col">
      <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-6 py-3 flex items-center gap-6 flex-wrap">
        <div className="flex items-center gap-3 shrink-0">
          <span className="font-bold text-purple-600 dark:text-purple-400 text-lg tracking-tight">MDM</span>
          <span className="text-gray-500 text-sm">Stammdatenverwaltung</span>
        </div>

        <nav className="flex gap-1 flex-wrap">
          {tabs.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `text-sm px-3 py-1.5 rounded-lg transition-colors ${
                  isActive
                    ? 'bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 font-medium'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-200 dark:hover:bg-gray-800'
                }`
              }
            >
              {label}
            </NavLink>
          ))}
        </nav>

        <button
          onClick={() => navigate('/operator/dashboard')}
          className="ml-auto text-xs text-gray-500 hover:text-gray-300 transition-colors shrink-0"
        >
          ← EMS Dashboard
        </button>
      </header>

      <main className="flex-1 p-4 overflow-hidden">
        <Outlet />
      </main>
    </div>
  )
}
