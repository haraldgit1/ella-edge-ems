import { useEffect, useState } from 'react'
import { api } from '../api/client'

export default function OpsRules() {
  const [latest, setLatest] = useState<any>(null)
  const [history, setHistory] = useState<any[]>([])

  useEffect(() => {
    api.latestDecision().then(setLatest).catch(console.error)
    api.controlDecisions(20).then(setHistory).catch(console.error)
  }, [])

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Regelentscheidungen</h1>

      {latest && !latest.error && (
        <div className="bg-gray-900 rounded-xl p-5 border border-gray-800 grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
          <div><span className="text-gray-500 text-xs">Zeitpunkt</span><p className="font-mono text-xs mt-0.5">{latest.timestamp_utc?.slice(0, 19)}</p></div>
          <div><span className="text-gray-500 text-xs">B+ Verbrauch</span><p className="text-ella-green font-bold">{Math.round(latest.bplus_power_w)} W</p></div>
          <div><span className="text-gray-500 text-xs">B- Verbrauch</span><p>{Math.round(latest.bminus_power_w)} W</p></div>
          <div><span className="text-gray-500 text-xs">Batterie SOC</span><p>{latest.battery_soc_percent ?? '—'} %</p></div>
          <div><span className="text-gray-500 text-xs">Sollwert gesendet</span><p className="font-bold">{latest.sent_setpoint_w ?? '—'} W</p></div>
          <div><span className="text-gray-500 text-xs">Grund</span>
            <p className={`text-xs font-mono mt-0.5 ${latest.decision_status === 'OK' ? 'text-green-400' : 'text-yellow-400'}`}>
              {latest.reason}
            </p>
          </div>
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-gray-800">
        <table className="w-full text-xs">
          <thead className="bg-gray-900 text-gray-400 uppercase">
            <tr>
              {['Zeitpunkt', 'B+ W', 'Sollwert W', 'SOC %', 'Status', 'Grund'].map(h => (
                <th key={h} className="px-3 py-2 text-left">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {history.map(r => (
              <tr key={r.id} className="border-t border-gray-800 hover:bg-gray-900/50">
                <td className="px-3 py-2 font-mono">{r.timestamp_utc?.slice(11, 19)}</td>
                <td className="px-3 py-2 text-ella-green">{Math.round(r.bplus_power_w)}</td>
                <td className="px-3 py-2 font-bold">{r.sent_setpoint_w ?? '—'}</td>
                <td className="px-3 py-2">{r.battery_soc_percent ?? '—'}</td>
                <td className="px-3 py-2">
                  <span className={r.decision_status === 'OK' ? 'text-green-400' : 'text-yellow-400'}>
                    {r.decision_status}
                  </span>
                </td>
                <td className="px-3 py-2 text-gray-500 font-mono">{r.reason}</td>
              </tr>
            ))}
            {history.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-600">Keine Daten</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
