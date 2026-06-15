import { useNavigate } from 'react-router-dom'

const IMG_BASE = '/ella_ems/docs/images'

// ── Wiederverwendbare Komponenten ──────────────────────────────────────────────

function UspBadge({ icon, label }: { icon: string; label: string }) {
  return (
    <div className="flex items-center gap-2 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs text-gray-300 print:bg-gray-100 print:border-gray-300 print:text-gray-700">
      <span className="text-base">{icon}</span>
      <span>{label}</span>
    </div>
  )
}

function BulletList({ items, color = 'text-green-500' }: {
  items: { head: string; body?: string }[]
  color?: string
}) {
  return (
    <ul className="space-y-2">
      {items.map((it, i) => (
        <li key={i} className="flex gap-3 text-sm">
          <span className={`${color} mt-0.5 shrink-0`}>✓</span>
          <span>
            <strong className="text-gray-100 print:text-gray-900">{it.head}</strong>
            {it.body && <span className="text-gray-400 print:text-gray-600"> — {it.body}</span>}
          </span>
        </li>
      ))}
    </ul>
  )
}

/** Vollbreites Bild mit Bildunterschrift */
function FullImage({ src, alt, caption, description }: {
  src: string; alt: string; caption: string; description: string
}) {
  return (
    <figure className="space-y-3 print:break-inside-avoid">
      <div className="rounded-xl overflow-hidden border border-gray-700 bg-gray-800 print:border-gray-300">
        <img
          src={src} alt={alt}
          className="w-full object-cover"
          onError={e => {
            const el = e.currentTarget
            el.style.display = 'none'
            const ph = el.nextElementSibling as HTMLElement | null
            if (ph) ph.style.display = 'flex'
          }}
        />
        <div className="hidden h-40 items-center justify-center text-gray-600 text-sm flex-col gap-1" aria-hidden>
          <span className="text-3xl">🖼</span>
          <span className="font-mono text-xs">{src.split('/').pop()}</span>
          <span>Bild noch nicht hochgeladen</span>
        </div>
      </div>
      <figcaption className="space-y-0.5">
        <p className="text-xs font-semibold text-gray-400 print:text-gray-500 uppercase tracking-wide">{caption}</p>
        <p className="text-sm text-gray-400 print:text-gray-600 leading-relaxed">{description}</p>
      </figcaption>
    </figure>
  )
}

/** Kleines Bild (1/4 Breite) mit Text daneben */
function InlineImage({ src, alt, caption, side = 'left', children }: {
  src: string; alt: string; caption: string; side?: 'left' | 'right'; children: React.ReactNode
}) {
  const img = (
    <figure className="w-1/4 shrink-0 space-y-1.5">
      <div className="rounded-lg overflow-hidden border border-gray-700 bg-gray-800 print:border-gray-300">
        <img
          src={src} alt={alt}
          className="w-full object-cover"
          onError={e => {
            const el = e.currentTarget
            el.style.display = 'none'
            const ph = el.nextElementSibling as HTMLElement | null
            if (ph) ph.style.display = 'flex'
          }}
        />
        <div className="hidden h-24 items-center justify-center text-gray-600 text-xs flex-col gap-1" aria-hidden>
          <span className="text-2xl">🖼</span>
          <span className="font-mono" style={{ fontSize: 9 }}>{src.split('/').pop()}</span>
        </div>
      </div>
      <figcaption className="text-[10px] text-gray-500 print:text-gray-500 leading-snug">{caption}</figcaption>
    </figure>
  )

  return (
    <div className={`flex gap-6 items-start print:break-inside-avoid ${side === 'right' ? 'flex-row-reverse' : 'flex-row'}`}>
      {img}
      <div className="flex-1">{children}</div>
    </div>
  )
}

// ── Hauptdokument ──────────────────────────────────────────────────────────────

export default function EllaEmsDoc3() {
  const navigate = useNavigate()

  return (
    <div className="max-w-4xl mx-auto space-y-2">

      {/* Toolbar */}
      <div className="flex items-center justify-between print:hidden mb-4">
        <button onClick={() => navigate('/documents')}
          className="text-xs text-gray-500 hover:text-gray-300 flex items-center gap-1">
          ← Dokumente
        </button>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-600 font-mono">Ella_EMS_Doc3 · Entwurf</span>
          <button onClick={() => window.print()}
            className="text-xs bg-green-900/40 border border-green-700 text-green-400 px-3 py-1.5 rounded-lg hover:bg-green-900/60 transition-colors">
            Drucken / PDF
          </button>
        </div>
      </div>

      {/* Dokument-Body */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 print:p-0 print:bg-white print:border-0 space-y-10">

        {/* ── Header ── */}
        <div className="text-center space-y-3 pb-6 border-b border-gray-800 print:border-gray-300">
          <div className="text-xs font-mono text-green-500 print:text-green-700 tracking-widest uppercase">
            Produktbeschreibung · Vollständige Übersicht
          </div>
          <h1 className="text-3xl font-bold text-white print:text-black leading-tight">
            Ella Edge EMS
          </h1>
          <p className="text-lg text-green-400 print:text-green-700 font-medium">
            Lokales Energiemanagementsystem für Mehrparteienanlagen
          </p>
          <p className="text-sm text-gray-400 print:text-gray-600 max-w-2xl mx-auto leading-relaxed">
            Ella Edge EMS ermöglicht Bewohnern von Mehrparteienwohnanlagen mit gemeinsamer PV-Anlage
            und Batteriespeicher, günstigen, selbst erzeugten Solarstrom zu beziehen —
            vollautomatisch verteilt, fair abgerechnet und cloud-unabhängig betrieben.
          </p>
        </div>

        {/* ── USP-Kacheln ── */}
        <div>
          <h3 className="text-xs font-mono text-gray-500 print:text-gray-500 uppercase tracking-widest mb-3">
            Technische Highlights auf einen Blick
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <UspBadge icon="⚡" label="5-Sekunden Echtzeit-Regelung" />
            <UspBadge icon="🏠" label="100 % lokal · cloud-frei" />
            <UspBadge icon="🔒" label="DSGVO-konform · kein Cloud-Zwang" />
            <UspBadge icon="📊" label="15-min Settlement" />
            <UspBadge icon="🔌" label="SmartMeter Hardware-Push" />
            <UspBadge icon="📄" label="Auto. PDF/CSV-Berichte" />
            <UspBadge icon="🔧" label="Modbus TCP/RTU-ready" />
            <UspBadge icon="📈" label="Skalierbar · erweiterbar" />
          </div>
        </div>

        {/* ── Kapitel 1: PV-Anlage ── */}
        <section className="space-y-5 print:break-inside-avoid">
          <div className="border-l-4 border-green-600 pl-4">
            <h2 className="text-lg font-bold text-white print:text-black">
              1 &nbsp; Die Basis: PV-Anlage mit Batteriespeicher
            </h2>
            <p className="text-sm text-gray-400 print:text-gray-600 mt-1">
              Ella Edge EMS setzt auf einer bestehenden oder neu geplanten PV-Anlage mit
              Wechselrichter und Batteriespeicher auf — ohne Eingriff in die
              Elektroinstallation der einzelnen Wohneinheiten.
            </p>
          </div>
          <FullImage
            src={`${IMG_BASE}/pv-anlage.jpg`}
            alt="Photovoltaikanlage auf Mehrparteienwohnhaus"
            caption="Abb. 1 — PV-Anlage auf Mehrparteiengebäude"
            description="Eine typische Anlage mit 20–50 kWp PV-Leistung und 15–30 kWh Batteriespeicher bildet die Grundlage. Ella übernimmt die intelligente Echtzeit-Verteilung der lokal erzeugten Energie an alle teilnehmenden Bewohner (B+) — sekundengenau und vollautomatisch."
          />
        </section>

        {/* ── Kapitel 2: SmartMeter (inline, 1/4 Breite) ── */}
        <section className="space-y-5 print:break-inside-avoid">
          <div className="border-l-4 border-blue-600 pl-4">
            <h2 className="text-lg font-bold text-white print:text-black">
              2 &nbsp; Zählerinfrastruktur: SmartMeter-Integration
            </h2>
          </div>
          <InlineImage
            src={`${IMG_BASE}/smartmeter-landis-gyr.jpg`}
            alt="Landis+Gyr SmartMeter"
            caption="Abb. 2 — Landis+Gyr SmartMeter (z. B. E350 / MAP120)"
            side="left"
          >
            <div className="space-y-3 text-sm">
              <p className="text-gray-300 print:text-gray-700 leading-relaxed">
                Je Wohneinheit wird ein geeichter SmartMeter installiert, der alle <strong>10 Sekunden</strong> den
                Momentanverbrauch per Hardware-Push direkt an Ella Edge EMS meldet. Kein Cloud-Weg,
                kein Polling — nur ein direkter HTTP-Push in das lokale EMS.
              </p>
              <ul className="space-y-1.5">
                {[
                  ['CID-basiertes Mapping', 'Jedes Gerät wird einmalig in der Stammdatenverwaltung per Custom-ID (CID) zugeordnet — danach läuft die Kommunikation vollautomatisch.'],
                  ['Standardprotokoll', 'Push-Parameter: Wirkleistung (Pact in kW), Gerätezeitstempel (LDT) und Geräte-ID (CID) per HTTP-POST.'],
                  ['Keine Eingriffe nötig', 'Der SmartMeter wird parallel zur bestehenden Installation montiert. Keine Änderungen an Verbrauchsgeräten der Bewohner.'],
                  ['Erweiterbar', 'Weitere Zähler (Wärmepumpe H+, Ladeinfrastruktur) werden mit derselben Methode integriert.'],
                ].map(([h, b]) => (
                  <li key={h} className="flex gap-2">
                    <span className="text-blue-400 mt-0.5 shrink-0">›</span>
                    <span className="text-gray-400 print:text-gray-600">
                      <strong className="text-gray-200 print:text-gray-800">{h}</strong> — {b}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </InlineImage>
        </section>

        {/* ── Kapitel 3: Bewohner ── */}
        <section className="space-y-4 print:break-inside-avoid">
          <div className="border-l-4 border-green-600 pl-4">
            <h2 className="text-lg font-bold text-white print:text-black">
              3 &nbsp; Nutzen für die Bewohnerin / den Bewohner (B+)
            </h2>
            <p className="text-sm text-gray-400 print:text-gray-600 mt-1">
              Bewohner, die als <strong className="text-green-400 print:text-green-700">B+</strong> der
              Energiegemeinschaft beitreten, beziehen lokal erzeugten Solar- und Batteriespeicherstrom
              zu einem günstigeren Tarif — direkt aus der eigenen Wohnanlage.
            </p>
          </div>
          <BulletList color="text-green-500" items={[
            { head: 'Günstiger grüner Strom', body: 'Der Lokaltarif liegt unter dem öffentlichen Netzbezugspreis und über der Einspeisevergütung — ein fairer Preis für beide Seiten.' },
            { head: 'Kein technischer Aufwand', body: 'Ein SmartMeter genügt. Keine Eingriffe in Haushaltsgeräte, keine Apps zur Steuerung, kein manueller Aufwand.' },
            { head: 'Volle Transparenz', body: 'Das persönliche Bewohner-Dashboard zeigt Echtzeit-Verbrauch, lokalen Deckungsgrad und die monatliche EUR-Einsparung gegenüber dem Netzbezug.' },
            { head: 'Freiwillige Teilnahme', body: 'Opt-in und jederzeit kündbar. Nicht-Teilnehmer (B–) bleiben unverändert am öffentlichen Netz.' },
            { head: 'Faire automatische Verteilung', body: 'Die verfügbare Lokalenergie wird proportional zum Verbrauch auf alle B+-Teilnehmer aufgeteilt — kein Teilnehmer wird bevorzugt.' },
            { head: 'Nachvollziehbare Monatsabrechnung', body: 'Automatisch generierte PDF-Abrechnung: lokale kWh, Netz-kWh, Tarife und Einsparung übersichtlich auf einer Seite.' },
            { head: 'Identifikation mit der eigenen Anlage', body: '„Ich nutze den Strom aus meiner eigenen Wohnanlage" — ein konkreter, täglich sichtbarer Mehrwert.' },
          ]} />
        </section>

        {/* ── Kapitel 4: Betreiber + Dashboard ── */}
        <section className="space-y-5">
          <div className="border-l-4 border-amber-500 pl-4">
            <h2 className="text-lg font-bold text-white print:text-black">
              4 &nbsp; Nutzen für den Betreiber der Wohnanlage / Hausverwaltung
            </h2>
            <p className="text-sm text-gray-400 print:text-gray-600 mt-1">
              Für Eigentümergemeinschaften, Bauträger und Hausverwaltungen mit bestehender oder
              geplanter PV-Anlage bietet Ella Edge EMS eine vollständige Betreiberlösung —
              vom Echtzeit-Monitoring bis zur gesetzeskonformen Abrechnung.
            </p>
          </div>
          <BulletList color="text-amber-400" items={[
            { head: 'Maximale Eigennutzung der PV-Anlage', body: 'Ella verteilt lokal erzeugten Strom vorrangig an teilnehmende Bewohner und verhindert unnötige Einspeisung ins öffentliche Netz.' },
            { head: 'Bessere Wirtschaftlichkeit des Batteriespeichers', body: 'Der Wechselrichter-Sollwert wird alle 5 Sekunden an den aktuellen B+-Gesamtbedarf angepasst — bedarfsgerecht, kein Überschuss, kein Mangel.' },
            { head: 'Zusätzliche Einnahmequelle', body: 'Der Betreiber erzielt Einnahmen aus dem Verkauf lokaler Energie an B+-Teilnehmer zum Lokaltarif — eine neue, kalkulierbare Ertragsquelle.' },
            { head: 'Professionelles Betreiber-Dashboard', body: 'Echtzeit-Überblick über PV-Leistung, Batterie-SOC, Netzfluss und Regelstatus. Alarm-Management und Settlement-Freigabe im Browser.' },
            { head: 'Gesetzeskonforme Abrechnung ohne Mehraufwand', body: '15-Minuten-Settlement gemäß österreichischer Messregeln, Plausibilitätsprüfung und automatische Berichterstellung inklusive.' },
            { head: 'Bewohnerbindung durch modernes Energiekonzept', body: 'B+-Teilnehmer schätzen günstigen Strom und ein transparentes Abrechnungssystem — ein echter Mehrwert bei Vermietung.' },
            { head: 'Skalierbarkeit ohne Systemwechsel', body: 'Mehr Wohneinheiten, zusätzliche Zähler oder eine zweite PV-Anlage werden ohne Architekturwechsel integriert.' },
            { head: 'Lokaler Betrieb · keine Cloud-Abhängigkeit', body: 'Das System läuft auf einem DIN-Rail-PC im Schaltschrank. Keine Cloud-Gebühren, kein Internet-Zwang, volle Datensouveränität.' },
          ]} />

          <FullImage
            src={`${IMG_BASE}/dashboard-operator.png`}
            alt="Ella EMS Betreiber-Dashboard"
            caption="Abb. 3 — Betreiber-Dashboard: Live-Kacheln, Leistungsverlauf und Regelstatus"
            description="Live-Kacheln (oben) zeigen B+/H+-Gesamtverbrauch, PV-Leistung, Batterie-SOC und lokalen Deckungsgrad. Der Leistungsverlauf (Mitte) stellt B+, PV, Netzbezug und Batterie-SOC über wählbare Zeitfenster dar — mit optionaler Einzelteilnehmer-Overlay-Linie. Unten: Letzte Regelentscheidung mit Grund-Code und Istwert des Wechselrichters."
          />
        </section>

        {/* ── Kapitel 5: Systemlösungsanbieter + Simulation ── */}
        <section className="space-y-5">
          <div className="border-l-4 border-purple-500 pl-4">
            <h2 className="text-lg font-bold text-white print:text-black">
              5 &nbsp; Nutzen für Komplettanbieter / Systemlösungsanbieter / Projektplaner
            </h2>
            <p className="text-sm text-gray-400 print:text-gray-600 mt-1">
              Ella Edge EMS verwandelt eine Hardware-Installation in eine vollständige,
              betreibbare Energielösung — mit Software, Monitoring, Abrechnung und Betrieb
              als eigenständige, abrechenbare Leistung.
            </p>
          </div>
          <BulletList color="text-purple-400" items={[
            { head: 'Differenzierung vom Wettbewerb', body: 'Nicht nur PV + Speicher — Komplettlösung inkl. lokalem Energiemanagement, Bewohner-Portal und Abrechnungsservice.' },
            { head: 'Deutlich höherer Projektwert', body: 'Software, Inbetriebnahme, Monitoring, Reporting und Abrechnungsservice erhöhen den Gesamtauftragswert mit höheren Margen.' },
            { head: 'Kürzere Amortisation für den Endkunden', body: 'Erlöse aus lokalem Stromverkauf verkürzen die Amortisationszeit der PV-/Speicheranlage spürbar.' },
            { head: 'Wiederkehrende Einnahmen', body: 'Lizenz- oder Servicegebühren sichern planbare, wiederkehrende Erlöse über die gesamte Anlagenlaufzeit.' },
            { head: 'Folgegeschäfte durch offene Architektur', body: 'Speichererweiterung, EV-Ladeinfrastruktur, Wärmepumpenoptimierung (H+) und Multi-Site-Betrieb sind vorbereitet.' },
            { head: 'Professionelle Demos mit Simulationsmodus', body: 'Ohne Produktivanlage demonstrierbar — der integrierte Simulationsmodus zeigt Energieflüsse und Dashboard live im Browser.' },
            { head: 'Schnelle Integration', body: 'Offene RESTful API, SmartMeter Hardware-Push per CID-Mapping, Modbus TCP/RTU-Vorbereitung — standardkonforme Schnittstellen.' },
            { head: 'Managed Service als Dienstleistung', body: 'Fernmonitoring, Alarm-Management, monatliche Berichte und Settlement-Freigabe als eigenständiges Servicemodell anbietbar.' },
          ]} />

          <FullImage
            src={`${IMG_BASE}/dashboard-simulation.png`}
            alt="Ella EMS Simulation Dashboard"
            caption="Abb. 4 — Simulationsdashboard: Energiefluss-Visualisierung und Hardware-Push-Test"
            description="Konfigurierbare Parameter: PV-Leistung, Batterie-SOC, Verbrauch je Bewohner, B+/B–-Status und H+-Wärmepumpe. Live-Energieflussdiagramm in Echtzeit. Hardware-Push-Modus sendet Werte per SmartMeter-Protokoll — das Betreiber-Dashboard reagiert sofort, als würde ein realer Zähler liefern. Ideal für Verkaufspräsentationen ohne Produktivanlage."
          />
        </section>

        {/* ── Kapitel 6: Technische Eckdaten ── */}
        <section className="space-y-4 print:break-inside-avoid">
          <div className="border-l-4 border-gray-600 pl-4">
            <h2 className="text-lg font-bold text-white print:text-black">
              6 &nbsp; Technische Eckdaten
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-1.5 text-sm">
            {[
              ['Messintervall',         '5 Sekunden (Echtzeit-Regelung)'],
              ['Settlement-Intervall',  '15 Minuten (AT-Messregeln konform)'],
              ['Regelung',              'Wechselrichter-Sollwert automatisch angepasst'],
              ['Zähler-Integration',    'SmartMeter Hardware-Push (CID-Mapping)'],
              ['Protokolle',            'Modbus TCP, Modbus RTU (vorbereitet)'],
              ['Datenbank',             'SQLite WAL-Modus, lokal auf DIN-Rail-PC'],
              ['Betriebsumgebung',      'Docker, DIN-Rail-PC, keine Cloud'],
              ['Berichte',              'PDF (Bewohner, Betreiber), CSV-Detail, Diagnose-ZIP'],
              ['Dashboard',             'Webbasiert, responsive — kein App-Zwang'],
              ['Erweiterungen',         'EV-Ladeinfrastruktur, Wärmepumpe (H+), Multi-Site'],
              ['Datenschutz',           'DSGVO-konform, alle Daten bleiben im Gebäude'],
              ['Lizenz',                'Auf Anfrage — Einmal- oder Subskriptionsmodell'],
            ].map(([k, v]) => (
              <div key={k} className="flex gap-2">
                <span className="text-gray-500 shrink-0 w-44">{k}</span>
                <span className="text-gray-300 print:text-gray-700">{v}</span>
              </div>
            ))}
          </div>
        </section>

        {/* ── Footer ── */}
        <div className="border-t border-gray-800 print:border-gray-300 pt-5 text-center space-y-1">
          <p className="font-bold text-gray-200 print:text-black">Ella Edge EMS</p>
          <p className="text-xs text-gray-500 print:text-gray-500">
            Entwickelt von Sailer Engineering · www.sailersoft.com
          </p>
          <p className="text-[10px] text-gray-700 print:text-gray-400 mt-2">
            Ella_EMS_Doc3 · Entwurf · Alle Angaben ohne Gewähr · Änderungen vorbehalten
          </p>
        </div>

      </div>
    </div>
  )
}
