import { useState, useCallback, useEffect } from 'react'
import {
  ResponsiveContainer, ComposedChart, Line, Bar,
  XAxis, YAxis, Tooltip, Legend, CartesianGrid,
} from 'recharts'
import { useChartTheme } from '../ThemeContext'
import { usePolling } from '../hooks/usePolling'
import { api } from '../api/client'
import { Tile } from '../components/Tile'
import { StatusBadge } from '../components/StatusBadge'

const RANGES = [
  { s:    300, label: '5 min'  },
  { s:    900, label: '15 min' },
  { s:   1800, label: '30 min' },
  { s:   3600, label: '1 Std'  },
  { s:  10800, label: '3 Std'  },
  { s:  21600, label: '6 Std'  },
  { s:  86400, label: '24 Std' },
]

import { utcToDate } from '../utils/time'

function fmtTick(ts: string, rangeS: number): string {
  if (!ts) return ''
  const d = utcToDate(ts)
  const H = String(d.getHours()).padStart(2, '0')
  const M = String(d.getMinutes()).padStart(2, '0')
  const S = String(d.getSeconds()).padStart(2, '0')
  if (rangeS >= 86400) return `${String(d.getDate()).padStart(2, '0')}. ${H}:${M}`
  if (rangeS >= 3600)  return `${H}:${M}`
  return `${H}:${M}:${S}`
}

interface PartOption { id: string; name: string; meter_id: string }

export default function DashboardOperator() {
  const [rangeS, setRangeS] = useState(1800)
  const ct = useChartTheme()

  // Participant overlay — meter_id passed directly to dashboard API so timestamps align
  const [parts,   setParts]   = useState<PartOption[]>([])
  const [selId,   setSelId]   = useState('')   // meter_id of selected participant
  const [selName, setSelName] = useState('')

  const fetcher = useCallback(() => api.dashboardOperator(rangeS, selId), [rangeS, selId])
  const { data, error } = usePolling(fetcher, 5000)

  useEffect(() => {
    api.mdmParticipants('?active=1&status=BPLUS').then((list: any[]) => {
      const opts: PartOption[] = list
        .filter(p => p.meter_id)
        .map(p => ({ id: p.id, name: p.display_name, meter_id: p.meter_id }))
      setParts(opts)
    }).catch(() => {})
  }, [])

  if (error) return (
    <div className="text-red-600 dark:text-red-400 bg-red-900/20 rounded-xl p-4 border border-red-200 dark:border-red-800">
      API nicht erreichbar: {error}
    </div>
  )

  function batStatus(ps: any, dec: any): { label: string; color: string } {
    const soc    = ps?.battery_soc_pct ?? 0
    const pv     = ps?.pv_power_w ?? 0
    const bp     = ps?.bplus_power_w ?? 0
    const reason = dec?.reason ?? ''

    const fmtW = (w: number) => w >= 1000 ? `${(w / 1000).toFixed(2)} kW` : `${Math.round(w)} W`

    // Derive battery flow from power balance: positive surplus → charge, deficit → discharge
    const chargeW    = Math.min(Math.max(0, pv - bp), 5000)
    const dischargeW = Math.min(Math.max(0, bp - pv), 5000)

    if (soc <= 20 || reason === 'LIMITED_BY_BATTERY_SOC')
      return { label: 'Entladen gesperrt', color: 'text-red-600 dark:text-red-400' }
    if (soc >= 100)
      return { label: 'Voll  –  0 W', color: 'text-green-600 dark:text-green-400' }
    if (chargeW > 50)
      return { label: `↑ Laden  ${fmtW(chargeW)}`, color: 'text-green-600 dark:text-green-400' }
    if (dischargeW > 50)
      return { label: `↓ Entladen  ${fmtW(dischargeW)}`, color: 'text-blue-700 dark:text-blue-300' }
    return { label: 'Standby  –  0 W', color: 'text-gray-500' }
  }

  const ps      = data?.power_state
  const dec     = data?.latest_decision
  const today   = data?.today
  const bucketS = data?.bucket_s ?? Math.round(rangeS / 120)
  // Grid export: PV surplus beyond B+ demand, minus battery charging (battery fills first)
  const pvSurplusW  = ps ? Math.max(0, (ps.pv_power_w ?? 0) - ps.bplus_power_w) : 0
  const batChargeW  = (ps?.battery_soc_pct ?? 100) < 100 ? Math.min(pvSurplusW, 5000) : 0
  const gridExportW = Math.max(0, Math.round(pvSurplusW - batChargeW))

  const history = (data?.power_history ?? []).map((r: any) => {
    const pt: any = {
      t:     fmtTick(r.timestamp_utc, rangeS),
      raw:   r.timestamp_utc,
      'B+':  Math.round(r.bplus_power_w   ?? 0),
      'B-':  Math.round(r.bminus_power_w  ?? 0),
      'PV':  Math.round(r.pv_power_w      ?? 0),
      'Netz': Math.round(r.grid_import_w  ?? 0),
      'SOC': r.battery_soc_pct != null ? Math.round(r.battery_soc_pct) : null,
    }
    if (selId) {
      pt['Teil'] = r.overlay_w ?? null
    }
    return pt
  })

  const simMode = ps !== null

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Betreiber-Dashboard</h1>
        <div className="flex items-center gap-3">
          {simMode && <StatusBadge status="sim" label="Simulationsmodus" />}
          <StatusBadge status={ps ? 'ok' : 'offline'} label={ps ? 'System OK' : 'Keine Daten'} />
          <span className="text-xs text-gray-500 dark:text-gray-600">
            {data?.timestamp ? new Date(data.timestamp).toLocaleTimeString('de-AT') : '—'}
          </span>
        </div>
      </div>

      {/* Live Tiles */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Tile
          label="B+ und H+ Verbrauch"
          value={ps ? Math.round(ps.bplus_power_w) : null}
          unit="W"
          color="text-green-600 dark:text-green-400"
          sub={today ? `heute: ${today.bplus_kwh} kWh` : undefined}
        />
        <Tile
          label="PV-Leistung"
          value={ps ? Math.round(ps.pv_power_w ?? 0) : null}
          unit="W"
          color="text-yellow-600 dark:text-yellow-400"
        />
        <Tile
          label="Batterie SOC"
          value={ps ? Math.round(ps.battery_soc_pct ?? 0) : null}
          unit="%"
          color={
            (ps?.battery_soc_pct ?? 100) < 20 ? 'text-red-600 dark:text-red-400' :
            (ps?.battery_soc_pct ?? 100) < 40 ? 'text-yellow-600 dark:text-yellow-400' :
            'text-blue-600 dark:text-blue-400'
          }
          sub={ps ? batStatus(ps, dec).label : undefined}
          subColor={ps ? batStatus(ps, dec).color : undefined}
        />
        <Tile
          label="Lokaler Deckungsgrad"
          value={today ? today.avg_coverage_pct : null}
          unit="%"
          color="text-green-600 dark:text-green-400"
          sub={today ? `lokal: ${today.local_kwh} kWh` : undefined}
        />
        <Tile
          label="Netz-Einspeisung PV"
          value={gridExportW > 0 ? gridExportW : ps ? 0 : null}
          unit="W"
          color={gridExportW > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-gray-500'}
          sub={gridExportW > 0 ? 'PV-Überschuss → Netz' : 'keine Einspeisung'}
        />
        <Tile
          label="B- und H- Verbrauch"
          value={ps ? Math.round(ps.bminus_power_w) : null}
          unit="W"
          color="text-gray-500 dark:text-gray-400"
        />
        <Tile
          label="Sollwert gesendet"
          value={dec ? Math.round(dec.sent_setpoint_w ?? 0) : null}
          unit="W"
          color="text-blue-600 dark:text-blue-400"
        />
        <Tile
          label="Gültige Zähler"
          value={ps ? `${ps.valid_meter_count}/${ps.valid_meter_count + ps.invalid_meter_count}` : null}
          color={ps?.invalid_meter_count > 0 ? 'text-yellow-600 dark:text-yellow-400' : 'text-green-600 dark:text-green-400'}
        />
        <Tile
          label="Aktive Alarme"
          value={data?.active_alarms ?? null}
          color={data?.active_alarms > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}
        />
      </div>

      {/* Letzte Regelentscheidung */}
      {dec && (
        <div className="bg-white dark:bg-gray-900 rounded-xl p-4 border border-gray-200 dark:border-gray-800 flex flex-wrap gap-6 text-sm">
          <div>
            <span className="text-gray-500 text-xs block">Letzte Regelentscheidung</span>
            <span className="font-mono text-xs text-gray-600 dark:text-gray-300">{dec.timestamp_utc ? utcToDate(dec.timestamp_utc).toLocaleString('de-AT') : '—'}</span>
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
            <span className="font-mono text-xs text-gray-600 dark:text-gray-300">{dec.reason}</span>
          </div>
          <div>
            <span className="text-gray-500 text-xs block">Istwert WR</span>
            <span className="font-semibold">{Math.round(dec.actual_inverter_power_w ?? 0)} W</span>
          </div>
        </div>
      )}

      {/* Power History Chart */}
      <div className="bg-white dark:bg-gray-900 rounded-xl p-5 border border-gray-200 dark:border-gray-800 space-y-4">
        {/* Header with range selector */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Leistungsverlauf</p>
            <p className="text-[11px] text-gray-500 dark:text-gray-600 mt-0.5">
              {history.length} Punkte · Ø {bucketS < 60 ? `${bucketS}s` : `${Math.round(bucketS/60)} min`} / Punkt
            </p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            {/* Participant overlay selector */}
            {parts.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-gray-500 whitespace-nowrap">Teilnehmer-Linie:</span>
                <select
                  value={selId}
                  onChange={e => {
                    const opt = parts.find(p => p.meter_id === e.target.value)
                    setSelId(e.target.value)
                    setSelName(opt?.name ?? '')
                  }}
                  className="bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg px-2 py-1 text-xs text-gray-700 dark:text-gray-200 focus:outline-none focus:border-green-400 dark:focus:border-green-700"
                >
                  <option value="">— keine —</option>
                  {parts.map(p => (
                    <option key={p.meter_id} value={p.meter_id}>{p.name}</option>
                  ))}
                </select>
              </div>
            )}
            <div className="flex gap-1">
              {RANGES.map(r => (
                <button
                  key={r.s}
                  onClick={() => setRangeS(r.s)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${
                    rangeS === r.s
                      ? 'bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-400 border-green-300 dark:border-green-700'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-500 border-gray-300 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-500 hover:text-gray-300'
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {history.length < 2 ? (
          <p className="text-gray-500 dark:text-gray-600 text-sm text-center py-8">
            Keine Daten für diesen Zeitraum.
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <ComposedChart data={history} margin={{ top: 4, right: 50, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={ct.gridLine} />
              <XAxis
                dataKey="t"
                tick={{ fill: ct.tick, fontSize: 10 }}
                interval="preserveStartEnd"
                minTickGap={50}
              />
              {/* Left Y-axis: power in W */}
              <YAxis
                yAxisId="w"
                orientation="left"
                tick={{ fill: ct.tick, fontSize: 10 }}
                unit=" W"
                width={58}
                tickFormatter={(v: number) => v >= 1000 ? `${(v/1000).toFixed(1)}k` : String(v)}
              />
              {/* Right Y-axis: SOC in % */}
              <YAxis
                yAxisId="soc"
                orientation="right"
                domain={[0, 100]}
                tick={{ fill: ct.tickBlue, fontSize: 10 }}
                unit=" %"
                width={36}
              />
              <Tooltip
                contentStyle={{ background: ct.tooltipBg, border: `1px solid ${ct.tooltipBorder}`, borderRadius: 8, fontSize: 12 }}
                labelStyle={{ color: ct.tooltipText, marginBottom: 4 }}
                formatter={(v: number, name: string) => {
                  if (name === 'SOC')  return [`${v} %`, 'Batterie SOC']
                  if (name === 'Teil') return [`${v} W`, selName]
                  return [`${v} W`, name]
                }}
              />
              <Legend
                wrapperStyle={{ color: ct.legendText, fontSize: 11, paddingTop: 8 }}
                formatter={(value) =>
                  value === 'SOC'  ? 'Batterie SOC (%)' :
                  value === 'Netz' ? 'Netz-Bezug' :
                  value === 'Teil' ? selName :
                  value
                }
              />
              <Line yAxisId="w"   type="monotone" dataKey="B+"   stroke="#22c55e" dot={false} strokeWidth={2} />
              <Line yAxisId="w"   type="monotone" dataKey="PV"   stroke="#facc15" dot={false} strokeWidth={2} />
              <Line yAxisId="w"   type="monotone" dataKey="Netz" stroke="#ef4444" dot={false} strokeWidth={2} />
              <Line yAxisId="w"   type="monotone" dataKey="B-"   stroke="#6b7280" dot={false} strokeWidth={1.5} strokeDasharray="4 2" />
              <Line yAxisId="soc" type="monotone" dataKey="SOC"  stroke="#3b82f6" dot={false} strokeWidth={1.5} strokeDasharray="2 3" connectNulls />
              {selId && (
                <Line yAxisId="w" type="monotone" dataKey="Teil"
                  stroke="#4ade80" dot={false} strokeWidth={2}
                  strokeDasharray="8 4" connectNulls />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>

    </div>
  )
}
