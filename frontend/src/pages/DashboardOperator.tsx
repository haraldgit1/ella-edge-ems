import { useEffect, useState } from 'react'
import { api } from '../api/client'

function Tile({ label, value, unit, color = 'text-white' }: {
  label: string; value: string | number | null; unit?: string; color?: string
}) {
  return (
    <div className="bg-gray-900 rounded-xl p-5 border border-gray-800">
      <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">{label}</p>
      <p className={`text-2xl font-bold ${color}`}>
        {value ?? '—'}{unit && <span className="text-sm font-normal text-gray-400 ml-1">{unit}</span>}
      </p>
    </div>
  )
}

export default function DashboardOperator() {
  const [data, setData] = useState<any>(null)
  const [health, setHealth] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([api.dashboard(), api.health()])
      .then(([d, h]) => { setData(d); setHealth(h) })
      .catch(e => setError(e.message))
  }, [])

  if (error) return (
    <div className="text-red-400 bg-red-900/20 rounded-xl p-4 border border-red-800">
      API nicht erreichbar: {error}
    </div>
  )

  const ps = data?.power_state

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Betreiber-Dashboard</h1>
        {health && (
          <span className={`text-xs px-3 py-1 rounded-full font-medium ${
            health.simulation_mode
              ? 'bg-orange-900/40 text-orange-400 border border-orange-800'
              : 'bg-green-900/40 text-ella-green border border-green-800'
          }`}>
            {health.simulation_mode ? 'Simulationsmodus' : 'Live'} · v{health.version}
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Tile label="B+ Verbrauch" value={ps ? Math.round(ps.bplus_power_w) : null} unit="W" color="text-ella-green" />
        <Tile label="B- Verbrauch" value={ps ? Math.round(ps.bminus_power_w) : null} unit="W" />
        <Tile label="PV-Leistung" value={ps ? Math.round(ps.pv_power_w ?? 0) : null} unit="W" color="text-yellow-400" />
        <Tile label="Batterie SOC" value={ps ? Math.round(ps.battery_soc_pct ?? 0) : null} unit="%" color="text-ella-blue" />
        <Tile label="Gültige Zähler" value={ps?.valid_meter_count ?? null} color="text-ella-green" />
        <Tile label="Fehler-Zähler" value={ps?.invalid_meter_count ?? null} color={ps?.invalid_meter_count > 0 ? 'text-red-400' : 'text-gray-400'} />
        <Tile label="Aktive Alarme" value={data?.active_alarms ?? null} color={data?.active_alarms > 0 ? 'text-red-400' : 'text-ella-green'} />
        <Tile label="Systemstatus" value={health?.status === 'ok' ? 'OK' : 'Fehler'} color={health?.status === 'ok' ? 'text-ella-green' : 'text-red-400'} />
      </div>
    </div>
  )
}
