import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { api } from '../../api/client'

interface LogEntry {
  id: number
  received_at: string
  cid: string | null
  pact_str: string | null
  ldt: string | null
  meter_id: string | null
  status: 'OK' | 'ERROR'
  error_msg: string | null
  source_ip: string | null
}

export default function MdmSmartmeterLog() {
  const [searchParams] = useSearchParams()
  const [cid,      setCid]      = useState(searchParams.get('cid') ?? '')
  const [status,   setStatus]   = useState('ALL')
  const [from,     setFrom]     = useState('')
  const [to,       setTo]       = useState('')
  const [limit,    setLimit]    = useState('200')
  const [list,     setList]     = useState<LogEntry[]>([])
  const [selected, setSelected] = useState<LogEntry | null>(null)
  const [form,     setForm]     = useState<LogEntry | null>(null)
  const [dirty,    setDirty]    = useState(false)
  const [saving,   setSaving]   = useState(false)
  const [msg,      setMsg]      = useState<{ text: string; ok: boolean } | null>(null)

  const loadList = useCallback(() => {
    const params: Record<string, string> = { limit }
    if (cid)    params.cid    = cid
    if (status !== 'ALL') params.status = status
    if (from)   params.from   = from
    if (to)     params.to     = to
    api.mdmSmartmeterLog('?' + new URLSearchParams(params).toString())
      .then(setList).catch(() => {})
  }, [cid, status, from, to, limit])

  useEffect(() => { loadList() }, [loadList])

  function flash(text: string, ok: boolean) {
    setMsg({ text, ok })
    setTimeout(() => setMsg(null), 3000)
  }

  function selectRow(e: LogEntry) {
    setSelected(e); setForm({ ...e }); setDirty(false)
  }

  async function handleSave() {
    if (!form) return
    setSaving(true)
    try {
      await api.mdmSmartmeterLogUpdate(form.id, {
        cid: form.cid, pact_str: form.pact_str, ldt: form.ldt,
        meter_id: form.meter_id, status: form.status,
        error_msg: form.error_msg, source_ip: form.source_ip,
      })
      setSelected({ ...form }); setDirty(false)
      loadList(); flash('Gespeichert', true)
    } catch (e: any) {
      flash(`Fehler: ${e.message}`, false)
    } finally { setSaving(false) }
  }

  async function handleDelete() {
    if (!selected) return
    if (!confirm(`Log-Eintrag #${selected.id} löschen?`)) return
    try {
      await api.mdmSmartmeterLogDelete(selected.id)
      setSelected(null); setForm(null); setDirty(false)
      loadList(); flash('Gelöscht', true)
    } catch { flash('Löschen fehlgeschlagen', false) }
  }

  function upd(patch: Partial<LogEntry>) {
    setForm(prev => prev ? { ...prev, ...patch } : prev)
    setDirty(true)
  }

  function fmtTs(ts: string) {
    try { return new Date(ts).toLocaleString('de-AT', { dateStyle: 'short', timeStyle: 'medium' }) }
    catch { return ts }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-5rem)] gap-3">

      {msg && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-2 rounded-lg text-sm font-medium shadow-lg
          ${msg.ok ? 'bg-green-800 text-green-100' : 'bg-red-800 text-red-100'}`}>{msg.text}</div>
      )}

      <div className="flex flex-col lg:flex-row gap-3 flex-1 min-h-0">

        {/* Left: Filter + List */}
        <div className="flex flex-col gap-3 lg:w-96 shrink-0">

          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4 space-y-3">
            <h2 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Filter</h2>
            <div className="grid grid-cols-2 gap-2">
              <input type="text" placeholder="CID" value={cid} onChange={e => setCid(e.target.value)}
                className="bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-1.5 text-sm placeholder-gray-600 focus:outline-none focus:border-purple-600" />
              <select value={status} onChange={e => setStatus(e.target.value)}
                className="bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg px-2 py-1.5 text-xs text-gray-700 dark:text-gray-200 focus:outline-none">
                <option value="ALL">Alle Status</option>
                <option value="OK">OK</option>
                <option value="ERROR">Fehler</option>
              </select>
              <div>
                <label className="text-[10px] text-gray-500 dark:text-gray-600 block mb-0.5">Von</label>
                <input type="date" value={from} onChange={e => setFrom(e.target.value)}
                  className="w-full bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg px-2 py-1.5 text-xs text-gray-700 dark:text-gray-200 focus:outline-none" />
              </div>
              <div>
                <label className="text-[10px] text-gray-500 dark:text-gray-600 block mb-0.5">Bis</label>
                <input type="date" value={to} onChange={e => setTo(e.target.value)}
                  className="w-full bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg px-2 py-1.5 text-xs text-gray-700 dark:text-gray-200 focus:outline-none" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-500">Max. Einträge</label>
              <select value={limit} onChange={e => setLimit(e.target.value)}
                className="bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg px-2 py-1 text-xs text-gray-700 dark:text-gray-200 focus:outline-none">
                {['50', '100', '200', '500'].map(n => <option key={n} value={n}>{n}</option>)}
              </select>
              <button onClick={loadList}
                className="ml-auto px-3 py-1 text-xs rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-300 dark:border-gray-700 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
                Aktualisieren
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-auto bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 min-h-0">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
                <tr>
                  <th className="text-left px-3 py-2 text-gray-500 font-medium">Zeit</th>
                  <th className="text-left px-2 py-2 text-gray-500 font-medium">CID</th>
                  <th className="px-2 py-2 text-gray-500 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {list.length === 0 && (
                  <tr><td colSpan={3} className="text-center text-gray-500 dark:text-gray-600 py-6">Keine Einträge</td></tr>
                )}
                {list.map(e => (
                  <tr key={e.id} onClick={() => selectRow(e)}
                    className={`cursor-pointer border-b border-gray-800/50 transition-colors ${
                      selected?.id === e.id ? 'bg-purple-900/20' : 'hover:bg-gray-800/50'
                    }`}>
                    <td className="px-3 py-2 font-mono text-[10px] text-gray-500 dark:text-gray-400 whitespace-nowrap">
                      {fmtTs(e.received_at)}
                    </td>
                    <td className="px-2 py-2 text-gray-600 dark:text-gray-300 font-mono">{e.cid ?? '—'}</td>
                    <td className="px-2 py-2 text-center">
                      {e.status === 'OK'
                        ? <span className="text-green-600 dark:text-green-400">✓</span>
                        : <span className="text-red-600 dark:text-red-400 font-bold">✗</span>
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right: Detail */}
        <div className="flex-1 min-w-0 overflow-auto bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5">

          <div className="flex items-center gap-2 mb-5 flex-wrap">
            <span className="text-sm font-semibold text-gray-600 dark:text-gray-300 mr-2">
              {selected ? `Eintrag #${selected.id}` : 'Kein Eintrag gewählt'}
            </span>
            <div className="flex gap-2 ml-auto">
              <button onClick={handleDelete} disabled={!selected}
                className="px-3 py-1.5 text-xs rounded-lg bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 hover:bg-red-900/50 disabled:opacity-40 transition-colors">
                Löschen
              </button>
              <button onClick={handleSave} disabled={!dirty || saving}
                className="px-3 py-1.5 text-xs rounded-lg bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 border border-green-300 dark:border-green-700 hover:bg-green-100 dark:hover:bg-green-900/60 disabled:opacity-40 transition-colors font-medium">
                {saving ? 'Speichere …' : 'Speichern'}
              </button>
            </div>
          </div>

          {!form ? (
            <p className="text-gray-500 dark:text-gray-600 text-sm text-center mt-16">Eintrag aus der Liste wählen</p>
          ) : (
            <div className="space-y-6">

              {/* Readonly fields */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 p-4 bg-gray-200/40 dark:bg-gray-800/40 rounded-xl">
                <div>
                  <div className="text-[10px] text-gray-500 uppercase tracking-wide mb-1">Empfangen</div>
                  <div className="text-sm font-mono text-gray-600 dark:text-gray-300">{fmtTs(form.received_at)}</div>
                </div>
                <div>
                  <div className="text-[10px] text-gray-500 uppercase tracking-wide mb-1">Quell-IP</div>
                  <div className="text-sm font-mono text-gray-600 dark:text-gray-300">{form.source_ip ?? '—'}</div>
                </div>
                <div>
                  <div className="text-[10px] text-gray-500 uppercase tracking-wide mb-1">Status</div>
                  <span className={`text-sm font-bold ${form.status === 'OK' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                    {form.status}
                  </span>
                </div>
              </div>

              {/* Editable fields */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-4">
                  <h3 className="text-xs font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-widest border-b border-gray-200 dark:border-gray-800 pb-2">Push-Daten</h3>
                  <div className="space-y-1">
                    <label className="text-xs text-gray-500 font-medium uppercase tracking-wide">CID</label>
                    <input value={form.cid ?? ''} onChange={e => upd({ cid: e.target.value || null })}
                      className="w-full bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-1.5 text-sm text-gray-800 dark:text-gray-100 focus:outline-none focus:border-purple-600" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-gray-500 font-medium uppercase tracking-wide">Pact (roher Wert)</label>
                    <input value={form.pact_str ?? ''} onChange={e => upd({ pact_str: e.target.value || null })}
                      className="w-full bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-1.5 text-sm font-mono text-gray-800 dark:text-gray-100 focus:outline-none focus:border-purple-600" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-gray-500 font-medium uppercase tracking-wide">LDT (Zeitstempel Gerät)</label>
                    <input value={form.ldt ?? ''} onChange={e => upd({ ldt: e.target.value || null })}
                      className="w-full bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-1.5 text-sm font-mono text-gray-800 dark:text-gray-100 focus:outline-none focus:border-purple-600" />
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-widest border-b border-gray-200 dark:border-gray-800 pb-2">Auflösung + Fehler</h3>
                  <div className="space-y-1">
                    <label className="text-xs text-gray-500 font-medium uppercase tracking-wide">Meter-ID (aufgelöst)</label>
                    <input value={form.meter_id ?? ''} onChange={e => upd({ meter_id: e.target.value || null })}
                      className="w-full bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-1.5 text-sm font-mono text-gray-800 dark:text-gray-100 focus:outline-none focus:border-purple-600" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-gray-500 font-medium uppercase tracking-wide">Status</label>
                    <select value={form.status} onChange={e => upd({ status: e.target.value as 'OK' | 'ERROR' })}
                      className="w-full bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-1.5 text-sm text-gray-800 dark:text-gray-100 focus:outline-none focus:border-purple-600">
                      <option value="OK">OK</option>
                      <option value="ERROR">ERROR</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-gray-500 font-medium uppercase tracking-wide">Fehlermeldung</label>
                    <textarea value={form.error_msg ?? ''} onChange={e => upd({ error_msg: e.target.value || null })}
                      rows={4}
                      className="w-full bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-1.5 text-sm text-gray-800 dark:text-gray-100 focus:outline-none focus:border-purple-600 resize-none" />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
