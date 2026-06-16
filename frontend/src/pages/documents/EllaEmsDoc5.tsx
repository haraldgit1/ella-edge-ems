import { useNavigate } from 'react-router-dom'

const B   = '#0053a0'   // BMW Blue
const IMG = '/ella_ems/docs/images'
const HN  = '"Helvetica Neue", Helvetica, Arial, sans-serif'

// ── Primitive design tokens ────────────────────────────────────────────────────

function AccentBar() {
  return <div style={{ backgroundColor: B, height: 3, width: 48 }} className="print:block shrink-0" />
}

function SectionLabel({ n, children }: { n: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-4">
      <span style={{ color: B, fontFamily: HN }} className="text-xs font-bold tracking-[0.22em] uppercase select-none whitespace-nowrap">
        {n}
      </span>
      <div className="flex-1 border-t border-gray-200 dark:border-gray-700 print:border-gray-300" />
    </div>
  )
}

// ── Stat block (BMW-style Kennzahl) ──────────────────────────────────────────

function Kenn({ value, unit, label }: { value: string; unit: string; label: string }) {
  return (
    <div className="text-center space-y-1.5 py-6 px-2">
      <div className="flex items-baseline justify-center gap-1" style={{ fontFamily: HN }}>
        <span className="text-5xl font-bold tracking-tight text-gray-900 dark:text-white print:text-black leading-none">
          {value}
        </span>
        <span className="text-xl font-light ml-1" style={{ color: B }}>
          {unit}
        </span>
      </div>
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-gray-500 print:text-gray-500" style={{ fontFamily: HN }}>
        {label}
      </p>
    </div>
  )
}

// ── Feature column (Drei-Säulen-Layout) ──────────────────────────────────────

function Saeule({ title, accentColor = B, items }: {
  title: string; accentColor?: string; items: { head: string; body: string }[]
}) {
  return (
    <div className="space-y-5 print:break-inside-avoid">
      <div style={{ borderTop: `3px solid ${accentColor}` }} className="pt-4">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-gray-900 dark:text-white print:text-black" style={{ fontFamily: HN }}>
          {title}
        </p>
      </div>
      <ul className="space-y-4">
        {items.map(({ head, body }, i) => (
          <li key={i}>
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 print:text-black" style={{ fontFamily: HN }}>{head}</p>
            <p className="text-xs font-light text-gray-500 dark:text-gray-400 print:text-gray-600 leading-relaxed mt-0.5" style={{ fontFamily: HN }}>{body}</p>
          </li>
        ))}
      </ul>
    </div>
  )
}

// ── Full-width image with caption ─────────────────────────────────────────────

function Bild({ src, alt, caption, desc }: { src: string; alt: string; caption: string; desc: string }) {
  return (
    <figure className="space-y-3 print:break-inside-avoid">
      <div className="overflow-hidden bg-gray-100 dark:bg-gray-800 print:bg-gray-100">
        <img src={src} alt={alt} className="w-full object-cover"
          onError={e => {
            const el = e.currentTarget; el.style.display = 'none'
            const ph = el.nextElementSibling as HTMLElement | null
            if (ph) ph.style.display = 'flex'
          }}
        />
        <div className="hidden h-44 items-center justify-center flex-col gap-2 text-gray-400" aria-hidden style={{ fontFamily: HN }}>
          <span className="text-4xl">▭</span>
          <span className="text-xs font-mono">{src.split('/').pop()}</span>
        </div>
      </div>
      <figcaption className="flex gap-6 items-start" style={{ fontFamily: HN }}>
        <AccentBar />
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-gray-400 print:text-gray-400">{caption}</p>
          <p className="text-xs font-light text-gray-500 dark:text-gray-400 print:text-gray-600 leading-relaxed mt-0.5">{desc}</p>
        </div>
      </figcaption>
    </figure>
  )
}

// ── Spec table row ─────────────────────────────────────────────────────────────

function SpecRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-6 py-2.5 border-b border-gray-100 dark:border-gray-800 print:border-gray-200 last:border-0" style={{ fontFamily: HN }}>
      <span className="text-xs font-semibold uppercase tracking-[0.1em] text-gray-400 print:text-gray-400 w-48 shrink-0">{label}</span>
      <span className="text-xs font-light text-gray-700 dark:text-gray-300 print:text-gray-700 leading-relaxed">{value}</span>
    </div>
  )
}

// ── Regelungsfluss: Subzähler → Σ → Sollwert → SolarEdge ─────────────────────

function RegelungsFluss() {
  return (
    <div className="mt-6 print:break-inside-avoid" style={{ fontFamily: HN }}>
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-gray-400 mb-3">Regelungsfluss</p>
      <div className="flex items-stretch gap-0 flex-wrap md:flex-nowrap print:flex-nowrap">

        {/* Inputs */}
        <div className="border border-gray-200 dark:border-gray-700 print:border-gray-300 px-4 py-3 space-y-1.5 flex flex-col justify-center min-w-[130px]">
          {['Subzähler 1', 'Subzähler 2', '⋮', 'Subzähler n'].map((l, i) => (
            <div key={i} className="flex items-center gap-2 text-xs font-light text-gray-500 dark:text-gray-400">
              <div style={{ width: 5, height: 5, backgroundColor: B, borderRadius: '50%', flexShrink: 0 }} />
              {l}
            </div>
          ))}
        </div>

        {/* Arrow 1 */}
        <div className="flex items-center px-3 text-gray-300 dark:text-gray-600 print:text-gray-400 text-xl self-center">→</div>

        {/* Summation */}
        <div style={{ border: `2px solid ${B}` }} className="px-5 py-3 flex flex-col items-center justify-center min-w-[90px]">
          <span style={{ color: B }} className="text-3xl font-bold leading-none select-none">Σ</span>
          <span className="text-[9px] font-semibold uppercase tracking-[0.15em] text-gray-400 mt-1.5">alle 10 s</span>
        </div>

        {/* Arrow 2 */}
        <div className="flex items-center px-3 text-gray-300 dark:text-gray-600 print:text-gray-400 text-xl self-center">→</div>

        {/* Setpoint */}
        <div className="border border-gray-300 dark:border-gray-600 print:border-gray-300 px-5 py-3 flex flex-col items-center justify-center min-w-[100px]">
          <span className="text-sm font-semibold text-gray-900 dark:text-white print:text-black">Sollwert</span>
          <span style={{ color: B }} className="text-xs font-light mt-0.5">[Watt]</span>
        </div>

        {/* Arrow 3 */}
        <div className="flex items-center px-3 text-gray-300 dark:text-gray-600 print:text-gray-400 text-xl self-center">→</div>

        {/* SolarEdge ONE */}
        <div style={{ backgroundColor: B }} className="px-5 py-3 flex flex-col items-center justify-center flex-1 min-w-[140px]">
          <span className="text-sm font-bold text-white">SolarEdge ONE</span>
          <span className="text-[9px] font-semibold uppercase tracking-[0.15em] text-blue-200 mt-1">Controller</span>
        </div>

      </div>
      <p className="text-[10px] font-light text-gray-400 mt-2 leading-relaxed">
        Ella erfasst alle B+-Subzähler, bildet die Lastsumme und übergibt den berechneten Sollwert alle 10 Sekunden direkt an den SolarEdge ONE Controller.
      </p>
    </div>
  )
}

// ── Hauptdokument ──────────────────────────────────────────────────────────────

export default function EllaEmsDoc5() {
  const navigate = useNavigate()

  return (
    <div className="max-w-4xl mx-auto space-y-2">

      {/* Toolbar */}
      <div className="flex items-center justify-between print:hidden mb-4">
        <button onClick={() => navigate('/documents')}
          className="text-xs text-gray-500 hover:text-gray-400 flex items-center gap-1"
          style={{ fontFamily: HN }}>
          ← Dokumente
        </button>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500 font-mono">Ella_EMS_Doc5 · Entwurf</span>
          <button onClick={() => window.print()}
            className="text-xs px-3 py-1.5 rounded-sm font-semibold transition-colors print:hidden"
            style={{ backgroundColor: B, color: '#fff', fontFamily: HN }}>
            Drucken / PDF
          </button>
        </div>
      </div>

      {/* ── Dokument-Body ── */}
      <div className="bg-white dark:bg-[#0a0a0a] print:bg-white print:border-0 border border-gray-200 dark:border-gray-800">

        {/* ══ HERO ══════════════════════════════════════════════════════════════ */}
        <div style={{ backgroundColor: B }} className="h-[3px] w-full" />

        <div className="px-12 pt-14 pb-10 print:px-8 print:pt-10">
          <div className="space-y-5">
            <div style={{ fontFamily: HN }}>
              <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-gray-400 print:text-gray-400 mb-4">
                Energiemanagementsystem · Mehrparteienanlagen · SolarEdge Integration
              </p>
              <h1 className="text-[3.25rem] font-black tracking-tight leading-none text-gray-900 dark:text-white print:text-black">
                Ella Edge EMS
              </h1>
              <div className="mt-4 mb-5" style={{ width: 64, height: 3, backgroundColor: B }} />
              <p className="text-2xl font-light tracking-tight" style={{ color: B }}>
                Lokal. Präzise. Autonom.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 print:grid-cols-2 gap-8 pt-4">
              <p className="text-sm font-light text-gray-500 dark:text-gray-400 print:text-gray-600 leading-relaxed max-w-sm" style={{ fontFamily: HN }}>
                Ella Edge EMS verteilt selbst erzeugten Solarstrom in Echtzeit an alle
                teilnehmenden Bewohner — vollautomatisch, cloud-unabhängig und auf die
                Sekunde genau abgerechnet.
              </p>
              <div className="flex items-end justify-end">
                <div className="text-right" style={{ fontFamily: HN }}>
                  <p className="text-[10px] uppercase tracking-[0.2em] text-gray-400">Engineered by</p>
                  <p className="text-base font-semibold text-gray-700 dark:text-gray-300 print:text-gray-700 mt-0.5">Sailer Engineering</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Hero image */}
        <div className="overflow-hidden bg-gray-100 dark:bg-gray-900 print:bg-gray-100 mx-12 mb-12 print:mx-8">
          <img src={`${IMG}/pv-anlage.jpg`} alt="PV-Anlage auf Mehrparteiengebäude"
            className="w-full object-cover" style={{ maxHeight: 400 }}
            onError={e => {
              const el = e.currentTarget; el.style.display = 'none'
              const ph = el.nextElementSibling as HTMLElement | null
              if (ph) ph.style.display = 'flex'
            }}
          />
          <div className="hidden h-52 items-center justify-center flex-col gap-2 text-gray-400" aria-hidden style={{ fontFamily: HN }}>
            <span className="text-5xl">▭</span>
            <span className="text-xs font-mono">pv-anlage.jpg</span>
          </div>
        </div>

        {/* ══ KENNZAHLEN ════════════════════════════════════════════════════════ */}
        <div className="border-t border-b border-gray-100 dark:border-gray-800 print:border-gray-200 mx-12 print:mx-8">
          <div className="grid grid-cols-2 md:grid-cols-4 print:grid-cols-4 divide-x divide-gray-100 dark:divide-gray-800 print:divide-gray-200">
            <Kenn value="5"   unit="s"   label="Regelintervall" />
            <Kenn value="15"  unit="min" label="Settlement-Takt" />
            <Kenn value="100" unit="%"   label="Lokal · Cloud-frei" />
            <Kenn value="0"   unit=""    label="Cloud-Abhängigkeit" />
          </div>
        </div>

        {/* ══ 01 — DIE ANLAGE ══════════════════════════════════════════════════ */}
        <div className="px-12 py-12 print:px-8 space-y-8 print:break-before-page">
          <SectionLabel n="01">Die Anlage</SectionLabel>

          <div className="grid grid-cols-1 md:grid-cols-2 print:grid-cols-2 gap-10 items-start">
            <div className="space-y-4" style={{ fontFamily: HN }}>
              <h2 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white print:text-black leading-snug">
                PV-Leistung trifft auf<br />Echtzeit-Intelligenz.
              </h2>
              <p className="text-sm font-light text-gray-500 dark:text-gray-400 print:text-gray-600 leading-relaxed">
                Ella Edge EMS setzt auf einer bestehenden oder neu geplanten PV-Anlage mit
                Wechselrichter und Batteriespeicher auf — ohne Eingriff in die
                Elektroinstallation der einzelnen Wohneinheiten.
              </p>
              <p className="text-sm font-light text-gray-500 dark:text-gray-400 print:text-gray-600 leading-relaxed">
                Typische Anlagengröße:{' '}
                <strong className="font-semibold text-gray-700 dark:text-gray-300 print:text-gray-700">20–50 kWp PV</strong> mit{' '}
                <strong className="font-semibold text-gray-700 dark:text-gray-300 print:text-gray-700">15–30 kWh Speicher</strong>.
                Ella übernimmt die intelligente Verteilung — sekundengenau.
              </p>
            </div>
            <div className="space-y-3" style={{ fontFamily: HN }}>
              {[
                ['Keine Eingriffe nötig', 'Bestehende Zähler und Verbraucher bleiben unverändert. Ella fügt sich als Intelligenzschicht ein.'],
                ['5-Sekunden-Regelung', 'Der Wechselrichter-Sollwert wird kontinuierlich an den Echtzeit-Bedarf aller B+-Teilnehmer angepasst.'],
                ['Batterie optimal genutzt', 'Kein Überschuss ins Netz, kein unnötiger Zukauf — bedarfsgerechte Entladung im Sekundentakt.'],
              ].map(([h, b]) => (
                <div key={h} className="flex gap-3 items-start py-3 border-b border-gray-100 dark:border-gray-800 print:border-gray-200 last:border-0">
                  <div style={{ width: 3, minHeight: 36, backgroundColor: B }} className="shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 print:text-black">{h}</p>
                    <p className="text-xs font-light text-gray-500 dark:text-gray-400 print:text-gray-600 mt-0.5 leading-relaxed">{b}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ══ 02 — ZÄHLERINFRASTRUKTUR ═════════════════════════════════════════ */}
        <div className="px-12 py-12 print:px-8 bg-gray-50 dark:bg-[#111] print:bg-gray-50 space-y-8 print:break-before-page">
          <SectionLabel n="02">Zählerinfrastruktur</SectionLabel>

          <div className="grid grid-cols-1 md:grid-cols-2 print:grid-cols-2 gap-10 items-center">
            <div className="space-y-3">
              <div className="overflow-hidden bg-white dark:bg-gray-900 print:bg-white border border-gray-200 dark:border-gray-700 print:border-gray-200">
                <img src={`${IMG}/smartmeter-landis-gyr.jpg`} alt="Landis+Gyr SmartMeter"
                  className="w-full object-cover" style={{ maxHeight: 260 }}
                  onError={e => {
                    const el = e.currentTarget; el.style.display = 'none'
                    const ph = el.nextElementSibling as HTMLElement | null
                    if (ph) ph.style.display = 'flex'
                  }}
                />
                <div className="hidden h-40 items-center justify-center flex-col gap-2 text-gray-400" aria-hidden>
                  <span className="text-4xl">▭</span>
                  <span className="text-xs font-mono">smartmeter-landis-gyr.jpg</span>
                </div>
              </div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-gray-400" style={{ fontFamily: HN }}>
                Abb. — Landis+Gyr Subzähler (z. B. E350 / MAP120)
              </p>
            </div>

            <div className="space-y-5" style={{ fontFamily: HN }}>
              <h2 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white print:text-black leading-snug">
                Subzähler-Push.<br />Direkt. Ohne Cloud.
              </h2>
              <p className="text-sm font-light text-gray-500 dark:text-gray-400 print:text-gray-600 leading-relaxed">
                Je Wohneinheit ist ein geeichter Subzähler im Einsatz.
                Alle <strong className="font-semibold text-gray-700 dark:text-gray-300">10 Sekunden</strong> meldet
                er den Momentanverbrauch per HTTP-Push direkt an Ella —
                kein Polling, kein Umweg.
              </p>
              <ul className="space-y-3">
                {[
                  ['CID-Mapping', 'Einmalige Zuordnung per Custom-ID — danach vollautomatisch.'],
                  ['Standardprotokoll', 'Pact (kW) + LDT (Zeitstempel) + CID per HTTP-POST.'],
                  ['Keine Eingriffe', 'Parallelmontage zur Bestandsinstallation. Keine Änderungen am Verbraucher.'],
                  ['Erweiterbar', 'H+-Wärmepumpe, EV-Ladeinfrastruktur — selbe Methode.'],
                ].map(([h, b]) => (
                  <li key={h} className="flex gap-3 text-sm">
                    <span style={{ color: B }} className="font-bold shrink-0 mt-0.5">›</span>
                    <span>
                      <strong className="font-semibold text-gray-800 dark:text-gray-200 print:text-gray-900">{h}</strong>
                      <span className="font-light text-gray-500 dark:text-gray-400 print:text-gray-600"> — {b}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* ══ 03 — SOLAREDGE ONE CONTROLLER ════════════════════════════════════ */}
        <div className="px-12 py-12 print:px-8 space-y-8 print:break-before-page">
          <SectionLabel n="03">SolarEdge ONE Controller</SectionLabel>

          <div className="grid grid-cols-1 md:grid-cols-2 print:grid-cols-2 gap-10 items-start">

            {/* Text */}
            <div className="space-y-5" style={{ fontFamily: HN }}>
              <h2 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white print:text-black leading-snug">
                SolarEdge ONE.<br />Präzise gesteuert.
              </h2>
              <p className="text-sm font-light text-gray-500 dark:text-gray-400 print:text-gray-600 leading-relaxed">
                SolarEdge zählt zu den weltweit führenden Anbietern intelligenter Energielösungen.
                Mit konsequentem Fokus auf Innovation und präziser Ingenieursarbeit hat SolarEdge
                eine Wechselrichtertechnologie entwickelt, die die Produktion und Steuerung von
                Solarenergie grundlegend neu definiert — und damit die ideale Schnittstelle für
                das Ella Edge EMS bildet.
              </p>
              <p className="text-sm font-light text-gray-500 dark:text-gray-400 print:text-gray-600 leading-relaxed">
                Die Regelungslogik ist direkt und präzise: Ella erfasst alle B+-Subzähler,
                bildet die Lastsumme und leitet daraus den aktuellen Energiebedarf ab. Dieser
                Sollwert wird unmittelbar an den SolarEdge ONE Controller übergeben —
                Wechselrichter und Batteriespeicher reagieren in Echtzeit.
              </p>

              <ul className="space-y-2.5">
                {[
                  ['Nahtlose Integration', 'Der SolarEdge ONE Controller kommuniziert direkt mit Ella Edge EMS über die offene Steuerungsschnittstelle.'],
                  ['Echtzeit-Regelung', 'Sollwert wird alle 10 Sekunden neu berechnet und übergeben — ohne manuellen Eingriff.'],
                  ['Bewährte Technologie', 'SolarEdge-Systeme sind weltweit in tausenden Anlagen im produktiven Einsatz.'],
                  ['Zukunftssicher', 'Vorbereitet für EV-Ladeinfrastruktur, Wärmepumpenintegration und Multi-Site-Betrieb.'],
                ].map(([h, b]) => (
                  <li key={h} className="flex gap-3 text-sm">
                    <span style={{ color: B }} className="font-bold shrink-0 mt-0.5">›</span>
                    <span>
                      <strong className="font-semibold text-gray-800 dark:text-gray-200 print:text-gray-900">{h}</strong>
                      <span className="font-light text-gray-500 dark:text-gray-400 print:text-gray-600"> — {b}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Image */}
            <div className="space-y-3">
              <div className="overflow-hidden bg-white dark:bg-gray-900 print:bg-white border border-gray-200 dark:border-gray-700 print:border-gray-200">
                <img src={`${IMG}/SolarEdge-ONE-Controller.png`} alt="SolarEdge ONE Controller"
                  className="w-full object-contain" style={{ maxHeight: 300 }}
                  onError={e => {
                    const el = e.currentTarget; el.style.display = 'none'
                    const ph = el.nextElementSibling as HTMLElement | null
                    if (ph) ph.style.display = 'flex'
                  }}
                />
                <div className="hidden h-48 items-center justify-center flex-col gap-2 text-gray-400" aria-hidden style={{ fontFamily: HN }}>
                  <span className="text-4xl">▭</span>
                  <span className="text-xs font-mono">SolarEdge-ONE-Controller.png</span>
                </div>
              </div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-gray-400" style={{ fontFamily: HN }}>
                Abb. — SolarEdge ONE Controller
              </p>
            </div>
          </div>

          {/* Regelungsfluss-Diagramm */}
          <RegelungsFluss />
        </div>

        {/* ══ 04 — DREI PERSPEKTIVEN ════════════════════════════════════════════ */}
        <div className="px-12 py-12 print:px-8 bg-gray-50 dark:bg-[#111] print:bg-gray-50 space-y-10 print:break-before-page">
          <div className="space-y-2">
            <SectionLabel n="04">Drei Perspektiven. Eine Plattform.</SectionLabel>
            <p className="text-sm font-light text-gray-500 dark:text-gray-400 print:text-gray-600 max-w-xl mt-2" style={{ fontFamily: HN }}>
              Ella Edge EMS schafft Mehrwert für alle Beteiligten — vom ersten Tag an.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 print:grid-cols-3 gap-8">
            <Saeule title="Bewohner (B+)" accentColor={B} items={[
              { head: 'Günstiger Solarstrom', body: 'Lokaltarif unter dem Netzpreis — ein fairer Vorteil aus der eigenen Anlage.' },
              { head: 'Kein Aufwand', body: 'Subzähler genügt. Keine App-Steuerung, kein manueller Eingriff.' },
              { head: 'Volle Transparenz', body: 'Echtzeit-Dashboard: Verbrauch, Deckungsgrad, EUR-Einsparung.' },
              { head: 'Faire Verteilung', body: 'Proportional zum Verbrauch — kein Teilnehmer wird bevorzugt.' },
            ]} />
            <Saeule title="Betreiber / Hausverwaltung" accentColor="#b45309" items={[
              { head: 'Maximale Eigennutzung', body: 'Ella verhindert unnötige Einspeisung — mehr lokale Energie, mehr Ertrag.' },
              { head: 'Neue Ertragsquelle', body: 'Lokale Energie an B+ verkaufen — kalkulierbar und gesetzeskonform.' },
              { head: 'Automatische Abrechnung', body: '15-min Settlement, Plausibilitätsprüfung, PDF auf Knopfdruck.' },
              { head: 'Cloud-freier Betrieb', body: 'DIN-Rail-PC im Schaltschrank. Volle Datensouveränität.' },
            ]} />
            <Saeule title="Systemlösungsanbieter" accentColor="#7c3aed" items={[
              { head: 'Differenzierung', body: 'PV + Speicher + EMS = Komplettlösung mit Alleinstellungsmerkmal.' },
              { head: 'Höherer Projektwert', body: 'Software, Inbetriebnahme, Service — deutlich mehr Marge.' },
              { head: 'Wiederkehrende Einnahmen', body: 'Lizenz- oder Servicegebühren über die gesamte Anlagenlaufzeit.' },
              { head: 'Professionelle Demos', body: 'Integrierter Simulationsmodus — live im Browser ohne Produktivanlage.' },
            ]} />
          </div>
        </div>

        {/* ══ 05 — DAS DASHBOARD ═══════════════════════════════════════════════ */}
        <div className="px-12 py-12 print:px-8 space-y-8 print:break-before-page">
          <SectionLabel n="05">Das Betreiber-Dashboard</SectionLabel>

          <Bild
            src={`${IMG}/dashboard-operator.png`}
            alt="Ella EMS Betreiber-Dashboard"
            caption="Abb. — Betreiber-Dashboard: Live-Kacheln, Leistungsverlauf und Regelstatus"
            desc="Live-Kacheln zeigen B+/H+-Gesamtverbrauch, PV-Leistung, Batterie-SOC und lokalen Deckungsgrad. Der wählbare Leistungsverlauf stellt B+, PV, Netzbezug und Batterie-SOC in Echtzeit dar. Alarm-Management und Settlement-Freigabe direkt im Browser — kein separates Tool."
          />
        </div>

        {/* ══ 06 — SIMULATION ══════════════════════════════════════════════════ */}
        {/* Seitenumbruch vor diesem Kapitel beim Drucken */}
        <div className="px-12 py-12 print:px-8 bg-gray-50 dark:bg-[#111] print:bg-gray-50 space-y-8 print:break-before-page">
          <SectionLabel n="06">Simulation & Demo-Modus</SectionLabel>

          <div className="grid grid-cols-1 md:grid-cols-2 print:grid-cols-2 gap-10 items-center">
            <div className="space-y-4" style={{ fontFamily: HN }}>
              <h2 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white print:text-black leading-snug">
                Überzeugend präsentieren —<br />ohne Produktivanlage.
              </h2>
              <p className="text-sm font-light text-gray-500 dark:text-gray-400 print:text-gray-600 leading-relaxed">
                Der integrierte Simulationsmodus erzeugt realistische Energieflüsse vollständig
                im Browser. PV-Leistung, Batterie-SOC und Bewohnerverbräuche werden in Echtzeit
                variiert — das Betreiber-Dashboard reagiert sofort.
              </p>
              <p className="text-sm font-light text-gray-500 dark:text-gray-400 print:text-gray-600 leading-relaxed">
                Hardware-Push-Modus: Subzähler-Protokoll direkt aus dem Browser. Ideal für
                Verkaufsgespräche, Inbetriebnahme-Tests und Schulungen.
              </p>
            </div>
            <div className="overflow-hidden bg-gray-100 dark:bg-gray-900 print:bg-gray-100">
              <img src={`${IMG}/dashboard-simulation.png`} alt="Ella EMS Simulationsdashboard"
                className="w-full object-cover"
                onError={e => {
                  const el = e.currentTarget; el.style.display = 'none'
                  const ph = el.nextElementSibling as HTMLElement | null
                  if (ph) ph.style.display = 'flex'
                }}
              />
              <div className="hidden h-40 items-center justify-center flex-col gap-2 text-gray-400" aria-hidden>
                <span className="text-4xl">▭</span>
                <span className="text-xs font-mono">dashboard-simulation.png</span>
              </div>
            </div>
          </div>
        </div>

        {/* ══ 07 — TECHNISCHE DATEN ════════════════════════════════════════════ */}
        <div className="px-12 py-12 print:px-8 space-y-8 print:break-before-page">
          <SectionLabel n="07">Technische Daten</SectionLabel>

          <div className="grid grid-cols-1 md:grid-cols-2 print:grid-cols-2 gap-x-16">
            <div>
              <SpecRow label="Messintervall"        value="5 Sekunden (Echtzeit-Regelung)" />
              <SpecRow label="Settlement"           value="15 Minuten — AT-Messregeln konform" />
              <SpecRow label="Regelung"             value="Wechselrichter-Sollwert, automatisch" />
              <SpecRow label="Subzähler-Integration" value="Hardware-Push, CID-Mapping" />
              <SpecRow label="Wechselrichter"       value="SolarEdge ONE Controller" />
              <SpecRow label="Protokolle"           value="Modbus TCP / RTU (vorbereitet)" />
              <SpecRow label="Datenbank"            value="SQLite WAL-Modus, lokal auf DIN-Rail-PC" />
            </div>
            <div>
              <SpecRow label="Betriebsumgebung"    value="Docker · DIN-Rail-PC · keine Cloud" />
              <SpecRow label="Berichte"            value="PDF (Bewohner, Betreiber) · CSV · ZIP" />
              <SpecRow label="Dashboard"           value="Webbasiert, responsive — kein App-Zwang" />
              <SpecRow label="Erweiterungen"       value="EV-Laden · Wärmepumpe H+ · Multi-Site" />
              <SpecRow label="Datenschutz"         value="DSGVO-konform · alle Daten im Gebäude" />
              <SpecRow label="Lizenz"              value="Auf Anfrage — Einmal- oder Subskription" />
            </div>
          </div>
        </div>

        {/* ══ FOOTER BAND ══════════════════════════════════════════════════════ */}
        <div className="px-12 py-10 print:px-8 print:bg-[#0a0a0a]" style={{ backgroundColor: '#0a0a0a' }}>
          <div className="flex flex-col md:flex-row print:flex-row items-start md:items-end print:items-end justify-between gap-6">
            <div style={{ fontFamily: HN }}>
              <div style={{ width: 32, height: 2, backgroundColor: B }} className="mb-4" />
              <p className="text-xl font-bold tracking-tight text-white">Ella Edge EMS</p>
              <p className="text-xs font-light text-gray-400 mt-1 tracking-wide">
                Lokales Energiemanagementsystem für Mehrparteienanlagen
              </p>
            </div>
            <div className="text-right" style={{ fontFamily: HN }}>
              <p className="text-xs font-semibold uppercase tracking-[0.15em] text-gray-500 mb-1">Entwickelt von</p>
              <p className="text-sm font-semibold text-white">Sailer Engineering</p>
              <p className="text-xs font-light text-gray-400 mt-0.5">www.sailersoft.com</p>
            </div>
          </div>
          <div className="mt-8 pt-4 border-t border-gray-800">
            <p className="text-[10px] font-light text-gray-600 tracking-wide" style={{ fontFamily: HN }}>
              Ella_EMS_Doc5 · Entwurf · Alle Angaben ohne Gewähr · Änderungen vorbehalten
            </p>
          </div>
        </div>

      </div>
    </div>
  )
}
