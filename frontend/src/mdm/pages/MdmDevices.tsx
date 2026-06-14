import { useState, useEffect, useCallback } from 'react'
import { api } from '../../api/client'

interface Device {
  id: string
  site_id: string
  device_type: string
  name: string
  manufacturer: string | null
  model: string | null
  protocol: string
  max_power_w: number | null
  is_active: number
  serial_number: string | null
  firmware_version: string | null
  installed_at: string | null
  notes: string | null
}

const DEVICE_TYPES = [
  { value: 'ALL',        label: 'Alle Typen' },
  { value: 'INVERTER',   label: 'Wechselrichter' },
  { value: 'BATTERY',    label: 'Batterie' },
  { value: 'PV',         label: 'PV-Anlage' },
  { value: 'HEAT_PUMP',  label: 'Wärmepumpe' },
  { value: 'SMART_METER',label: 'SmartMeter' },
  { value: 'OTHER',      label: 'Sonstiges' },
]

const PROTOCOLS = [
  { value: 'SIMULATION', label: 'Simulation' },
  { value: 'MODBUS_TCP', label: 'Modbus TCP' },
  { value: 'MODBUS_RTU', label: 'Modbus RTU' },
]

const EMPTY: Omit<Device, 'id'> = {
  site_id: 'site-demo-01',
  device_type: 'INVERTER',
  name: '',
  manufacturer: null,
  model: null,
  protocol: 'SIMULATION',
  max_power_w: null,
  is_active: 1,
  serial_number: null,
  firmware_version: null,
  installed_at: null,
  notes: null,
}

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
  type?: string; placeholder?: string; disabled?: boolean
}) {
  return (
    <input type={type} value={value ?? ''} onChange={e => onChange(e.target.value)}
      placeholder={placeholder} disabled={disabled}
      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-gray-100
                 placeholder-gray-600 focus:outline-none focus:border-purple-600
                 disabled:opacity-50 disabled:cursor-not-allowed" />
  )
}

function Select({ value, onChange, options }: {
  value: string; onChange: (v: string) => void
  options: { value: string; label: string }[]
}) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)}
      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-gray-100
                 focus:outline-none focus:border-purple-600">
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  )
}

function deviceTypeBadge(t: string) {
  const colors: Record<string, string> = {
    INVERTER:    'bg-yellow-900/40 text-yellow-400',
    BATTERY:     'bg-blue-900/40 text-blue-400',
    PV:          'bg-green-900/40 text-green-400',
    HEAT_PUMP:   'bg-orange-900/40 text-orange-400',
    SMART_METER: 'bg-purple-900/40 text-purple-400',
  }
  const label: Record<string, string> = {
    INVERTER: 'WR', BATTERY: 'BAT', PV: 'PV', HEAT_PUMP: 'WP', SMART_METER: 'SM',
  }
  return (
    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${colors[t] ?? 'bg-gray-800 text-gray-400'}`}>
      {label[t] ?? t}
    </span>
  )
}

export default function MdmDevices() {
  const [search,     setSearch]     = useState('')
  const [typeFilter, setTypeFilter] = useState('ALL')
  const [list,       setList]       = useState<Device[]>([])
  const [selected,   setSelected]   = useState<Device | null>(null)
  const [form,       setForm]       = useState<Device | null>(null)
  const [isNew,      setIsNew]      = useState(false)
  const [dirty,      setDirty]      = useState(false)
  const [saving,     setSaving]     = useState(false)
  const [msg,        setMsg]        = useState<{ text: string; ok: boolean } | null>(null)

  const loadList = useCallback(() => {
    const qs = new URLSearchParams({ search, device_type: typeFilter }).toString()
    api.mdmDevices(`?${qs}`).then(setList).catch(() => {})
  }, [search, typeFilter])

  useEffect(() => { loadList() }, [loadList])

  function flash(text: string, ok: boolean) {
    setMsg({ text, ok })
    setTimeout(() => setMsg(null), 3000)
  }

  function selectRow(d: Device) {
    setSelected(d); setForm({ ...d }); setIsNew(false); setDirty(false)
  }

  function handleNew() {
    setSelected(null)
    setForm({ id: '', ...EMPTY })
    setIsNew(true); setDirty(true)
  }

  function handleCopy() {
    if (!selected) return
    setForm({ ...selected, id: '', name: `${selected.name} (Kopie)` })
    setSelected(null); setIsNew(true); setDirty(true)
  }

  async function handleDelete() {
    if (!selected) return
    if (!confirm(`Gerät "${selected.name}" löschen (deaktivieren)?`)) return
    try {
      await api.mdmDeviceDelete(selected.id)
      setSelected(null); setForm(null); setDirty(false)
      loadList(); flash('Gerät deaktiviert', true)
    } catch { flash('Löschen fehlgeschlagen', false) }
  }

  async function handleSave() {
    if (!form) return
    setSaving(true)
    try {
      if (isNew) {
        const res = await api.mdmDeviceCreate(form)
        const fresh = await api.mdmDevice(res.id)
        setSelected(fresh); setForm({ ...fresh }); setIsNew(false)
      } else {
        await api.mdmDeviceUpdate(form.id, form)
        const fresh = await api.mdmDevice(form.id)
        setSelected(fresh); setForm({ ...fresh })
      }
      setDirty(false); loadList(); flash('Gespeichert', true)
    } catch (e: any) {
      flash(`Fehler: ${e.message}`, false)
    } finally { setSaving(false) }
  }

  function upd(patch: Partial<Device>) {
    setForm(prev => prev ? { ...prev, ...patch } : prev)
    setDirty(true)
  }

  return (
    <div className="flex flex-col h-[calc(100vh-5rem)] gap-3">

      {msg && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-2 rounded-lg text-sm font-medium shadow-lg
          ${msg.ok ? 'bg-green-800 text-green-100' : 'bg-red-800 text-red-100'}`}>{msg.text}</div>
      )}

      <div className="flex flex-col lg:flex-row gap-3 flex-1 min-h-0">

        {/* Left */}
        <div className="flex flex-col gap-3 lg:w-72 shrink-0">
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-4 space-y-3">
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Suche</h2>
            <input type="text" placeholder="Name, Modell …" value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm
                         placeholder-gray-600 focus:outline-none focus:border-purple-600" />
            <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-xs text-gray-200 focus:outline-none">
              {DEVICE_TYPES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>

          <div className="flex-1 overflow-auto bg-gray-900 rounded-xl border border-gray-800 min-h-0">
            <div className="p-2 space-y-1">
              {list.length === 0 && <p className="text-xs text-gray-600 p-4 text-center">Keine Treffer</p>}
              {list.map(d => (
                <button key={d.id} onClick={() => selectRow(d)}
                  className={`w-full text-left rounded-lg px-3 py-2.5 transition-colors ${
                    selected?.id === d.id
                      ? 'bg-purple-900/30 border border-purple-700'
                      : 'hover:bg-gray-800 border border-transparent'
                  } ${!d.is_active ? 'opacity-50' : ''}`}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-gray-200 truncate">{d.name}</span>
                    {deviceTypeBadge(d.device_type)}
                  </div>
                  <div className="text-[10px] text-gray-500 mt-0.5 font-mono">
                    {d.manufacturer ?? '—'} {d.model ?? ''}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right: Detail */}
        <div className="flex-1 min-w-0 overflow-auto bg-gray-900 rounded-xl border border-gray-800 p-5">
          <div className="flex items-center gap-2 mb-5 flex-wrap">
            <span className="text-sm font-semibold text-gray-300 mr-2">
              {isNew ? 'Neuanlage' : selected ? selected.name : 'Kein Datensatz gewählt'}
            </span>
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
          </div>

          {!form ? (
            <p className="text-gray-600 text-sm text-center mt-16">
              Datensatz aus der Liste wählen oder «Neuanlage» klicken
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

              {/* Links: Grunddaten */}
              <div className="space-y-4">
                <h3 className="text-xs font-semibold text-purple-400 uppercase tracking-widest border-b border-gray-800 pb-2">Gerätestamm</h3>
                <Field label="Name *">
                  <Input value={form.name} onChange={v => upd({ name: v })} placeholder="z. B. Wechselrichter 1" />
                </Field>
                <Field label="Gerätetyp *">
                  <Select value={form.device_type} onChange={v => upd({ device_type: v })}
                    options={DEVICE_TYPES.filter(o => o.value !== 'ALL')} />
                </Field>
                <Field label="Hersteller">
                  <Input value={form.manufacturer ?? ''} onChange={v => upd({ manufacturer: v || null })} placeholder="z. B. Fronius" />
                </Field>
                <Field label="Modell">
                  <Input value={form.model ?? ''} onChange={v => upd({ model: v || null })} placeholder="z. B. Symo 10.0-3-M" />
                </Field>
                <Field label="Protokoll">
                  <Select value={form.protocol} onChange={v => upd({ protocol: v })} options={PROTOCOLS} />
                </Field>
                <Field label="Aktiv">
                  <Select value={String(form.is_active)} onChange={v => upd({ is_active: parseInt(v) })}
                    options={[{ value: '1', label: 'Ja' }, { value: '0', label: 'Nein' }]} />
                </Field>
              </div>

              {/* Rechts: Technische Daten */}
              <div className="space-y-4">
                <h3 className="text-xs font-semibold text-blue-400 uppercase tracking-widest border-b border-gray-800 pb-2">Technische Daten</h3>
                <Field label="Max. Leistung">
                  <div className="flex items-center gap-2">
                    <Input type="number" value={form.max_power_w ?? ''} onChange={v => upd({ max_power_w: v ? parseFloat(v) : null })} placeholder="z. B. 10000" />
                    <span className="text-xs text-gray-500 shrink-0">W</span>
                  </div>
                </Field>
                <Field label="Seriennummer">
                  <Input value={form.serial_number ?? ''} onChange={v => upd({ serial_number: v || null })} />
                </Field>
                <Field label="Firmware-Version">
                  <Input value={form.firmware_version ?? ''} onChange={v => upd({ firmware_version: v || null })} />
                </Field>
                <Field label="Installiert am">
                  <Input type="date" value={form.installed_at ?? ''} onChange={v => upd({ installed_at: v || null })} />
                </Field>
                <Field label="Notizen">
                  <textarea value={form.notes ?? ''} onChange={e => upd({ notes: e.target.value || null })}
                    rows={3}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-gray-100
                               placeholder-gray-600 focus:outline-none focus:border-purple-600 resize-none" />
                </Field>
                {!isNew && (
                  <Field label="ID (intern)">
                    <Input value={form.id} onChange={() => {}} disabled />
                  </Field>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
