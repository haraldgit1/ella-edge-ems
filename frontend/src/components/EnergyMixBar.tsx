export function EnergyMixBar({ localPct, label = true }: { localPct: number; label?: boolean }) {
  const pct = Math.max(0, Math.min(100, localPct))
  const gridPct = 100 - pct

  return (
    <div className="space-y-1">
      {label && (
        <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
          <span className="text-green-600 dark:text-green-400">Lokaler Gemeinschaftsstrom {pct}%</span>
          <span className="text-gray-500 dark:text-gray-400">Netzstrom {gridPct}%</span>
        </div>
      )}
      <div className="h-6 rounded-full overflow-hidden bg-gray-200 dark:bg-gray-700 flex">
        {pct > 0 && (
          <div
            className="h-full bg-green-500 transition-all duration-700 flex items-center justify-center"
            style={{ width: `${pct}%` }}
          >
            {pct >= 15 && <span className="text-xs text-gray-900 dark:text-white font-medium">{pct}%</span>}
          </div>
        )}
        {gridPct > 0 && (
          <div
            className="h-full bg-gray-600 flex items-center justify-center"
            style={{ width: `${gridPct}%` }}
          >
            {gridPct >= 15 && <span className="text-xs text-gray-600 dark:text-gray-300 font-medium">{gridPct}%</span>}
          </div>
        )}
      </div>
    </div>
  )
}
