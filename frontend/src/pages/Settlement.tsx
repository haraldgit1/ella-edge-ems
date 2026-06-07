import { useState } from 'react'
import { usePolling } from '../hooks/usePolling'
import { api } from '../api/client'
import { EnergyMixBar } from '../components/EnergyMixBar'
import { StatusBadge } from '../components/StatusBadge'
import { Tile } from '../components/Tile'

function monthLabel(m: string) {
  const [y, mo] = m.split('-')
  return new Date(Number(y), Number(mo) - 1).toLocaleDateString('de-AT', { month: 'long', year: 'numeric' })
}

function currentMonth() {
  return new Date().toISOString().slice(0, 7)
}

function prevMonth(m: string) {
  const [y, mo] = m.split('-').map(Number)
  return mo === 1 ? `${y - 1}-12` : `${y}-${String(mo - 1).padStart(2, '0')}`
}

function nextMonth(m: string) {
  const [y, mo] = m.split('-').map(Number)
  if (`${y}-${String(mo).padStart(2, '0')}` >= currentMonth()) return m
  return mo === 12 ? `${y + 1}-01` : `${y}-${String(mo + 1).padStart(2, '0')}`
}

function plausStyle(status: string) {
  if (status === 'OK')      return 'text-green-400'
  if (status === 'WARNING') return 'text-yellow-400'
  if (status === 'FAILED')  return 'text-red-400'
  return 'text-gray-500'
}

function plausBadge(status: string): 'ok' | 'warning' | 'error' | 'offline' {
  if (status === 'OK')      return 'ok'
  if (status === 'WARNING') return 'warning'
  if (status === 'FAILED')  return 'error'
  return 'offline'
}

export default function Settlement() {
  const [month, setMonth] = useState(currentMonth())
  const [approving, setApproving] = useState(false)
  const [approveMsg, setApproveMsg] = useState<string | null>(null)
  const [showAll, setShowAll] = useState(false)

  const { data: summary, error: sumErr } = usePolling(
    () => api.settlementSummary(month), 30000
  )
  const { data: plaus, error: plausErr } = usePolling(
    () => api.settlementPlausibility(month), 30000
  )
  const { data: intervalsRaw } = usePolling(
    () => api.settlementIntervals(month), 30000
  )
  const intervals: any[] = intervalsRaw ?? []

  const error = sumErr || plausErr

  async function handleApprove() {
    if (!summary?.can_approve) return
    setApproving(true)
    setApproveMsg(null)
    try {
      const res = await api.settlementApprove(month)
      setApproveMsg(res.error ?? `${res.approved_count} Intervalle freigegeben.`)
    } catch (e) {
      setApproveMsg('Fehler bei der Freigabe.')
    } finally {
      setApproving(false)
    }
  }

  if (error) return (
    <div className="text-red-400 bg-red-900/20 rounded-xl p-4 border border-red-800">
      Fehler: {error}
    </div>
  )

  const tot = summary?.totals
  const displayed = showAll ? intervals : intervals.slice(0, 48)

  return (
    <div className="space-y-6">

      {/* Header + Month Nav */}
      <div className="flex items-center gap-4 flex-wrap">
        <h1 className="text-xl font-semibold">15-Minuten-Settlement</h1>
        <div className="flex items-center gap-2 ml-auto">
          <button
            onClick={() => { setMonth(m => prevMonth(m)); setApproveMsg(null) }}
            className="px-2 py-1 rounded-lg border border-gray-700 text-gray-400 hover:text-white hover:border-gray-500 transition-colors"
          >←</button>
          <span className="text-sm font-medium text-gray-200 min-w-36 text-center">
            {monthLabel(month)}
          </span>
          <button
            onClick={() => { setMonth(m => nextMonth(m)); setApproveMsg(null) }}
            disabled={month >= currentMonth()}
            className="px-2 py-1 rounded-lg border border-gray-700 text-gray-400 hover:text-white hover:border-gray-500 transition-colors disabled:opacity-30"
          >→</button>
        </div>
      </div>

      {/* Summary Tiles */}
      {tot && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Tile label="Intervalle gesettled" value={tot.interval_count} color="text-white"
                sub={`${tot.approved_count} freigegeben`} />
          <Tile label="B+ Verbrauch" value={tot.bplus_kwh} unit="kWh" color="text-green-400" />
          <Tile label="Lokaler Strom" value={tot.local_kwh} unit="kWh" color="text-green-400"
                sub={`${tot.avg_coverage_pct}% Deckungsgrad`} />
          <Tile label="Netzstrom" value={tot.grid_kwh} unit="kWh" color="text-gray-300" />
        </div>
      )}

      {/* Energy Mix */}
      {tot && tot.interval_count > 0 && (
        <div className="bg-gray-900 rounded-xl p-5 border border-gray-800 space-y-3">
          <p className="text-sm text-gray-400">Strommix {monthLabel(month)}</p>
          <EnergyMixBar localPct={tot.avg_coverage_pct} />
        </div>
      )}

      {/* Plausibility + Approve */}
      {plaus && (
        <div className="bg-gray-900 rounded-xl p-5 border border-gray-800 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-gray-300">Plausibilitätsprüfung</span>
              <StatusBadge
                status={plausBadge(plaus.overall_status)}
                label={plaus.overall_status}
              />
            </div>
            {summary?.can_approve && (
              <button
                onClick={handleApprove}
                disabled={approving}
                className="px-4 py-2 rounded-lg bg-green-700 hover:bg-green-600 text-white text-sm font-medium disabled:opacity-50 transition-colors"
              >
                {approving ? 'Wird freigegeben…' : `${monthLabel(month)} freigeben`}
              </button>
            )}
            {!summary?.can_approve && tot && tot.interval_count > 0 && tot.approved_count === tot.interval_count && (
              <StatusBadge status="ok" label="Vollständig freigegeben" />
            )}
          </div>

          {approveMsg && (
            <p className="text-sm text-green-400">{approveMsg}</p>
          )}

          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
            {[
              ['Erwartet', plaus.checks.intervals_expected, 'text-gray-400'],
              ['Vorhanden', plaus.checks.intervals_found, 'text-white'],
              ['Fehlend', plaus.checks.intervals_missing, plaus.checks.intervals_missing > 0 ? 'text-red-400' : 'text-green-400'],
              ['OK', plaus.checks.ok, 'text-green-400'],
              ['Warnungen', plaus.checks.warnings, plaus.checks.warnings > 0 ? 'text-yellow-400' : 'text-gray-500'],
            ].map(([label, value, color]) => (
              <div key={label as string} className="bg-gray-800 rounded-lg p-3 text-center">
                <p className="text-xs text-gray-500 mb-1">{label}</p>
                <p className={`text-xl font-bold ${color}`}>{value}</p>
              </div>
            ))}
          </div>

          {plaus.issues?.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs text-gray-500 uppercase">Probleme</p>
              {plaus.issues.map((i: any, idx: number) => (
                <div key={idx} className="text-xs font-mono text-yellow-300 bg-yellow-900/10 border border-yellow-900/30 rounded px-3 py-1.5">
                  {i.interval_start_utc?.slice(0, 16).replace('T', ' ')} — {i.plausibility_status}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Per-participant table */}
      {summary?.participants?.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-gray-400">Teilnehmer-Übersicht {monthLabel(month)}</p>
          <div className="overflow-x-auto rounded-xl border border-gray-800">
            <table className="w-full text-sm">
              <thead className="bg-gray-900 text-gray-500 text-xs uppercase">
                <tr>
                  {['Teilnehmer', 'Status', 'Verbrauch', 'Lokal', 'Netz', 'Deckung'].map(h => (
                    <th key={h} className="px-4 py-2 text-left">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {summary.participants.map((p: any) => (
                  <tr key={p.id} className="border-t border-gray-800 hover:bg-gray-900/50">
                    <td className="px-4 py-2.5 font-medium">{p.display_name}</td>
                    <td className="px-4 py-2.5">
                      <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                        p.status === 'BPLUS' ? 'bg-green-900/30 text-green-400' : 'bg-gray-800 text-gray-500'
                      }`}>{p.status === 'BPLUS' ? 'B+' : 'B−'}</span>
                    </td>
                    <td className="px-4 py-2.5 font-mono">{p.consumption_kwh} kWh</td>
                    <td className="px-4 py-2.5 font-mono text-green-400">{p.local_kwh} kWh</td>
                    <td className="px-4 py-2.5 font-mono text-gray-400">{p.grid_kwh} kWh</td>
                    <td className="px-4 py-2.5">
                      {p.status === 'BPLUS' ? (
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-2 rounded-full bg-gray-700 overflow-hidden">
                            <div className="h-full bg-green-500" style={{ width: `${p.coverage_pct}%` }} />
                          </div>
                          <span className="text-xs text-gray-300">{p.coverage_pct}%</span>
                        </div>
                      ) : <span className="text-xs text-gray-600">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Intervals list */}
      {intervals.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-400">
              15-Min-Intervalle ({intervals.length} gesettled)
            </p>
            <button
              onClick={() => setShowAll(v => !v)}
              className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
            >
              {showAll ? 'Weniger anzeigen' : `Alle ${intervals.length} anzeigen`}
            </button>
          </div>
          <div className="overflow-x-auto rounded-xl border border-gray-800">
            <table className="w-full text-xs">
              <thead className="bg-gray-900 text-gray-500 uppercase">
                <tr>
                  {['Start', 'B+ Wh', 'Lokal Wh', 'Faktor', 'Status', 'Plausibilität'].map(h => (
                    <th key={h} className="px-3 py-2 text-left">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {displayed.map((r: any) => (
                  <tr key={r.id} className="border-t border-gray-800 hover:bg-gray-900/50">
                    <td className="px-3 py-2 font-mono">{r.interval_start_utc?.slice(0, 16).replace('T', ' ')}</td>
                    <td className="px-3 py-2 text-green-400">{r.bplus_consumption_wh?.toFixed(1)}</td>
                    <td className="px-3 py-2">{r.local_energy_available_wh?.toFixed(1)}</td>
                    <td className="px-3 py-2">{(r.local_allocation_factor * 100).toFixed(1)}%</td>
                    <td className="px-3 py-2">
                      <span className={r.settlement_status === 'APPROVED' ? 'text-green-400' : 'text-gray-400'}>
                        {r.settlement_status}
                      </span>
                    </td>
                    <td className={`px-3 py-2 font-medium ${plausStyle(r.plausibility_status)}`}>
                      {r.plausibility_status}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {intervals.length === 0 && (
        <div className="text-center py-12 text-gray-600">
          Noch keine Intervalle für {monthLabel(month)}.
          Der Settlement-Worker schließt alle 60 Sekunden abgelaufene Viertelstunden.
        </div>
      )}

    </div>
  )
}
