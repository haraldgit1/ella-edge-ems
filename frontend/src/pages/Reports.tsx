import { useState } from 'react'
import { usePolling } from '../hooks/usePolling'
import { api } from '../api/client'
import { StatusBadge } from '../components/StatusBadge'

const PARTICIPANTS = [
  { id: 'part-01', name: 'Familie Müller (Top 1)' },
  { id: 'part-02', name: 'Hr. Schmidt (Top 2)' },
  { id: 'part-03', name: 'Fr. Berger (Top 3)' },
  { id: 'part-04', name: 'Familie Wagner (Top 4)' },
]

const REPORT_TYPES = [
  {
    type: 'RESIDENT_MONTHLY',
    label: 'Bewohner-Monatsreport',
    desc: 'Verbrauch, Strommix, Deckungsgrad und Kostenvorteil je Teilnehmer',
    fmt: 'PDF',
    needsParticipant: true,
  },
  {
    type: 'OPERATOR_MONTHLY',
    label: 'Betreiber-Monatsreport',
    desc: 'Energiebilanz, Teilnehmerübersicht, Plausibilität, Alarme',
    fmt: 'PDF',
    needsParticipant: false,
  },
  {
    type: 'CSV_DETAIL',
    label: '15-Min-Detailnachweis',
    desc: 'Alle Intervallzuordnungen aller B+ Teilnehmer als CSV-Tabelle',
    fmt: 'CSV',
    needsParticipant: false,
  },
  {
    type: 'DIAGNOSTICS',
    label: 'Diagnoseexport',
    desc: 'System-Info, Regelentscheidungen, Alarme, Settlement-Übersicht als ZIP',
    fmt: 'ZIP',
    needsParticipant: false,
  },
]

function fmtBadge(fmt: string) {
  if (fmt === 'PDF') return 'bg-red-900/30 text-red-400 border-red-800'
  if (fmt === 'CSV') return 'bg-green-900/30 text-green-400 border-green-800'
  if (fmt === 'ZIP') return 'bg-blue-900/30 text-blue-400 border-blue-800'
  return 'bg-gray-800 text-gray-400 border-gray-700'
}

function statusBadge(status: string): 'ok' | 'warning' | 'error' | 'offline' {
  if (status === 'COMPLETED') return 'ok'
  if (status === 'FAILED')    return 'error'
  if (status === 'PROCESSING') return 'warning'
  return 'offline'
}

function currentMonth() {
  return new Date().toISOString().slice(0, 7)
}

export default function Reports() {
  const [month, setMonth]         = useState(currentMonth())
  const [partId, setPartId]       = useState(PARTICIPANTS[0].id)
  const [includeDetail, setDetail] = useState(true)
  const [generating, setGen]      = useState<string | null>(null)
  const [genError, setGenError]   = useState<string | null>(null)

  const { data: reportsRaw } = usePolling(api.reports, 5000)
  const reports: any[] = reportsRaw ?? []

  async function generate(rtype: string) {
    setGen(rtype)
    setGenError(null)
    try {
      const body: any = { report_type: rtype, month }
      if (rtype === 'RESIDENT_MONTHLY') {
        body.participant_id = partId
        body.include_detail = includeDetail
      }
      const res = await api.reportGenerate(body)
      if (res.error) setGenError(res.error)
    } catch (e) {
      setGenError(e instanceof Error ? e.message : String(e))
    } finally {
      setGen(null)
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Reports & Exporte</h1>

      {/* Generate panel */}
      <div className="bg-gray-900 rounded-xl p-5 border border-gray-800 space-y-5">
        <p className="text-sm font-medium text-gray-300">Report anfordern</p>

        {/* Controls */}
        <div className="flex gap-4 flex-wrap">
          <div className="space-y-1">
            <label className="text-xs text-gray-500">Monat</label>
            <input
              type="month"
              value={month}
              onChange={e => setMonth(e.target.value)}
              className="block bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-gray-200 focus:outline-none focus:border-gray-500"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-gray-500">Teilnehmer (für Bewohnerreport)</label>
            <select
              value={partId}
              onChange={e => setPartId(e.target.value)}
              className="block bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-gray-200 focus:outline-none focus:border-gray-500"
            >
              {PARTICIPANTS.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
        </div>

        {genError && (
          <p className="text-sm text-red-400 bg-red-900/20 border border-red-800 rounded-lg px-3 py-2">{genError}</p>
        )}

        {/* Report type cards */}
        <div className="grid md:grid-cols-2 gap-3">
          {REPORT_TYPES.map(rt => (
            <div key={rt.type} className="bg-gray-800 rounded-xl p-4 border border-gray-700 flex flex-col gap-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium text-sm text-gray-200">{rt.label}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{rt.desc}</p>
                </div>
                <span className={`shrink-0 text-xs px-2 py-0.5 rounded border font-medium ${fmtBadge(rt.fmt)}`}>
                  {rt.fmt}
                </span>
              </div>
              {rt.type === 'RESIDENT_MONTHLY' && (
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={includeDetail}
                    onChange={e => setDetail(e.target.checked)}
                    className="w-4 h-4 rounded accent-green-500"
                  />
                  <span className="text-xs text-gray-400">15-Minuten-Detailnachweis einschließen</span>
                </label>
              )}
              <button
                onClick={() => generate(rt.type)}
                disabled={generating !== null}
                className="w-full py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-sm text-gray-200 disabled:opacity-50 transition-colors font-medium"
              >
                {generating === rt.type ? 'Wird erstellt…' : 'Erstellen'}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Reports list */}
      <div className="space-y-2">
        <p className="text-sm font-medium text-gray-400">Erstellte Reports</p>
        {reports.length === 0 ? (
          <p className="text-center py-8 text-gray-600 text-sm">Noch keine Reports erstellt.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-gray-800">
            <table className="w-full text-sm">
              <thead className="bg-gray-900 text-gray-500 text-xs uppercase">
                <tr>
                  {['Typ', 'Format', 'Zeitraum', 'Teilnehmer', 'Status', 'Erstellt', 'Download'].map(h => (
                    <th key={h} className="px-4 py-2 text-left">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {reports.map((r: any) => (
                  <tr key={r.id} className="border-t border-gray-800 hover:bg-gray-900/50">
                    <td className="px-4 py-2.5 font-medium text-xs">{r.report_type}</td>
                    <td className="px-4 py-2.5">
                      <span className={`text-xs px-1.5 py-0.5 rounded border ${fmtBadge(r.file_format ?? 'PDF')}`}>
                        {r.file_format ?? '?'}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-gray-400 font-mono">
                      {r.period_from?.slice(0, 7) ?? '—'}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-gray-400">
                      {r.participant_name ?? '—'}
                    </td>
                    <td className="px-4 py-2.5">
                      <StatusBadge
                        status={statusBadge(r.status)}
                        label={r.status}
                      />
                    </td>
                    <td className="px-4 py-2.5 text-xs text-gray-500 font-mono">
                      {r.created_at?.slice(0, 16).replace('T', ' ') ?? '—'}
                    </td>
                    <td className="px-4 py-2.5">
                      {r.status === 'COMPLETED' ? (
                        <a
                          href={api.reportDownloadUrl(r.id)}
                          download
                          className="text-xs px-3 py-1 rounded-lg bg-green-900/30 text-green-400 border border-green-800 hover:bg-green-900/50 transition-colors"
                        >
                          Download
                        </a>
                      ) : r.status === 'PENDING' || r.status === 'PROCESSING' ? (
                        <span className="text-xs text-gray-500 animate-pulse">Wird erstellt…</span>
                      ) : (
                        <span className="text-xs text-red-400">Fehler</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
