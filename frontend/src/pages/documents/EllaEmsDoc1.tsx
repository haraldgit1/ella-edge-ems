import { useNavigate } from 'react-router-dom'

function Section({ id, title, color, children }: {
  id: string; title: string; color: string; children: React.ReactNode
}) {
  return (
    <section id={id} className="space-y-4 print:break-inside-avoid">
      <h2 className={`text-lg font-bold border-b-2 pb-2 ${color}`}>{title}</h2>
      {children}
    </section>
  )
}

function BulletList({ items }: { items: { head: string; body?: string }[] }) {
  return (
    <ul className="space-y-2">
      {items.map((it, i) => (
        <li key={i} className="flex gap-3 text-sm">
          <span className="text-green-600 dark:text-green-500 mt-0.5 shrink-0">✓</span>
          <span>
            <strong className="text-gray-800 dark:text-gray-100">{it.head}</strong>
            {it.body && <span className="text-gray-500 dark:text-gray-400"> — {it.body}</span>}
          </span>
        </li>
      ))}
    </ul>
  )
}

function UspBadge({ icon, label }: { icon: string; label: string }) {
  return (
    <div className="flex items-center gap-2 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-xs text-gray-600 dark:text-gray-300">
      <span className="text-base">{icon}</span>
      <span>{label}</span>
    </div>
  )
}

export default function EllaEmsDoc1() {
  const navigate = useNavigate()

  return (
    <div className="max-w-4xl mx-auto space-y-2">

      {/* Toolbar — versteckt beim Drucken */}
      <div className="flex items-center justify-between print:hidden mb-4">
        <button
          onClick={() => navigate('/documents')}
          className="text-xs text-gray-500 hover:text-gray-300 flex items-center gap-1"
        >
          ← Dokumente
        </button>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500 dark:text-gray-600 font-mono">Ella_EMS_Doc1 · Entwurf</span>
          <button
            onClick={() => window.print()}
            className="text-xs bg-green-100 dark:bg-green-900/40 border border-green-300 dark:border-green-700 text-green-600 dark:text-green-400 px-3 py-1.5 rounded-lg hover:bg-green-100 dark:hover:bg-green-900/60 transition-colors"
          >
            Drucken / PDF
          </button>
        </div>
      </div>

      {/* Dokument-Body */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-8 print:p-0 print:bg-white print:border-0 print:text-black space-y-8">

        {/* Header */}
        <div className="text-center space-y-3 pb-6 border-b border-gray-200 dark:border-gray-800 print:border-gray-300">
          <div className="text-xs font-mono text-green-600 dark:text-green-500 print:text-green-700 tracking-widest uppercase">
            Produkt-Flyer · Leistungsbeschreibung
          </div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white print:text-black leading-tight">
            Ella Edge EMS
          </h1>
          <p className="text-lg text-green-600 dark:text-green-400 print:text-green-700 font-medium">
            Lokales Energiemanagementsystem für Mehrparteienanlagen
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400 print:text-gray-600 max-w-2xl mx-auto">
            Ella Edge EMS ermöglicht Bewohnern von Mehrparteienwohnanlagen mit gemeinsamer
            PV-Anlage und Batteriespeicher, günstig und nachvollziehbar selbst erzeugten
            Solarstrom zu beziehen — vollautomatisch, fair und cloud-unabhängig.
          </p>
        </div>

        {/* USP-Kacheln */}
        <div>
          <h3 className="text-xs font-mono text-gray-500 uppercase tracking-widest mb-3">
            Technische Highlights
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

        {/* A: Bewohner */}
        <Section id="kunden" title="A  |  Nutzen für die Bewohnerin / den Bewohner" color="text-green-600 dark:text-green-400 border-green-300 dark:border-green-700 print:text-green-700 print:border-green-400">
          <p className="text-sm text-gray-500 dark:text-gray-400 print:text-gray-600">
            Bewohner, die als <strong className="text-green-600 dark:text-green-400 print:text-green-700">B+</strong> der
            Energiegemeinschaft beitreten, beziehen lokal erzeugten Solar- und Batteriespeicherstrom
            zu einem günstigeren Tarif — direkt aus der eigenen Wohnanlage.
          </p>
          <BulletList items={[
            {
              head: 'Günstiger grüner Strom',
              body: 'Der Lokaltarif liegt unter dem öffentlichen Netzbezugspreis und über der Einspeisevergütung — ein fairer Preis für beide Seiten.',
            },
            {
              head: 'Kein technischer Aufwand',
              body: 'Ein SmartMeter genügt. Keine Eingriffe in Haushaltsgeräte, keine Apps zur Steuerung, kein manueller Aufwand.',
            },
            {
              head: 'Volle Transparenz',
              body: 'Das persönliche Bewohner-Dashboard zeigt Echtzeit-Verbrauch, lokalen Deckungsgrad und die monatliche EUR-Einsparung gegenüber dem Netzbezug.',
            },
            {
              head: 'Freiwillige Teilnahme',
              body: 'Opt-in und jederzeit kündbar. Nicht-Teilnehmer (B–) bleiben unverändert am öffentlichen Netz.',
            },
            {
              head: 'Fairness durch automatische Verteilung',
              body: 'Die verfügbare Lokalenergie wird proportional zum Verbrauch auf alle B+-Teilnehmer aufgeteilt — kein Teilnehmer wird bevorzugt.',
            },
            {
              head: 'Nachvollziehbare Monatsabrechnung',
              body: 'Automatisch generierte PDF-Abrechnung: lokale kWh, Netz-kWh, Tarife und Einsparung übersichtlich auf einer Seite.',
            },
            {
              head: 'Identifikation mit der eigenen Anlage',
              body: '"Ich nutze den Strom aus meiner eigenen Wohnanlage" — ein konkreter Mehrwert, der täglich sichtbar ist.',
            },
          ]} />
        </Section>

        {/* B: Betreiber */}
        <Section id="betreiber" title="B  |  Nutzen für den Betreiber der Wohnanlage / Hausverwaltung" color="text-blue-600 dark:text-blue-400 border-blue-300 dark:border-blue-700 print:text-blue-700 print:border-blue-400">
          <p className="text-sm text-gray-500 dark:text-gray-400 print:text-gray-600">
            Für Eigentümergemeinschaften, Bauträger und Hausverwaltungen mit bestehender oder
            geplanter PV-Anlage und Batteriespeicher bietet Ella Edge EMS eine vollständige
            Betreiberlösung — vom Echtzeit-Monitoring bis zur gesetzeskonformen Abrechnung.
          </p>
          <BulletList items={[
            {
              head: 'Maximale Eigennutzung der PV-Anlage',
              body: 'Ella verteilt lokal erzeugten Strom vorrangig an teilnehmende Bewohner und verhindert unnötige Einspeisung ins öffentliche Netz.',
            },
            {
              head: 'Bessere Wirtschaftlichkeit des Batteriespeichers',
              body: 'Der Wechselrichter-Sollwert wird alle 5 Sekunden an den aktuellen B+-Gesamtbedarf angepasst. Die Batterie entlädt bedarfsgerecht — kein Überschuss, kein Mangel.',
            },
            {
              head: 'Zusätzliche Einnahmequelle',
              body: 'Der Betreiber erzielt Einnahmen aus dem Verkauf lokaler Energie an B+-Teilnehmer zum Lokaltarif — eine neue, kalkulierbare Ertragsquelle.',
            },
            {
              head: 'Professionelles Betreiber-Dashboard',
              body: 'Echtzeit-Überblick über PV-Leistung, Batterie-SOC, Netzfluss und Regelstatus. Alarm-Management und Settlement-Freigabe im Browser.',
            },
            {
              head: 'Gesetzeskonforme Abrechnung ohne Mehraufwand',
              body: '15-Minuten-Settlement gemäß österreichischer Messregeln. Plausibilitätsprüfung, Freigabe-Workflow und automatische Berichterstellung inklusive.',
            },
            {
              head: 'Bewohnerbindung durch modernes Energiekonzept',
              body: 'B+-Teilnehmer schätzen günstigen Strom und ein transparentes, digitales Abrechnungssystem. Ein echter Mehrwert bei Vermietung und Wiedervermietung.',
            },
            {
              head: 'Skalierbarkeit ohne Systemwechsel',
              body: 'Ella wächst mit der Anlage: mehr Wohneinheiten, zusätzliche Zähler oder eine zweite PV-Anlage werden ohne Architekturwechsel integriert.',
            },
            {
              head: 'Lokaler Betrieb — keine Cloud-Abhängigkeit',
              body: 'Das System läuft auf einem DIN-Rail-PC im Schaltschrank. Keine monatlichen Cloud-Gebühren, kein Internet-Zwang, volle Datensouveränität.',
            },
          ]} />
        </Section>

        {/* C: Systemlösungsanbieter */}
        <Section id="anbieter" title="C  |  Nutzen für Komplettanbieter / Systemlösungsanbieter / Projektplaner" color="text-amber-600 dark:text-amber-400 border-amber-300 dark:border-amber-700 print:text-amber-700 print:border-amber-400">
          <p className="text-sm text-gray-500 dark:text-gray-400 print:text-gray-600">
            Ella Edge EMS ist die ideale Ergänzung für PV- und Speicherprojekte in
            Mehrparteienwohnanlagen. Sie verwandelt eine Hardware-Installation in eine
            vollständige, betreibbare Energielösung — mit Software, Monitoring, Abrechnung
            und Betrieb als eigenständige, abrechenbare Leistung.
          </p>
          <BulletList items={[
            {
              head: 'Differenzierung vom Wettbewerb',
              body: 'Nicht nur PV + Speicher — sondern eine Komplettlösung inkl. lokalem Energiemanagement, Bewohner-Portal und Abrechnungsservice. Ein Angebot, das Mitbewerber ohne Softwarekompetenz nicht stellen können.',
            },
            {
              head: 'Deutlich höherer Projektwert',
              body: 'Software, Inbetriebnahme, Monitoring, Reporting und Abrechnungsservice erhöhen den Gesamtauftragswert — mit höheren Margen als reine Hardwarelieferung.',
            },
            {
              head: 'Kürzere Amortisation für den Endkunden',
              body: 'Die Erlöse aus lokalem Stromverkauf verkürzen die Amortisationszeit der PV-/Speicheranlage spürbar und stärken die Wirtschaftlichkeitsrechnung im Angebot.',
            },
            {
              head: 'Wiederkehrende Einnahmen',
              body: 'Lizenz- oder Servicegebühren für Betrieb, Updates und Support sichern planbare, wiederkehrende Erlöse über die gesamte Anlagenlaufzeit.',
            },
            {
              head: 'Folgegeschäfte durch offene Architektur',
              body: 'Ella ist von Beginn an erweiterbar: Speichererweiterung, EV-Ladeinfrastruktur (Integration weiterer Zähler), Wärmepumpenoptimierung (H+-Sonderklasse) und Multi-Site-Betrieb sind vorbereitet.',
            },
            {
              head: 'Professionelle Demos mit Simulationsmodus',
              body: 'Ohne Produktivanlage demonstrierbar: Der integrierte Simulationsmodus zeigt Energieflüsse, Regelung und Dashboard live im Browser — überzeugend in Verkaufsgesprächen und Präsentationen.',
            },
            {
              head: 'Schnelle Integration und Inbetriebnahme',
              body: 'Offene RESTful API, SmartMeter Hardware-Push per CID-Mapping, Modbus TCP/RTU-Vorbereitung. Standardkonforme Schnittstellen beschleunigen die Projektierung.',
            },
            {
              head: 'Managed Service als eigenständige Dienstleistung',
              body: 'Fernmonitoring, proaktives Alarm-Management, monatliche Berichte und Settlement-Freigabe können als Managed Service angeboten werden — ein modernes, skalierbares Geschäftsmodell.',
            },
          ]} />
        </Section>

        {/* Technische Fakten */}
        <Section id="technik" title="Technische Eckdaten" color="text-gray-500 dark:text-gray-400 border-gray-300 dark:border-gray-700 print:text-gray-600 print:border-gray-400">
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
              ['Dashboard',             'Webbasiert, responsive (Browser, kein App-Zwang)'],
              ['Erweiterungen',         'EV-Ladeinfrastruktur, Wärmepumpe (H+), Multi-Site'],
              ['Datenschutz',           'DSGVO-konform, alle Daten bleiben im Gebäude'],
              ['Lizenz',                'Auf Anfrage — Einmal- oder Subskriptionsmodell'],
            ].map(([k, v]) => (
              <div key={k} className="flex gap-2">
                <span className="text-gray-500 print:text-gray-500 shrink-0 w-40">{k}</span>
                <span className="text-gray-600 dark:text-gray-300 print:text-gray-700">{v}</span>
              </div>
            ))}
          </div>
        </Section>

        {/* Footer */}
        <div className="border-t border-gray-200 dark:border-gray-800 print:border-gray-300 pt-5 text-center space-y-1">
          <p className="font-bold text-gray-700 dark:text-gray-200 print:text-black">Ella Edge EMS</p>
          <p className="text-xs text-gray-500 print:text-gray-500">
            Entwickelt von Sailer Engineering · www.sailersoft.com
          </p>
          <p className="text-[10px] text-gray-400 dark:text-gray-700 print:text-gray-400 mt-2">
            Ella_EMS_Doc1 · Entwurf · Alle Angaben ohne Gewähr · Änderungen vorbehalten
          </p>
        </div>

      </div>
    </div>
  )
}
