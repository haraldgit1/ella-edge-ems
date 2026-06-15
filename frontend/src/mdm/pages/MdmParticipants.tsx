import { useState, useEffect, useCallback } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { api } from '../../api/client'

// ── Types ──────────────────────────────────────────────────────────────────────

interface Participant {
  id: string
  display_name: string
  participant_status: 'BPLUS' | 'BMINUS'
  valid_from: string
  valid_to: string | null
  is_active: number
  tariff_id: string | null
  apartment_id: string | null
  unit_label: string | null
  floor: number | null
  meter_id: string | null
  serial_number: string | null
  cid: string | null
  max_load_w: number
  push_interval_s: number
  push_timeout_s: number
  protocol: string
}

const EMPTY: Omit<Participant, 'id' | 'apartment_id' | 'meter_id'> = {
  display_name: '',
  participant_status: 'BPLUS',
  valid_from: new Date().toISOString().slice(0, 10),
  valid_to: null,
  is_active: 1,
  tariff_id: 'tariff-demo-01',
  unit_label: '',
  floor: 0,
  serial_number: '',
  cid: '',
  max_load_w: 4000,
  push_interval_s: 10,
  push_timeout_s: 60,
  protocol: 'SIMULATION',
}

// ── Helper Components ──────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-xs text-gray-500 font-medium uppercase tracking-wide">{label}</label>
      {children}
    </div>
  )
}

function Input({ value, onChange, type = 'text', placeholder = '', disabled = false }: {
  value: string | number | null
  onChange: (v: string) => void
  type?: string
  placeholder?: string
  disabled?: boolean
}) {
  return (
    <input
      type={type}
      value={value ?? ''}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-gray-100
                 placeholder-gray-600 focus:outline-none focus:border-purple-600
                 disabled:opacity-50 disabled:cursor-not-allowed"
    />
  )
}

function Select({ value, onChange, options, disabled = false }: {
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
  disabled?: boolean
}) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      disabled={disabled}
      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-gray-100
                 focus:outline-none focus:border-purple-600
                 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function MdmParticipants() {
  const [searchParams] = useSearchParams()
  const navigate       = useNavigate()
  const viewId         = searchParams.get('view')   // read-only mode when set
  const viewOnly       = !!viewId

  const [search,   setSearch]   = useState('')
  const [status,   setStatus]   = useState('ALL')
  const [active,   setActive]   = useState('1')
  const [list,     setList]     = useState<Participant[]>([])
  const [selected, setSelected] = useState<Participant | null>(null)
  const [form,     setForm]     = useState<Participant | null>(null)
  const [isNew,    setIsNew]    = useState(false)
  const [dirty,    setDirty]    = useState(false)
  const [saving,   setSaving]   = useState(false)
  const [msg,      setMsg]      = useState<{ text: string; ok: boolean } | null>(null)

  const loadList = useCallback(() => {
    const qs = new URLSearchParams({ search, status, active }).toString()
    api.mdmParticipants(`?${qs}`).then(setList).catch(() => {})
  }, [search, status, active])

  useEffect(() => { loadList() }, [loadList])

  // Auto-select participant when ?view=<id> is in URL
  useEffect(() => {
    if (!viewId) return
    api.mdmParticipant(viewId).then(p => {
      setSelected(p); setForm({ ...p }); setIsNew(false); setDirty(false)
    }).catch(() => {})
  }, [viewId])

  function flash(text: string, ok: boolean) {
    setMsg({ text, ok })
    setTimeout(() => setMsg(null), 3000)
  }

  function selectRow(p: Participant) {
    setSelected(p)
    setForm({ ...p })
    setIsNew(false)
    setDirty(false)
  }

  function handleNew() {
    setSelected(null)
    setForm({ id: '', apartment_id: null, meter_id: null, ...EMPTY })
    setIsNew(true)
    setDirty(true)
  }

  function handleCopy() {
    if (!selected) return
    setForm({ ...selected, id: '', apartment_id: null, meter_id: null,
              display_name: `${selected.display_name} (Kopie)` })
    setSelected(null)
    setIsNew(true)
    setDirty(true)
  }

  async function handleDelete() {
    if (!selected) return
    if (!confirm(`Teilnehmer "${selected.display_name}" löschen (deaktivieren)?`)) return
    try {
      await api.mdmParticipantDelete(selected.id)
      setSelected(null); setForm(null); setDirty(false)
      loadList()
      flash('Teilnehmer deaktiviert', true)
    } catch {
      flash('Löschen fehlgeschlagen', false)
    }
  }

  async function handleSave() {
    if (!form) return
    setSaving(true)
    try {
      if (isNew) {
        const res = await api.mdmParticipantCreate(form)
        const fresh = await api.mdmParticipant(res.id)
        setSelected(fresh); setForm({ ...fresh }); setIsNew(false)
      } else {
        await api.mdmParticipantUpdate(form.id, form)
        const fresh = await api.mdmParticipant(form.id)
        setSelected(fresh); setForm({ ...fresh })
      }
      setDirty(false)
      loadList()
      flash('Gespeichert', true)
    } catch (e: any) {
      flash(`Fehler: ${e.message}`, false)
    } finally {
      setSaving(false)
    }
  }

  function updateForm(patch: Partial<Participant>) {
    if (viewOnly) return
    setForm(prev => prev ? { ...prev, ...patch } : prev)
    setDirty(true)
  }

  const statusBadge = (s: string) =>
    s === 'BPLUS'
      ? <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-green-900/40 text-green-400">B+</span>
      : <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-gray-800 text-gray-400">B–</span>

  return (
    <div className="flex flex-col h-[calc(100vh-5rem)] gap-3">

      {/* Toast */}
      {msg && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-2 rounded-lg text-sm font-medium shadow-lg
          ${msg.ok ? 'bg-green-800 text-green-100' : 'bg-red-800 text-red-100'}`}>
          {msg.text}
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-3 flex-1 min-h-0">

        {/* ── Left: Search + List (hidden in view-only mode) ──────────────── */}
        <div className={`flex flex-col gap-3 lg:w-80 shrink-0 ${viewOnly ? 'hidden' : ''}`}>

          {/* Search */}
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-4 space-y-3">
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Suche</h2>
            <input
              type="text"
              placeholder="Name, CID, Seriennummer …"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm
                         placeholder-gray-600 focus:outline-none focus:border-purple-600"
            />
            <div className="flex gap-2">
              <select value={status} onChange={e => setStatus(e.target.value)}
                className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-xs text-gray-200 focus:outline-none">
                <option value="ALL">Alle Status</option>
                <option value="BPLUS">B+ (Lokal)</option>
                <option value="BMINUS">B– (Netz)</option>
              </select>
              <select value={active} onChange={e => setActive(e.target.value)}
                className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-xs text-gray-200 focus:outline-none">
                <option value="1">Aktiv</option>
                <option value="0">Inaktiv</option>
                <option value="ALL">Alle</option>
              </select>
            </div>
          </div>

          {/* List */}
          <div className="flex-1 overflow-auto bg-gray-900 rounded-xl border border-gray-800 min-h-0">
            <div className="p-2 space-y-1">
              {list.length === 0 && (
                <p className="text-xs text-gray-600 p-4 text-center">Keine Treffer</p>
              )}
              {list.map(p => (
                <button
                  key={p.id}
                  onClick={() => selectRow(p)}
                  className={`w-full text-left rounded-lg px-3 py-2.5 transition-colors ${
                    selected?.id === p.id
                      ? 'bg-purple-900/30 border border-purple-700'
                      : 'hover:bg-gray-800 border border-transparent'
                  } ${!p.is_active ? 'opacity-50' : ''}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-gray-200 truncate">{p.display_name}</span>
                    {statusBadge(p.participant_status)}
                  </div>
                  <div className="text-[10px] text-gray-500 mt-0.5 font-mono">
                    {p.unit_label ?? '—'} · CID {p.cid ?? '—'}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── Right: Detail ──────────────────────────────────────────────── */}
        <div className="flex-1 min-w-0 overflow-auto bg-gray-900 rounded-xl border border-gray-800 p-5">

          {/* Action buttons */}
          <div className="flex items-center gap-2 mb-5 flex-wrap">
            <span className="text-sm font-semibold text-gray-300 mr-2">
              {isNew ? 'Neuanlage' : selected ? selected.display_name : 'Kein Datensatz gewählt'}
            </span>
            {viewOnly ? (
              <div className="flex items-center gap-3 ml-auto">
                <span className="text-xs text-amber-500 bg-amber-900/20 border border-amber-800 rounded-lg px-3 py-1.5">
                  Nur-Ansicht
                </span>
                <button
                  onClick={() => navigate('/operator/participants')}
                  className="px-3 py-1.5 text-xs rounded-lg bg-gray-800 text-gray-300 border border-gray-700 hover:bg-gray-700 transition-colors"
                >
                  ← Zurück zu Teilnehmer
                </button>
                <button
                  onClick={() => navigate(`/mdm/participants`)}
                  className="px-3 py-1.5 text-xs rounded-lg bg-purple-900/40 text-purple-300 border border-purple-700 hover:bg-purple-900/60 transition-colors"
                >
                  Bearbeiten im MDM
                </button>
              </div>
            ) : (
              <div className="flex gap-2 ml-auto">
                <button onClick={handleNew}
                  className="px-3 py-1.5 text-xs rounded-lg bg-purple-900/40 text-purple-300 border border-purple-700 hover:bg-purple-900/60 transition-colors">
                  Neuanlage
                </button>
                <button onClick={handleCopy} disabled={!selected}
                  className="px-3 py-1.5 text-xs rounded-lg bg-gray-800 text-gray-300 border border-gray-700 hover:bg-gray-700 disabled:opacity-40 transition-colors">
                  Kopieren
                </button>
                <button onClick={handleDelete} disabled={!selected || isNew}
                  className="px-3 py-1.5 text-xs rounded-lg bg-red-900/30 text-red-400 border border-red-800 hover:bg-red-900/50 disabled:opacity-40 transition-colors">
                  Löschen
                </button>
                <button onClick={handleSave} disabled={!dirty || saving}
                  className="px-3 py-1.5 text-xs rounded-lg bg-green-900/40 text-green-300 border border-green-700 hover:bg-green-900/60 disabled:opacity-40 transition-colors font-medium">
                  {saving ? 'Speichere …' : 'Speichern'}
                </button>
              </div>
            )}
          </div>

          {!form ? (
            <p className="text-gray-600 text-sm text-center mt-16">
              Datensatz aus der Liste wählen oder «Neuanlage» klicken
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

              {/* Teilnehmer */}
              <div className="space-y-4">
                <h3 className="text-xs font-semibold text-purple-400 uppercase tracking-widest border-b border-gray-800 pb-2">
                  Teilnehmer
                </h3>
                <Field label="Anzeigename *">
                  <Input value={form.display_name} onChange={v => updateForm({ display_name: v })} placeholder="z. B. Familie Müller (Top 1)" disabled={viewOnly} />
                </Field>
                <Field label="Status *">
                  <Select
                    value={form.participant_status}
                    onChange={v => updateForm({
                      participant_status: v as 'BPLUS' | 'BMINUS',
                      tariff_id: v === 'BPLUS' ? 'tariff-demo-01' : null,
                    })}
                    options={[
                      { value: 'BPLUS',  label: 'B+ — Lokal versorgt' },
                      { value: 'BMINUS', label: 'B– – Nur Netz' },
                    ]}
                    disabled={viewOnly}
                  />
                </Field>
                <Field label="Gültig ab *">
                  <Input type="date" value={form.valid_from} onChange={v => updateForm({ valid_from: v })} disabled={viewOnly} />
                </Field>
                <Field label="Gültig bis">
                  <Input type="date" value={form.valid_to ?? ''} onChange={v => updateForm({ valid_to: v || null })} disabled={viewOnly} />
                </Field>
                <Field label="Tarif-ID">
                  <Input value={form.tariff_id ?? ''} onChange={v => updateForm({ tariff_id: v || null })} placeholder="tariff-demo-01" disabled={viewOnly} />
                </Field>
                <Field label="Aktiv">
                  <Select
                    value={String(form.is_active)}
                    onChange={v => updateForm({ is_active: parseInt(v) })}
                    options={[{ value: '1', label: 'Ja' }, { value: '0', label: 'Nein (deaktiviert)' }]}
                    disabled={viewOnly}
                  />
                </Field>
                {!isNew && (
                  <Field label="ID (intern)">
                    <Input value={form.id} onChange={() => {}} disabled />
                  </Field>
                )}
              </div>

              {/* Wohnung + Zähler */}
              <div className="space-y-6">
                <div className="space-y-4">
                  <h3 className="text-xs font-semibold text-blue-400 uppercase tracking-widest border-b border-gray-800 pb-2">
                    Wohnung
                  </h3>
                  <Field label="Wohneinheit *">
                    <Input value={form.unit_label ?? ''} onChange={v => updateForm({ unit_label: v })} placeholder="z. B. Top 7" disabled={viewOnly} />
                  </Field>
                  <Field label="Etage">
                    <Input type="number" value={form.floor ?? 0} onChange={v => updateForm({ floor: parseInt(v) || 0 })} disabled={viewOnly} />
                  </Field>
                </div>

                <div className="space-y-4">
                  <h3 className="text-xs font-semibold text-amber-400 uppercase tracking-widest border-b border-gray-800 pb-2">
                    SmartMeter / Zähler
                  </h3>
                  <Field label="CID (Hardware-Kennung) *">
                    <Input value={form.cid ?? ''} onChange={v => updateForm({ cid: v || null })} placeholder="z. B. 1099" disabled={viewOnly} />
                  </Field>
                  <Field label="Seriennummer">
                    <Input value={form.serial_number ?? ''} onChange={v => updateForm({ serial_number: v || null })} placeholder="z. B. SIM-099" disabled={viewOnly} />
                  </Field>
                  <Field label="Max. Last (Simulation Schieberegler)">
                    <div className="flex items-center gap-2">
                      <Input type="number" value={form.max_load_w} onChange={v => updateForm({ max_load_w: parseFloat(v) || 4000 })} disabled={viewOnly} />
                      <span className="text-xs text-gray-500 shrink-0">W</span>
                    </div>
                    <p className="text-[10px] text-gray-600 mt-1">Obere Grenze des Leistungs-Schiebereglers in der Simulation</p>
                  </Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Push-Intervall">
                      <div className="flex items-center gap-2">
                        <Input type="number" value={form.push_interval_s} onChange={v => updateForm({ push_interval_s: parseInt(v) || 10 })} disabled={viewOnly} />
                        <span className="text-xs text-gray-500 shrink-0">s</span>
                      </div>
                      <p className="text-[10px] text-gray-600 mt-1">Normales Sendeintervall</p>
                    </Field>
                    <Field label="Timeout">
                      <div className="flex items-center gap-2">
                        <Input type="number" value={form.push_timeout_s} onChange={v => updateForm({ push_timeout_s: parseInt(v) || 60 })} disabled={viewOnly} />
                        <span className="text-xs text-gray-500 shrink-0">s</span>
                      </div>
                      <p className="text-[10px] text-gray-600 mt-1">Watchdog → 0W nach Pause</p>
                    </Field>
                  </div>
                  <Field label="Protokoll">
                    <Select
                      value={form.protocol}
                      onChange={v => updateForm({ protocol: v })}
                      options={[
                        { value: 'SIMULATION',  label: 'Simulation' },
                        { value: 'MODBUS_TCP',  label: 'Modbus TCP' },
                        { value: 'MODBUS_RTU',  label: 'Modbus RTU' },
                      ]}
                      disabled={viewOnly}
                    />
                  </Field>
                  {!isNew && (
                    <Field label="Zähler-ID (intern)">
                      <Input value={form.meter_id ?? ''} onChange={() => {}} disabled />
                    </Field>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
