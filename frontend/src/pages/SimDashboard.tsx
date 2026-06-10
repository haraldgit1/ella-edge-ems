import { useState, useEffect, useRef } from 'react'

// ── Constants ─────────────────────────────────────────────────────────────────

const BATTERY_SIM_CAP_WH = 500

const C_GREEN  = '#22c55e'
const C_YELLOW = '#facc15'
const C_BLUE   = '#3b82f6'
const C_AMBER  = '#f59e0b'  // battery warning, PV export arrow
const C_RED    = '#ef4444'  // grid / Netz
const C_TEAL   = '#14b8a6'  // H+ Wärmepumpe
const C_GRAY   = '#6b7280'
const C_DIM    = '#374151'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Meter {
  id: string
  name: string
  load_kw: number
  is_bplus: boolean
  ac_on?: boolean       // Klimaanlage: +1 kW
  wallbox_on?: boolean  // Wallbox E-Auto: +11 kW
}

interface Flow {
  pv_w: number
  pv_to_bplus_w: number
  pv_to_grid_w: number
  battery_charge_w: number
  battery_discharge_w: number
  grid_to_bplus_w: number
  grid_to_bminus_w: number
  grid_import_w: number
  grid_export_w: number
  bplus_demand_w: number
  bminus_demand_w: number
  local_supply_w: number
  local_coverage_pct: number
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtW(w: number): string {
  return w >= 1000 ? `${(w / 1000).toFixed(2)} kW` : `${Math.round(w)} W`
}

function effectiveKw(m: Meter): number {
  return m.load_kw + (m.ac_on ? 1 : 0) + (m.wallbox_on ? 11 : 0)
}

function computeFlow(pvKw: number, socPct: number, meters: Meter[]): Flow {
  const pvW           = pvKw * 1000
  const bplus         = meters.filter(m =>  m.is_bplus)
  const bminus        = meters.filter(m => !m.is_bplus)
  const bplusDemandW  = bplus.reduce((s, m)  => s + effectiveKw(m) * 1000, 0)
  const bminusDemandW = bminus.reduce((s, m) => s + effectiveKw(m) * 1000, 0)
  const dischargeAvailW = socPct > 20 ? 5000 : 0
  const chargeAvailW    = socPct < 100 ? 5000 : 0

  let pvToBplusW = 0, pvToGridW = 0, batChargeW = 0, batDischargeW = 0, gridToBplusW = 0

  if (pvW >= bplusDemandW) {
    pvToBplusW    = bplusDemandW
    const surplus = pvW - bplusDemandW
    batChargeW    = Math.min(surplus, chargeAvailW)
    pvToGridW     = Math.max(0, surplus - batChargeW)
  } else {
    pvToBplusW      = pvW
    const deficit   = bplusDemandW - pvW
    batDischargeW   = Math.min(deficit, dischargeAvailW)
    gridToBplusW    = deficit - batDischargeW
  }

  const localSupplyW = pvToBplusW + batDischargeW
  const localCovPct  = bplusDemandW > 0 ? (localSupplyW / bplusDemandW) * 100 : 100
  const gridImportW  = gridToBplusW + bminusDemandW

  return {
    pv_w:                pvW,
    pv_to_bplus_w:       pvToBplusW,
    pv_to_grid_w:        pvToGridW,
    battery_charge_w:    batChargeW,
    battery_discharge_w: batDischargeW,
    grid_to_bplus_w:     gridToBplusW,
    grid_to_bminus_w:    bminusDemandW,
    grid_import_w:       gridImportW,
    grid_export_w:       pvToGridW,
    bplus_demand_w:      bplusDemandW,
    bminus_demand_w:     bminusDemandW,
    local_supply_w:      localSupplyW,
    local_coverage_pct:  localCovPct,
  }
}

// ── SVG primitives ────────────────────────────────────────────────────────────

function tw(
  x: number, y: number, txt: string,
  size = 11, color = '#d1d5db',
  anchor: 'start' | 'middle' | 'end' = 'middle',
) {
  return (
    <text x={x} y={y} fontSize={size} fill={color} textAnchor={anchor} dominantBaseline="middle">
      {txt}
    </text>
  )
}

function DeviceBox({
  x, y, w, h, color, children,
}: { x: number; y: number; w: number; h: number; color: string; children: React.ReactNode }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={8} fill="#111827" stroke={color} strokeWidth={1.5} />
      {children}
    </g>
  )
}

function FlowArrow({
  x1, y1, x2, y2, power, color, reverse = false,
}: { x1: number; y1: number; x2: number; y2: number; power: number; color: string; reverse?: boolean }) {
  const cx = (x1 + x2) / 2
  const d  = `M ${x1} ${y1} C ${cx} ${y1} ${cx} ${y2} ${x2} ${y2}`
  const sw = Math.max(1.5, Math.min(7, power / 700))
  const active = power > 0
  const speed  = active ? Math.max(0.25, 3000 / (power + 100)) : 1

  return (
    <g>
      <path d={d} stroke={C_DIM} strokeWidth={sw + 3} fill="none" strokeLinecap="round" />
      <path
        d={d} stroke={color} strokeWidth={sw} fill="none"
        strokeLinecap="round" strokeDasharray="9 5"
        strokeDashoffset={reverse ? '0' : '9'}
        opacity={active ? 1 : 0.15}
        style={active ? { animation: `flowAnim ${speed.toFixed(2)}s linear infinite${reverse ? ' reverse' : ''}` } : {}}
      />
    </g>
  )
}

// ── Energy Flow Diagram ───────────────────────────────────────────────────────

function FlowDiagram({ flow: f, socPct, hplusKw }: {
  flow: Flow; socPct: number; hplusKw: number
}) {
  const batMode  = f.battery_charge_w > 0 ? 'charge' : f.battery_discharge_w > 0 ? 'discharge' : 'idle'
  const batPower = batMode === 'charge' ? f.battery_charge_w : f.battery_discharge_w

  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 p-3">
      <svg viewBox="0 0 580 320" className="w-full" style={{ maxHeight: 380 }}>
        <style>{`@keyframes flowAnim{from{stroke-dashoffset:13}to{stroke-dashoffset:0}}`}</style>

        {/* ── Source boxes (left) ── */}
        <DeviceBox x={10} y={10} w={115} h={60} color={C_YELLOW}>
          {tw(67, 28, '☀  Photovoltaik', 10, C_YELLOW)}
          {tw(67, 48, fmtW(f.pv_w), 13, '#f9fafb')}
        </DeviceBox>

        <DeviceBox x={10} y={112} w={115} h={62} color={C_BLUE}>
          {tw(67, 129, '⚡ Batterie', 10, C_BLUE)}
          {tw(67, 144, `SOC  ${socPct.toFixed(0)} %`, 11, '#f9fafb')}
          {tw(67, 160,
            batMode === 'idle' ? 'Standby'
              : `${batMode === 'charge' ? '↑ Laden' : '↓ Entladen'}  ${fmtW(batPower)}`,
            9, batMode === 'idle' ? C_GRAY : C_BLUE)}
        </DeviceBox>

        <DeviceBox x={10} y={212} w={115} h={62} color={C_RED}>
          {tw(67, 229, '⚡ Stromnetz', 10, C_RED)}
          {tw(67, 245,
            f.grid_import_w > 0 ? `↓ ${fmtW(f.grid_import_w)}`
              : f.grid_export_w > 0 ? `↑ ${fmtW(f.grid_export_w)}` : 'Standby',
            12, '#f9fafb')}
          {tw(67, 261,
            f.grid_import_w > 0 ? 'Import' : f.grid_export_w > 0 ? 'Export PV' : '',
            9, f.grid_export_w > 0 ? C_AMBER : C_RED)}
        </DeviceBox>

        {/* ── EMS box (center) ── */}
        <DeviceBox x={192} y={72} w={180} h={158} color={C_GREEN}>
          {tw(282, 96,  'ELLA EMS', 12, C_GREEN)}
          {tw(282, 113, '+ Wechselrichter', 9, C_GRAY)}
          <rect x={208} y={128} width={148} height={10} rx={5} fill="#1f2937" />
          <rect x={208} y={128}
            width={Math.round(148 * Math.min(1, f.local_coverage_pct / 100))}
            height={10} rx={5} fill={C_GREEN} />
          {tw(282, 151, `Deckungsgrad: ${f.local_coverage_pct.toFixed(1)} %`, 9, '#9ca3af')}
          {tw(282, 167, `B+/H+ Bedarf:  ${fmtW(f.bplus_demand_w)}`, 9, C_GRAY)}
          {tw(282, 183, `Lokal:  ${fmtW(f.local_supply_w)}`, 9, C_GREEN)}
          {tw(282, 199,
            f.pv_to_grid_w > 0
              ? `PV-Export:  ${fmtW(f.pv_to_grid_w)}`
              : `Netz-Zukauf:  ${fmtW(f.grid_to_bplus_w)}`,
            9, f.pv_to_grid_w > 0 ? C_AMBER : f.grid_to_bplus_w > 0 ? C_RED : C_GRAY)}
        </DeviceBox>

        {/* ── Output boxes (right) ── */}
        <DeviceBox x={428} y={12}  w={144} h={52} color={C_GREEN}>
          {tw(500, 30, 'B+  Lokal versorgt', 9, C_GREEN)}
          {tw(500, 48, fmtW(f.local_supply_w), 13, '#f9fafb')}
        </DeviceBox>

        <DeviceBox x={428} y={80}  w={144} h={52} color={f.grid_to_bplus_w > 0 ? C_RED : C_DIM}>
          {tw(500, 98,  'B+  Netz-Ergänzung', 9, f.grid_to_bplus_w > 0 ? C_RED : C_GRAY)}
          {tw(500, 116, fmtW(f.grid_to_bplus_w), 13, '#f9fafb')}
        </DeviceBox>

        <DeviceBox x={428} y={148} w={144} h={52} color={C_GRAY}>
          {tw(500, 166, 'B–  Netz-Versorgung', 9, C_GRAY)}
          {tw(500, 184, fmtW(f.bminus_demand_w), 13, '#f9fafb')}
        </DeviceBox>

        <DeviceBox x={428} y={216} w={144} h={52} color={hplusKw > 0 ? C_TEAL : C_DIM}>
          {tw(500, 234, '♨  H+ Wärmepumpe', 9, hplusKw > 0 ? C_TEAL : C_GRAY)}
          {tw(500, 252, fmtW(hplusKw * 1000), 13, '#f9fafb')}
        </DeviceBox>

        {/* ── Sources → EMS ── */}
        <FlowArrow x1={125} y1={40}  x2={192} y2={118} power={f.pv_w}                color={C_YELLOW} />
        <FlowArrow x1={125} y1={143} x2={192} y2={155} power={f.battery_discharge_w} color={C_BLUE}   />
        <FlowArrow x1={192} y1={168} x2={125} y2={156} power={f.battery_charge_w}    color={C_BLUE}   reverse />
        <FlowArrow x1={125} y1={237} x2={192} y2={180} power={f.grid_to_bplus_w}     color={C_RED}    />

        {/* ── EMS → Outputs ── */}
        <FlowArrow x1={372} y1={112} x2={428} y2={38}  power={f.local_supply_w}  color={C_GREEN} />
        <FlowArrow x1={372} y1={138} x2={428} y2={106} power={f.grid_to_bplus_w} color={C_RED}   />
        <FlowArrow x1={372} y1={163} x2={428} y2={174} power={f.bminus_demand_w} color={C_GRAY}  />
        <FlowArrow x1={372} y1={195} x2={428} y2={242} power={hplusKw * 1000}   color={C_TEAL}  />

        {/* PV surplus export: EMS → Stromnetz (orange = PV→grid AC path) */}
        {f.pv_to_grid_w > 0 && (
          <FlowArrow x1={192} y1={220} x2={125} y2={243} power={f.pv_to_grid_w} color={C_AMBER} reverse />
        )}
      </svg>
    </div>
  )
}

// ── Meter Card ────────────────────────────────────────────────────────────────

function MeterCard({
  meter, flowW, localW, onChange,
}: {
  meter: Meter
  flowW: number
  localW: number
  onChange: (m: Meter) => void
}) {
  const gridW  = Math.max(0, flowW - localW)
  const pct    = flowW > 0 ? localW / flowW : 0
  const extras = (meter.ac_on ? 1 : 0) + (meter.wallbox_on ? 11 : 0)

  return (
    <div className={`rounded-xl border p-3 space-y-2 ${
      meter.is_bplus ? 'border-green-800 bg-green-950/20' : 'border-gray-700 bg-gray-900'
    }`}>
      <div className="flex items-center justify-between gap-1">
        <span className="text-xs font-medium text-gray-200 truncate">{meter.name}</span>
        <button
          onClick={() => onChange({ ...meter, is_bplus: !meter.is_bplus })}
          title="B+ Teilnehmer umschalten"
          className={`shrink-0 text-[10px] px-1.5 py-0.5 rounded font-bold border transition-colors ${
            meter.is_bplus
              ? 'bg-green-900/40 text-green-400 border-green-700'
              : 'bg-gray-800 text-gray-500 border-gray-700 hover:border-gray-500'
          }`}
        >
          B+
        </button>
      </div>

      <div>
        <div className="flex justify-between text-[10px] text-gray-500 mb-1">
          <span>Grundlast</span>
          <span className="font-mono">
            {extras > 0
              ? <span className="text-white font-bold">{(meter.load_kw + extras).toFixed(2)} kW</span>
              : <span className="text-gray-300">{meter.load_kw.toFixed(2)} kW</span>
            }
          </span>
        </div>
        <input
          type="range" min={0} max={4} step={0.05}
          value={meter.load_kw}
          onChange={e => onChange({ ...meter, load_kw: parseFloat(e.target.value) })}
          className="w-full h-1.5 rounded-full accent-green-500 cursor-pointer"
        />
      </div>

      {/* AC + Wallbox checkboxes (B+ only) */}
      {meter.is_bplus && (
        <div className="space-y-1 pt-0.5">
          <label className="flex items-center gap-1.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={!!meter.ac_on}
              onChange={e => onChange({ ...meter, ac_on: e.target.checked })}
              className="w-3 h-3 accent-cyan-500"
            />
            <span className="text-[10px] text-cyan-400">❄ Klimaanlage  +1 kW</span>
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={!!meter.wallbox_on}
              onChange={e => onChange({ ...meter, wallbox_on: e.target.checked })}
              className="w-3 h-3 accent-purple-400"
            />
            <span className="text-[10px] text-purple-400">⚡ Wallbox  +11 kW</span>
          </label>
        </div>
      )}

      {meter.is_bplus ? (
        <>
          <div className="flex h-2 rounded-full overflow-hidden bg-gray-800">
            <div className="bg-green-500 transition-all duration-300" style={{ width: `${pct * 100}%` }} />
            <div className="bg-red-500 transition-all duration-300"   style={{ width: `${(1 - pct) * 100}%` }} />
          </div>
          <div className="flex justify-between text-[9px]">
            <span className="text-green-500">{fmtW(localW)} lokal</span>
            <span className="text-red-400">{fmtW(gridW)} Netz</span>
          </div>
        </>
      ) : (
        <div className="text-[10px] text-red-400">{fmtW(flowW)} vom Netz</div>
      )}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

const DEFAULT_METERS: Meter[] = [
  { id: 'm1', name: 'Familie Müller',  load_kw: 1.2, is_bplus: true  },
  { id: 'm2', name: 'Hr. Schmidt',     load_kw: 0.8, is_bplus: true  },
  { id: 'm3', name: 'Fr. Berger',      load_kw: 1.5, is_bplus: true  },
  { id: 'm4', name: 'Familie Wagner',  load_kw: 2.0, is_bplus: true  },
  { id: 'm5', name: 'Hr. Huber',       load_kw: 0.6, is_bplus: false },
  { id: 'm6', name: 'Fr. Novak',       load_kw: 1.0, is_bplus: false },
]

interface PushResult { ok: boolean; ts?: string; error?: string }

export default function SimDashboard() {
  const [pvKw,       setPvKw]       = useState(5.0)
  const [socPct,     setSocPct]     = useState(60.0)
  const [intervalS,  setIntervalS]  = useState(2)
  const [meters,     setMeters]     = useState<Meter[]>(DEFAULT_METERS)
  const [hplusUnits, setHplusUnits] = useState(0)
  const [tick,       setTick]       = useState(0)
  const [syncEms,    setSyncEms]    = useState(false)
  const [dbReady,    setDbReady]    = useState<boolean | null>(null)
  const [lastPush,   setLastPush]   = useState<PushResult | null>(null)

  const hplusKw = hplusUnits * 1.5

  // Include H+ (meter-07) as a B+ participant in flow calculation
  const allMeters: Meter[] = [
    ...meters,
    { id: 'm7', name: 'H+ Wärmepumpe', load_kw: hplusKw, is_bplus: true },
  ]
  const flow = computeFlow(pvKw, socPct, allMeters)

  // Refs so interval callbacks see current values without stale closures
  const pvKwRef    = useRef(pvKw)
  const metersRef  = useRef(meters)
  const socPctRef  = useRef(socPct)
  const hplusKwRef = useRef(hplusKw)
  useEffect(() => { pvKwRef.current    = pvKw    }, [pvKw])
  useEffect(() => { metersRef.current  = meters  }, [meters])
  useEffect(() => { socPctRef.current  = socPct  }, [socPct])
  useEffect(() => { hplusKwRef.current = hplusKw }, [hplusKw])

  // Check DB availability once on mount
  useEffect(() => {
    fetch('/sim/db_status').then(r => r.json())
      .then(d => setDbReady(d.available))
      .catch(() => setDbReady(false))
  }, [])

  // Animation tick + linear SOC evolution
  useEffect(() => {
    const id = window.setInterval(() => {
      setTick(t => t + 1)
      setSocPct(cur => {
        const mAll = [
          ...metersRef.current,
          { id: 'm7', name: 'H+', load_kw: hplusKwRef.current, is_bplus: true as const },
        ]
        const f = computeFlow(pvKwRef.current, cur, mAll)
        const deltaWh  = (f.battery_charge_w - f.battery_discharge_w) * intervalS / 3600
        const deltaSoc = deltaWh / BATTERY_SIM_CAP_WH * 100
        return Math.max(0, Math.min(100, cur + deltaSoc))
      })
    }, intervalS * 1000)
    return () => clearInterval(id)
  }, [intervalS])

  // Push to EMS DB — sends effective loads (base + AC + Wallbox) + H+ as meter-07
  useEffect(() => {
    if (!syncEms) return
    let active = true
    const pushMs = Math.min(intervalS * 1000, 2000)

    async function push() {
      try {
        const res = await fetch('/sim/push', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            pv_kw:      pvKwRef.current,
            soc_pct:    socPctRef.current,
            meters:     [
              ...metersRef.current.map(m => ({ ...m, load_kw: effectiveKw(m) })),
              { id: 'm7', name: 'H+ Wärmepumpe', load_kw: hplusKwRef.current, is_bplus: true },
            ],
            interval_s: intervalS,
          }),
        })
        const data: PushResult = await res.json()
        if (active) setLastPush(data)
      } catch {
        if (active) setLastPush({ ok: false, error: 'Verbindungsfehler' })
      }
    }

    push()
    let timerId = window.setInterval(push, pushMs)

    function onVisibility() {
      if (!document.hidden && active) {
        clearInterval(timerId); push(); timerId = window.setInterval(push, pushMs)
      }
    }
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      active = false
      clearInterval(timerId)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [syncEms, intervalS])

  function reset() {
    setPvKw(5.0); setSocPct(60.0); setMeters(DEFAULT_METERS)
    setHplusUnits(0); setIntervalS(2); setSyncEms(false); setLastPush(null)
  }

  // Per-meter local allocation (proportional to effective B+ load share, including H+)
  const bplusTotalKw = allMeters.filter(m => m.is_bplus).reduce((s, m) => s + effectiveKw(m), 0)
  function meterLocalW(m: Meter): number {
    if (!m.is_bplus || bplusTotalKw === 0) return 0
    const share = effectiveKw(m) / bplusTotalKw
    return Math.min(effectiveKw(m) * 1000, share * flow.local_supply_w)
  }

  const hplusMeter: Meter = { id: 'm7', name: 'H+ Wärmepumpe', load_kw: hplusKw, is_bplus: true }
  const hplusLocalW = meterLocalW(hplusMeter)
  const hplusGridW  = Math.max(0, hplusKw * 1000 - hplusLocalW)

  const covColor = flow.local_coverage_pct >= 80 ? 'text-green-400'
    : flow.local_coverage_pct >= 40 ? 'text-amber-400' : 'text-red-400'

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold">Dashboard Simulation</h1>
          <p className="text-xs text-gray-500 mt-0.5">Interaktive Visualisierung des Energieflusses</p>
        </div>

        {/* EMS Sync toggle */}
        <div className={`flex items-center gap-3 px-4 py-2.5 rounded-xl border transition-colors ${
          syncEms ? 'bg-green-950/30 border-green-700' : 'bg-gray-900 border-gray-700'
        }`}>
          <div className="text-xs space-y-0.5">
            <div className="font-medium text-gray-200">EMS synchronisieren</div>
            <div className="text-gray-500">
              {dbReady === null ? 'Prüfe Datenbank…' : dbReady ? 'Datenbank erreichbar' : 'DB nicht verfügbar'}
            </div>
            {lastPush && (
              <div className={lastPush.ok ? 'text-green-400' : 'text-red-400'}>
                {lastPush.ok ? `✓ Push ${lastPush.ts?.slice(11, 19) ?? ''}` : `✗ ${lastPush.error}`}
              </div>
            )}
          </div>
          <button
            onClick={() => { if (dbReady) setSyncEms(v => !v) }}
            disabled={!dbReady}
            title={dbReady ? 'Simulation → EMS DB ein/ausschalten' : 'EMS-Datenbank nicht erreichbar'}
            className={`relative w-12 h-6 rounded-full border transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
              syncEms ? 'bg-green-500 border-green-400' : 'bg-gray-700 border-gray-600'
            }`}
          >
            <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
              syncEms ? 'translate-x-6' : 'translate-x-0.5'
            }`} />
          </button>
        </div>

        <button
          onClick={reset}
          className="text-xs px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-400 border border-gray-700 transition-colors"
        >
          Zurücksetzen
        </button>
      </div>

      {/* Sync hint */}
      {syncEms && (
        <div className="flex items-start gap-2 text-xs bg-green-950/20 border border-green-800 rounded-lg px-3 py-2.5 text-green-300">
          <span className="shrink-0 text-green-400 font-bold">↗</span>
          <div className="space-y-1">
            <span>
              Simulation schreibt alle {intervalS}s in die EMS-Datenbank.
              Das <strong>EMS-Dashboard</strong> und die <strong>Gerätestatus</strong>-Seite zeigen jetzt deine Simulation.
            </span>
            <div className="text-amber-400">
              ⚠ Für saubere Daten: meter-collector stoppen →{' '}
              <code className="bg-gray-900 px-1 rounded text-amber-300">docker compose stop meter-collector</code>
            </div>
          </div>
        </div>
      )}

      {/* Stats bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Deckungsgrad B+/H+', value: `${flow.local_coverage_pct.toFixed(1)} %`, cls: covColor },
          { label: 'PV-Ertrag',          value: fmtW(flow.pv_w),         cls: 'text-yellow-400' },
          { label: 'Netz-Import',        value: fmtW(flow.grid_import_w), cls: 'text-red-400' },
          {
            label: 'Batterie',
            value: flow.battery_charge_w > 0    ? `↑ ${fmtW(flow.battery_charge_w)}`
                 : flow.battery_discharge_w > 0 ? `↓ ${fmtW(flow.battery_discharge_w)}`
                 : 'Standby',
            cls: 'text-blue-400',
          },
        ].map(s => (
          <div key={s.label} className="bg-gray-900 rounded-xl border border-gray-800 px-4 py-3">
            <div className="text-xs text-gray-500">{s.label}</div>
            <div className={`text-lg font-bold font-mono mt-0.5 ${s.cls}`}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Main: controls + diagram */}
      <div className="grid lg:grid-cols-5 gap-4">

        {/* Source & simulation controls */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-4 space-y-5">
            <p className="text-sm font-medium text-gray-300">Energiequellen</p>

            {/* PV */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-yellow-400 font-medium">☀  Photovoltaik</span>
                <span className="text-gray-200 font-mono">{pvKw.toFixed(1)} kW</span>
              </div>
              <input type="range" min={0} max={20} step={0.1} value={pvKw}
                onChange={e => setPvKw(parseFloat(e.target.value))}
                className="w-full h-2 rounded-full accent-yellow-400 cursor-pointer" />
              <div className="flex justify-between text-[10px] text-gray-600">
                <span>0 kW</span><span>20 kW</span>
              </div>
            </div>

            {/* Battery SOC */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-blue-400 font-medium">⚡ Batterie SOC</span>
                <span className="text-gray-200 font-mono">{socPct.toFixed(1)} %</span>
              </div>
              <input type="range" min={0} max={100} step={1} value={socPct}
                onChange={e => setSocPct(parseFloat(e.target.value))}
                className="w-full h-2 rounded-full accent-blue-500 cursor-pointer" />
              <div className="flex h-2.5 bg-gray-800 rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all duration-200" style={{
                  width: `${socPct}%`,
                  backgroundColor: socPct > 50 ? '#3b82f6' : socPct > 20 ? '#f59e0b' : '#ef4444',
                }} />
              </div>
              <div className="flex justify-between text-[10px] text-gray-500">
                <span className="text-gray-600">Schieber = Startwert / Reset</span>
                {socPct <= 20
                  ? <span className="text-red-400">Entladen gesperrt</span>
                  : flow.battery_charge_w > 0
                    ? <span className="text-blue-400">↑ lädt</span>
                    : flow.battery_discharge_w > 0
                      ? <span className="text-amber-400">↓ entlädt</span>
                      : <span className="text-gray-600">Standby</span>
                }
              </div>
            </div>

            {/* Interval */}
            <div className="space-y-2">
              <p className="text-xs text-gray-400 font-medium">Animations-Intervall</p>
              <div className="flex gap-2">
                {[1, 2, 3, 5].map(s => (
                  <button key={s} onClick={() => setIntervalS(s)}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                      intervalS === s
                        ? 'bg-green-900/30 text-green-400 border-green-700'
                        : 'bg-gray-800 text-gray-500 border-gray-700 hover:border-gray-600'
                    }`}
                  >
                    {s}s
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-gray-600">Tick #{tick}</p>
            </div>
          </div>
        </div>

        {/* Flow diagram */}
        <div className="lg:col-span-3">
          <FlowDiagram flow={flow} socPct={socPct} hplusKw={hplusKw} />
        </div>
      </div>

      {/* Bewohner Meter cards */}
      <div>
        <p className="text-sm font-medium text-gray-400 mb-3">Smartmeter der Bewohner</p>
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
          {meters.map((m, i) => (
            <MeterCard
              key={m.id} meter={m}
              flowW={effectiveKw(m) * 1000}
              localW={meterLocalW(m)}
              onChange={updated => setMeters(prev => prev.map((x, j) => j === i ? updated : x))}
            />
          ))}
        </div>
      </div>

      {/* H+ Wärmepumpe (Hausverwaltung) */}
      <div>
        <p className="text-sm font-medium text-gray-400 mb-3">Hausverwaltung – Wärmepumpe (H+)</p>
        <div className="bg-gray-900 rounded-xl border border-teal-800 p-4">
          <div className="flex flex-wrap items-start gap-6">

            {/* Slider */}
            <div className="flex-1 min-w-56 space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-teal-400 font-medium">♨  Wohneinheiten aktiv</span>
                <span className="text-gray-200 font-mono">
                  {hplusUnits} WE × 1,5 kW = <strong className="text-white">{hplusKw.toFixed(1)} kW</strong>
                </span>
              </div>
              <input
                type="range" min={0} max={6} step={1}
                value={hplusUnits}
                onChange={e => setHplusUnits(parseInt(e.target.value))}
                className="w-full h-2 rounded-full accent-teal-500 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-gray-600">
                {[0,1,2,3,4,5,6].map(n => <span key={n}>{n}</span>)}
              </div>
              <p className="text-[10px] text-gray-600">0 = Wärmepumpe aus  ·  6 = alle Wohneinheiten</p>
            </div>

            {/* Live values */}
            <div className="flex gap-4 text-xs flex-wrap">
              <div className="bg-gray-800 rounded-lg px-3 py-2 min-w-28">
                <div className="text-gray-500 text-[10px] mb-0.5">H+ Bedarf</div>
                <div className="text-teal-400 font-bold font-mono">{fmtW(hplusKw * 1000)}</div>
              </div>
              <div className="bg-gray-800 rounded-lg px-3 py-2 min-w-28">
                <div className="text-gray-500 text-[10px] mb-0.5">Lokal</div>
                <div className="text-green-400 font-bold font-mono">{fmtW(hplusLocalW)}</div>
              </div>
              <div className="bg-gray-800 rounded-lg px-3 py-2 min-w-28">
                <div className="text-gray-500 text-[10px] mb-0.5">Netz-Zukauf</div>
                <div className="text-red-400 font-bold font-mono">{fmtW(hplusGridW)}</div>
              </div>
              {hplusKw > 0 && (
                <div className="bg-gray-800 rounded-lg px-3 py-2 min-w-28">
                  <div className="text-gray-500 text-[10px] mb-0.5">Deckungsgrad</div>
                  <div className="text-teal-400 font-bold font-mono">
                    {hplusKw > 0 ? `${Math.round(hplusLocalW / (hplusKw * 1000) * 100)} %` : '—'}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
        <p className="text-xs font-medium text-gray-400 mb-3">Legende Energiefluss</p>
        <div className="flex flex-wrap gap-4 text-xs text-gray-400">
          {[
            { color: C_YELLOW, label: 'Photovoltaik' },
            { color: C_GREEN,  label: 'Lokale Versorgung B+' },
            { color: C_BLUE,   label: 'Batterie (Laden ↑ / Entladen ↓)' },
            { color: C_TEAL,   label: 'H+ Wärmepumpe (Hausverwaltung)' },
            { color: C_RED,    label: 'Stromnetz (Import / Export)' },
            { color: C_GRAY,   label: 'B– Teilnehmer (immer Netz)' },
          ].map(({ color, label }) => (
            <div key={label} className="flex items-center gap-1.5">
              <div className="w-6 h-1.5 rounded-full" style={{ background: color }} />
              <span>{label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
