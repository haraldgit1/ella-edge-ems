export function Tile({ label, value, unit, color = 'text-gray-900 dark:text-white', sub, subColor = 'text-gray-500' }: {
  label: string
  value: string | number | null | undefined
  unit?: string
  color?: string
  sub?: string
  subColor?: string
}) {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl p-5 border border-gray-200 dark:border-gray-800">
      <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">{label}</p>
      <p className={`text-2xl font-bold ${color}`}>
        {value ?? '—'}
        {unit && <span className="text-sm font-normal text-gray-500 dark:text-gray-400 ml-1">{unit}</span>}
      </p>
      {sub && <p className={`text-xs mt-1 ${subColor}`}>{sub}</p>}
    </div>
  )
}
