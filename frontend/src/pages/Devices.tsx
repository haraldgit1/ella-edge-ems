import { usePolling } from '../hooks/usePolling'
import { api } from '../api/client'
import { StatusBadge } from '../components/StatusBadge'

function SocBar({ pct }: { pct: number }) {
  const p = Math.max(0, Math.min(100, pct))
  const color = p < 20 ? 'bg-red-500' : p < 40 ? 'bg-yellow-500' : 'bg-blue-500'
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-gray-500">
        <span>SOC</span><span className="font-medium text-white">{p.toFixed(1)}%</span>
      </div>
      <div className="h-3 rounded-full bg-gray-700 overflow-hidden">
        <div className={`h-full ${color} transition-all duration-700`} style={{ width: `${p}%` }} />
      </div>
    </div>
  )
}

function PowerBar({ w, maxW, color = 'bg-green-500' }: { w: number; maxW: number; color?: string }) {
  const pct = maxW > 0 ? Math.min(100, (w / maxW) * 100) : 0
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-gray-500">
        <span>Leistung</span>
        <span className="font-medium text-white">{w >= 1000 ? `${(w/1000).toFixed(2)} kW` : `${Math.round(w)} W`}</span>
      </div>
      <div className="h-2 rounded-full bg-gray-700 overflow-hidden">
        <div className={`h-full ${color} transition-all duration-700`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

function DeviceCard({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <div className="bg-gray-900 rounded-xl p-5 border border-gray-800 space-y-4">
      <div className="flex items-center gap-2">
        <span className="text-lg">{icon}</span>
        <h2 className="font-semibold text-gray-200">{title}</h2>
      </div>
      {children}
    </div>
  )
}

function Row({ label, value, mono = false }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex justify-between items-center text-sm py-1 border-b border-gray-800 last:border-0">
      <span className="text-gray-500">{label}</span>
      <span className={`text-gray-200 ${mono ? 'font-mono text-xs' : 'font-medium'}`}>{value}</span>
    </div>
  )
}

export default function Devices() {
  const { data, error } = usePolling(api.dashboardDevices, 5000)

  if (error) return (
    <div className="text-red-400 bg-red-900/20 rounded-xl p-4 border border-red-800">
      Fehler: {error}
    </div>
  )

  const inv = data?.inverter
  const bat = data?.battery
  const pv  = data?.pv
  const hp  = data?.heatpump

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Geräte</h1>

      <div className="grid md:grid-cols-2 gap-6">

        {/* Wechselrichter */}
        <DeviceCard title="Wechselrichter" icon="⚡">
          <div className="flex items-center gap-2">
            <StatusBadge status={inv?.online ? 'ok' : 'offline'} label={inv?.online ? 'Online' : 'Offline'} />
            {inv?.protocol && <StatusBadge status="sim" label={inv.protocol} />}
          </div>
          <div className="space-y-0">
            <Row label="Bezeichnung"      value={inv?.name ?? '—'} />
            <Row label="Aktuelle Leistung" value={inv?.current_power_w != null ? `${Math.round(inv.current_power_w)} W` : '—'} />
            <Row label="Letzter Sollwert"  value={inv?.last_setpoint_w != null ? `${Math.round(inv.last_setpoint_w)} W` : '—'} />
            <Row label="Max. Leistung"     value={inv?.max_power_w != null ? `${inv.max_power_w / 1000} kW` : '—'} />
            <Row label="Letzter Grund"     value={inv?.last_decision_reason ?? '—'} mono />
            <Row label="Letzter Kontakt"   value={inv?.last_seen?.slice(0, 19).replace('T', ' ') ?? '—'} mono />
          </div>
        </DeviceCard>

        {/* Batterie */}
        <DeviceCard title="Batteriespeicher" icon="🔋">
          <div className="flex items-center gap-2">
            <StatusBadge
              status={bat?.online ? (bat?.soc_pct < 20 ? 'warning' : 'ok') : 'offline'}
              label={bat?.online ? (bat?.soc_pct < 20 ? 'SOC niedrig' : 'Online') : 'Offline'}
            />
            {bat?.protocol && <StatusBadge status="sim" label={bat.protocol} />}
          </div>
          {bat?.soc_pct != null && <SocBar pct={bat.soc_pct} />}
          <div className="space-y-0">
            <Row label="Bezeichnung"    value={bat?.name ?? '—'} />
            <Row label="Max. Leistung"  value={bat?.max_power_w != null ? `${bat.max_power_w / 1000} kW` : '—'} />
            <Row label="Letzter Kontakt" value={bat?.last_seen?.slice(0, 19).replace('T', ' ') ?? '—'} mono />
          </div>
        </DeviceCard>

        {/* PV-Anlage */}
        <DeviceCard title="PV-Anlage" icon="☀️">
          <div className="flex items-center gap-2">
            <StatusBadge status={pv?.online ? 'ok' : 'offline'} label={pv?.online ? 'Online' : 'Offline'} />
            {pv?.protocol && <StatusBadge status="sim" label={pv.protocol} />}
          </div>
          {pv?.current_power_w != null && pv?.max_power_w != null && (
            <PowerBar w={pv.current_power_w} maxW={pv.max_power_w} color="bg-yellow-400" />
          )}
          <div className="space-y-0">
            <Row label="Bezeichnung"       value={pv?.name ?? '—'} />
            <Row label="Aktuelle Erzeugung" value={pv?.current_power_w != null ? `${Math.round(pv.current_power_w)} W` : '—'} />
            <Row label="Peak-Leistung"     value={pv?.max_power_w != null ? `${pv.max_power_w / 1000} kWp` : '—'} />
            <Row label="Letzter Kontakt"   value={pv?.last_seen?.slice(0, 19).replace('T', ' ') ?? '—'} mono />
          </div>
        </DeviceCard>

        {/* Wärmepumpe H+ */}
        <DeviceCard title="Wärmepumpe H+" icon="🌡️">
          <div className="flex items-center gap-2">
            <StatusBadge status={hp?.online ? 'ok' : 'offline'} label={hp?.online ? 'Online' : 'Offline'} />
            {hp?.protocol && <StatusBadge status="sim" label={hp.protocol} />}
          </div>
          {hp?.current_power_w != null && hp?.max_power_w != null && (
            <PowerBar w={hp.current_power_w} maxW={hp.max_power_w} color="bg-teal-400" />
          )}
          <div className="space-y-0">
            <Row label="Bezeichnung"      value={hp?.name ?? '—'} />
            <Row label="Aktuelle Leistung" value={hp?.current_power_w != null ? `${Math.round(hp.current_power_w)} W` : '—'} />
            <Row label="Max. Leistung"    value={hp?.max_power_w != null ? `${hp.max_power_w / 1000} kW` : '—'} />
            <Row label="Letzter Kontakt"  value={hp?.last_seen?.slice(0, 19).replace('T', ' ') ?? '—'} mono />
          </div>
        </DeviceCard>

      </div>
    </div>
  )
}
