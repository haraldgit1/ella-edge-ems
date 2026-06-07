import { useState } from 'react'
import { usePolling } from '../hooks/usePolling'
import { api } from '../api/client'
import { StatusBadge } from '../components/StatusBadge'

function DetailModal({ row, onClose }: { row: any; onClose: () => void }) {
  const fields: [string, string | number | null][] = [
    ['Zeitpunkt',            row.timestamp_utc?.slice(0, 19).replace('T', ' ')],
    ['B+ Verbrauch',         `${Math.round(row.bplus_power_w ?? 0)} W`],
    ['B- Verbrauch',         `${Math.round(row.bminus_power_w ?? 0)} W`],
    ['PV-Leistung',          row.pv_power_w != null ? `${Math.round(row.pv_power_w)} W` : '—'],
    ['Batterie SOC',         row.battery_soc_percent != null ? `${row.battery_soc_percent} %` : '—'],
    ['Max. Entladung',       row.max_allowed_discharge_w != null ? `${row.max_allowed_discharge_w} W` : '—'],
    ['Sollwert berechnet',   `${Math.round(row.calculated_setpoint_w ?? 0)} W`],
    ['Sollwert gesendet',    `${Math.round(row.sent_setpoint_w ?? 0)} W`],
    ['Wechselrichter Istwert', `${Math.round(row.actual_inverter_power_w ?? 0)} W`],
    ['Status',               row.decision_status],
    ['Grund',                row.reason],
    ['Algorithmus',          row.algorithm_version],
  ]

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-lg space-y-3"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-gray-200">Regelentscheidung #{row.id}</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-200 text-xl leading-none">×</button>
        </div>
        <div className="space-y-0 text-sm">
          {fields.map(([label, value]) => (
            <div key={label} className="flex justify-between py-1.5 border-b border-gray-800 last:border-0">
              <span className="text-gray-500">{label}</span>
              <span className="font-mono text-xs text-gray-200">{value ?? '—'}</span>
            </div>
          ))}
        </div>
        <div className="pt-2">
          <StatusBadge
            status={row.decision_status === 'OK' ? 'ok' : row.decision_status === 'FAILSAFE' ? 'error' : 'warning'}
            label={row.reason}
          />
        </div>
      </div>
    </div>
  )
}

export default function OpsRules() {
  const [selected, setSelected] = useState<any>(null)

  const { data: latest }    = usePolling(api.latestDecision, 5000)
  const { data: historyRaw } = usePolling(() => api.controlDecisions(50), 5000)
  const history: any[] = historyRaw ?? []

  return (
    <div className="space-y-6">

      {selected && <DetailModal row={selected} onClose={() => setSelected(null)} />}

      <h1 className="text-xl font-semibold">Regelentscheidungen</h1>

      {/* Latest decision summary */}
      {latest && !latest.error && (
        <div
          className="bg-gray-900 rounded-xl p-5 border border-gray-800 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm cursor-pointer hover:border-gray-600 transition-colors"
          onClick={() => setSelected(latest)}
        >
          <div>
            <span className="text-gray-500 text-xs block mb-0.5">Letzter Zyklus</span>
            <span className="font-mono text-xs">{latest.timestamp_utc?.slice(11, 19)}</span>
          </div>
          <div>
            <span className="text-gray-500 text-xs block mb-0.5">B+ Verbrauch</span>
            <span className="text-green-400 font-bold">{Math.round(latest.bplus_power_w)} W</span>
          </div>
          <div>
            <span className="text-gray-500 text-xs block mb-0.5">Sollwert</span>
            <span className="font-bold text-blue-400">{Math.round(latest.sent_setpoint_w ?? 0)} W</span>
          </div>
          <div>
            <span className="text-gray-500 text-xs block mb-0.5">Status</span>
            <StatusBadge
              status={latest.decision_status === 'OK' ? 'ok' : latest.decision_status === 'FAILSAFE' ? 'error' : 'warning'}
              label={latest.decision_status}
            />
          </div>
          <div className="col-span-2 md:col-span-4">
            <span className="text-gray-500 text-xs">Grund: </span>
            <span className="font-mono text-xs text-gray-300">{latest.reason}</span>
          </div>
        </div>
      )}

      {/* History table */}
      <div className="overflow-x-auto rounded-xl border border-gray-800">
        <table className="w-full text-xs">
          <thead className="bg-gray-900 text-gray-500 uppercase">
            <tr>
              {['Zeit', 'B+ W', 'PV W', 'SOC %', 'Soll W', 'Ist W', 'Status', 'Grund'].map(h => (
                <th key={h} className="px-3 py-2 text-left font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(history as any[]).map(r => (
              <tr
                key={r.id}
                className="border-t border-gray-800 hover:bg-gray-900/80 cursor-pointer"
                onClick={() => setSelected(r)}
              >
                <td className="px-3 py-2 font-mono">{r.timestamp_utc?.slice(11, 19)}</td>
                <td className="px-3 py-2 text-green-400 font-medium">{Math.round(r.bplus_power_w)}</td>
                <td className="px-3 py-2 text-yellow-400">{Math.round(r.pv_power_w ?? 0)}</td>
                <td className="px-3 py-2">{r.battery_soc_percent?.toFixed(1) ?? '—'}</td>
                <td className="px-3 py-2 text-blue-400 font-medium">{Math.round(r.sent_setpoint_w ?? 0)}</td>
                <td className="px-3 py-2">{Math.round(r.actual_inverter_power_w ?? 0)}</td>
                <td className="px-3 py-2">
                  <span className={
                    r.decision_status === 'OK' ? 'text-green-400' :
                    r.decision_status === 'FAILSAFE' ? 'text-red-400' :
                    'text-yellow-400'
                  }>{r.decision_status}</span>
                </td>
                <td className="px-3 py-2 text-gray-500 font-mono max-w-[200px] truncate">{r.reason}</td>
              </tr>
            ))}
            {history.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-600">Sammle Daten…</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-gray-600">Klick auf eine Zeile öffnet das Regelentscheidungs-Detail.</p>
    </div>
  )
}
