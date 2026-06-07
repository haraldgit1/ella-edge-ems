import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis,
  Tooltip, Legend, CartesianGrid,
} from 'recharts'
import { usePolling } from '../hooks/usePolling'
import { api } from '../api/client'
import { Tile } from '../components/Tile'
import { StatusBadge } from '../components/StatusBadge'

function formatTime(ts: string) {
  return ts?.slice(11, 16) ?? ''
}

export default function DashboardOperator() {
  const { data, error } = usePolling(api.dashboardOperator, 5000)

  if (error) return (
    <div className="text-red-400 bg-red-900/20 rounded-xl p-4 border border-red-800">
      API nicht erreichbar: {error}
    </div>
  )

  const ps = data?.power_state
  const dec = data?.latest_decision
  const today = data?.today
  const history = (data?.power_history ?? []).map((r: any) => ({
    t: formatTime(r.timestamp_utc),
    'B+': Math.round(r.bplus_power_w),
    'B-': Math.round(r.bminus_power_w),
    'PV': Math.round(r.pv_power_w ?? 0),
  }))

  const simMode = ps !== null

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Betreiber-Dashboard</h1>
        <div className="flex items-center gap-3">
          {simMode && <StatusBadge status="sim" label="Simulationsmodus" />}
          <StatusBadge status={ps ? 'ok' : 'offline'} label={ps ? 'System OK' : 'Keine Daten'} />
          <span className="text-xs text-gray-600">
            {data?.timestamp ? new Date(data.timestamp).toLocaleTimeString('de-AT') : '—'}
          </span>
        </div>
      </div>

      {/* Live Tiles */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Tile
          label="B+ Verbrauch"
          value={ps ? Math.round(ps.bplus_power_w) : null}
          unit="W"
          color="text-green-400"
          sub={today ? `heute: ${today.bplus_kwh} kWh` : undefined}
        />
        <Tile
          label="PV-Leistung"
          value={ps ? Math.round(ps.pv_power_w ?? 0) : null}
          unit="W"
          color="text-yellow-400"
        />
        <Tile
          label="Batterie SOC"
          value={ps ? Math.round(ps.battery_soc_pct ?? 0) : null}
          unit="%"
          color={
            (ps?.battery_soc_pct ?? 100) < 20 ? 'text-red-400' :
            (ps?.battery_soc_pct ?? 100) < 40 ? 'text-yellow-400' :
            'text-blue-400'
          }
        />
        <Tile
          label="Lokaler Deckungsgrad"
          value={today ? today.avg_coverage_pct : null}
          unit="%"
          color="text-green-400"
          sub={today ? `lokal: ${today.local_kwh} kWh` : undefined}
        />
        <Tile
          label="B- Verbrauch"
          value={ps ? Math.round(ps.bminus_power_w) : null}
          unit="W"
          color="text-gray-400"
        />
        <Tile
          label="Sollwert gesendet"
          value={dec ? Math.round(dec.sent_setpoint_w ?? 0) : null}
          unit="W"
          color="text-blue-400"
        />
        <Tile
          label="Gültige Zähler"
          value={ps ? `${ps.valid_meter_count}/${ps.valid_meter_count + ps.invalid_meter_count}` : null}
          color={ps?.invalid_meter_count > 0 ? 'text-yellow-400' : 'text-green-400'}
        />
        <Tile
          label="Aktive Alarme"
          value={data?.active_alarms ?? null}
          color={data?.active_alarms > 0 ? 'text-red-400' : 'text-green-400'}
        />
      </div>

      {/* Letzte Regelentscheidung */}
      {dec && (
        <div className="bg-gray-900 rounded-xl p-4 border border-gray-800 flex flex-wrap gap-6 text-sm">
          <div>
            <span className="text-gray-500 text-xs block">Letzte Regelentscheidung</span>
            <span className="font-mono text-xs text-gray-300">{dec.timestamp_utc?.slice(0, 19).replace('T', ' ')}</span>
          </div>
          <div>
            <span className="text-gray-500 text-xs block">Status</span>
            <StatusBadge
              status={dec.decision_status === 'OK' ? 'ok' : dec.decision_status === 'FAILSAFE' ? 'error' : 'warning'}
              label={dec.decision_status}
            />
          </div>
          <div>
            <span className="text-gray-500 text-xs block">Grund</span>
            <span className="font-mono text-xs text-gray-300">{dec.reason}</span>
          </div>
          <div>
            <span className="text-gray-500 text-xs block">Istwert WR</span>
            <span className="font-semibold">{Math.round(dec.actual_inverter_power_w ?? 0)} W</span>
          </div>
        </div>
      )}

      {/* Power History Chart */}
      <div className="bg-gray-900 rounded-xl p-5 border border-gray-800">
        <p className="text-sm text-gray-400 mb-4">Leistungsverlauf — letzte 30 Minuten</p>
        {history.length < 2 ? (
          <p className="text-gray-600 text-sm text-center py-8">Sammle Daten… (noch {Math.max(0, 2 - history.length)} Messpunkte)</p>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={history} margin={{ top: 0, right: 10, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis
                dataKey="t"
                tick={{ fill: '#6b7280', fontSize: 11 }}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fill: '#6b7280', fontSize: 11 }}
                unit="W"
                width={55}
              />
              <Tooltip
                contentStyle={{ background: '#111827', border: '1px solid #374151', borderRadius: 8 }}
                labelStyle={{ color: '#9ca3af' }}
                formatter={(v: number) => [`${v} W`]}
              />
              <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
              <Line type="monotone" dataKey="B+" stroke="#22c55e" dot={false} strokeWidth={2} />
              <Line type="monotone" dataKey="PV" stroke="#facc15" dot={false} strokeWidth={2} />
              <Line type="monotone" dataKey="B-" stroke="#6b7280" dot={false} strokeWidth={1.5} strokeDasharray="4 2" />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

    </div>
  )
}
