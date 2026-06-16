import { useState } from 'react'
import { usePolling } from '../hooks/usePolling'
import { api } from '../api/client'

const classStyle: Record<string, { border: string; badge: string }> = {
  CRITICAL: { border: 'border-red-200 dark:border-red-800',    badge: 'bg-red-50 dark:bg-red-900/40 text-red-600 dark:text-red-400' },
  ERROR:    { border: 'border-orange-800', badge: 'bg-orange-900/40 text-orange-400' },
  WARNING:  { border: 'border-yellow-800', badge: 'bg-yellow-50 dark:bg-yellow-900/40 text-yellow-600 dark:text-yellow-400' },
  INFO:     { border: 'border-blue-200 dark:border-blue-800',   badge: 'bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400' },
}

export default function Alarms() {
  const [showAll, setShowAll] = useState(false)
  const [working, setWorking] = useState<number | null>(null)

  const { data: activeRaw, error: activeErr } = usePolling(api.activeAlarms, 10000)
  const active: any[] = activeRaw ?? []
  const { data: allRaw, error: allErr } = usePolling(
    showAll ? api.alarms : async () => [],
    10000
  )
  const all: any[] = allRaw ?? []

  const alarms: any[] = showAll ? all : active
  const error = activeErr || allErr

  async function ack(id: number) {
    setWorking(id)
    try { await api.ackAlarm(id) } finally { setWorking(null) }
  }

  async function close(id: number) {
    setWorking(id)
    try { await api.closeAlarm(id) } finally { setWorking(null) }
  }

  if (error) return (
    <div className="text-red-600 dark:text-red-400 bg-red-900/20 rounded-xl p-4 border border-red-200 dark:border-red-800">
      Fehler: {error}
    </div>
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">
          Alarme
          {active.length > 0 && (
            <span className="ml-2 text-sm bg-red-50 dark:bg-red-900/40 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 px-2 py-0.5 rounded-full">
              {active.length} aktiv
            </span>
          )}
        </h1>
        <button
          onClick={() => setShowAll(v => !v)}
          className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-500 transition-colors"
        >
          {showAll ? 'Nur aktive' : 'Alle anzeigen'}
        </button>
      </div>

      {alarms.length === 0 ? (
        <div className="text-center py-16 space-y-2">
          <p className="text-4xl">✓</p>
          <p className="text-green-600 dark:text-green-400 font-medium">Keine aktiven Alarme</p>
          <p className="text-gray-500 dark:text-gray-600 text-sm">System läuft normal.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {alarms.map((a: any) => {
            const s = classStyle[a.alarm_class] ?? classStyle.INFO
            return (
              <div key={a.id} className={`rounded-xl p-4 border bg-white dark:bg-gray-900 ${s.border}`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-xs px-2 py-0.5 rounded font-medium ${s.badge}`}>
                        {a.alarm_class}
                      </span>
                      <span className="text-xs font-mono text-gray-500 dark:text-gray-400">{a.alarm_code}</span>
                      <span className={`text-xs px-2 py-0.5 rounded ${
                        a.status === 'ACTIVE' ? 'bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400' :
                        a.status === 'ACKNOWLEDGED' ? 'bg-yellow-900/30 text-yellow-600 dark:text-yellow-400' :
                        'bg-gray-100 dark:bg-gray-800 text-gray-500'
                      }`}>{a.status}</span>
                    </div>
                    <p className="text-sm text-gray-700 dark:text-gray-200">{a.message}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-600">
                      {a.triggered_at?.slice(0, 19).replace('T', ' ')}
                      {a.acked_at && ` · Quittiert: ${a.acked_at.slice(0, 19).replace('T', ' ')}`}
                    </p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    {a.status === 'ACTIVE' && (
                      <button
                        onClick={() => ack(a.id)}
                        disabled={working === a.id}
                        className="text-xs px-3 py-1.5 rounded-lg bg-yellow-900/30 text-yellow-600 dark:text-yellow-400 border border-yellow-800 hover:bg-yellow-900/50 disabled:opacity-50 transition-colors"
                      >
                        {working === a.id ? '...' : 'Quittieren'}
                      </button>
                    )}
                    {a.status !== 'CLOSED' && (
                      <button
                        onClick={() => close(a.id)}
                        disabled={working === a.id}
                        className="text-xs px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 border border-gray-300 dark:border-gray-700 hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50 transition-colors"
                      >
                        Schließen
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
