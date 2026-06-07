type Status = 'ok' | 'warning' | 'error' | 'offline' | 'sim'

const styles: Record<Status, string> = {
  ok:      'bg-green-900/40 text-green-400 border-green-800',
  warning: 'bg-yellow-900/40 text-yellow-400 border-yellow-800',
  error:   'bg-red-900/40 text-red-400 border-red-800',
  offline: 'bg-gray-800 text-gray-500 border-gray-700',
  sim:     'bg-orange-900/40 text-orange-400 border-orange-800',
}

export function StatusBadge({ status, label }: { status: Status; label: string }) {
  return (
    <span className={`inline-block text-xs px-2 py-0.5 rounded-full border font-medium ${styles[status]}`}>
      {label}
    </span>
  )
}
