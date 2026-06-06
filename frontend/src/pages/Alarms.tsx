import { useEffect, useState } from 'react'
import { api } from '../api/client'

const classColor: Record<string, string> = {
  CRITICAL: 'bg-red-900/40 text-red-400 border-red-800',
  ERROR:    'bg-orange-900/40 text-orange-400 border-orange-800',
  WARNING:  'bg-yellow-900/40 text-yellow-400 border-yellow-800',
  INFO:     'bg-blue-900/40 text-blue-400 border-blue-800',
}

export default function Alarms() {
  const [alarms, setAlarms] = useState<any[]>([])

  useEffect(() => { api.alarms().then(setAlarms).catch(console.error) }, [])

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Aktive Alarme</h1>
      {alarms.length === 0 ? (
        <div className="text-center py-12 text-ella-green text-sm">Keine aktiven Alarme</div>
      ) : (
        <div className="space-y-2">
          {alarms.map(a => (
            <div key={a.id} className={`rounded-xl p-4 border ${classColor[a.alarm_class] ?? classColor.INFO}`}>
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-mono mr-2">{a.alarm_code}</span>
                  <span className="text-sm">{a.message}</span>
                </div>
                <span className="text-xs text-gray-500">{a.triggered_at?.slice(0, 19)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
