import { useNavigate } from 'react-router-dom'

const IMG_BASE = '/ella_ems/docs/images'

function DocImage({
  src, alt, caption, description,
}: {
  src: string; alt: string; caption: string; description: string
}) {
  return (
    <figure className="space-y-3">
      <div className="rounded-xl overflow-hidden border border-gray-300 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 print:border-gray-300">
        <img
          src={src}
          alt={alt}
          className="w-full object-cover"
          onError={e => {
            const el = e.currentTarget
            el.style.display = 'none'
            const placeholder = el.nextElementSibling as HTMLElement | null
            if (placeholder) placeholder.style.display = 'flex'
          }}
        />
        {/* Platzhalter wenn Bild fehlt */}
        <div
          className="hidden h-48 items-center justify-center text-gray-500 dark:text-gray-600 text-sm flex-col gap-2"
          aria-hidden
        >
          <span className="text-3xl">🖼</span>
          <span className="font-mono text-xs">{src.split('/').pop()}</span>
          <span>Bild noch nicht hochgeladen</span>
        </div>
      </div>
      <figcaption className="space-y-1">
        <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 print:text-gray-500 uppercase tracking-wide">
          {caption}
        </p>
        <p className="text-sm text-gray-600 dark:text-gray-300 print:text-gray-700 leading-relaxed">
          {description}
        </p>
      </figcaption>
    </figure>
  )
}

export default function EllaEmsDoc2() {
  const navigate = useNavigate()

  return (
    <div className="max-w-4xl mx-auto space-y-2">

      {/* Toolbar */}
      <div className="flex items-center justify-between print:hidden mb-4">
        <button
          onClick={() => navigate('/documents')}
          className="text-xs text-gray-500 hover:text-gray-300 flex items-center gap-1"
        >
          ← Dokumente
        </button>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500 dark:text-gray-600 font-mono">Ella_EMS_Doc2 · Entwurf</span>
          <button
            onClick={() => window.print()}
            className="text-xs bg-green-100 dark:bg-green-900/40 border border-green-300 dark:border-green-700 text-green-600 dark:text-green-400 px-3 py-1.5 rounded-lg hover:bg-green-100 dark:hover:bg-green-900/60 transition-colors"
          >
            Drucken / PDF
          </button>
        </div>
      </div>

      {/* Dokument-Body */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-8 print:p-0 print:bg-white print:border-0 print:text-black space-y-10">

        {/* Header */}
        <div className="text-center space-y-3 pb-6 border-b border-gray-200 dark:border-gray-800 print:border-gray-300">
          <div className="text-xs font-mono text-green-600 dark:text-green-500 print:text-green-700 tracking-widest uppercase">
            Produkt-Präsentation · Screenshots & Referenzbilder
          </div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white print:text-black leading-tight">
            Ella Edge EMS — Das System im Überblick
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 print:text-gray-600 max-w-2xl mx-auto">
            Visuelle Übersicht des Ella Edge EMS: Betreiber-Dashboard, Simulationsumgebung,
            Systemkomponenten und reale Installationsbeispiele.
          </p>
        </div>

        {/* Abschnitt 1: PV-Anlage */}
        <section className="space-y-6 print:break-inside-avoid">
          <div className="border-l-4 border-green-400 dark:border-green-600 pl-4">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white print:text-black">
              1 &nbsp; Die Basis: Photovoltaikanlage mit Batteriespeicher
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 print:text-gray-600 mt-1">
              Ella Edge EMS setzt auf einer bestehenden oder neu geplanten PV-Anlage mit
              Wechselrichter und Batteriespeicher auf — ohne Eingriff in die bestehende
              Elektroinstallation der Wohneinheiten.
            </p>
          </div>
          <DocImage
            src={`${IMG_BASE}/pv-anlage.jpg`}
            alt="Photovoltaikanlage auf Mehrparteienwohnanlage"
            caption="Abb. 1 — PV-Anlage auf Mehrparteiengebäude"
            description={
              'Eine typische PV-Anlage auf einem Mehrparteienwohnhaus mit 20–50 kWp Leistung ' +
              'und 15–30 kWh Batteriespeicher bildet die Grundlage für Ella Edge EMS. ' +
              'Das System übernimmt die intelligente Verteilung der lokal erzeugten Energie ' +
              'an teilnehmende Bewohner (B+) in Echtzeit.'
            }
          />
        </section>

        {/* Abschnitt 2: SmartMeter */}
        <section className="space-y-6 print:break-inside-avoid">
          <div className="border-l-4 border-blue-400 dark:border-blue-600 pl-4">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white print:text-black">
              2 &nbsp; Zählerinfrastruktur: Landis+Gyr SmartMeter
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 print:text-gray-600 mt-1">
              Je Wohneinheit wird ein geeichter SmartMeter installiert, der alle 10 Sekunden
              den Momentanverbrauch per Hardware-Push an Ella Edge EMS meldet. Kein Cloud-Weg,
              kein Polling — direkter Push in das lokale EMS.
            </p>
          </div>
          <DocImage
            src={`${IMG_BASE}/smartmeter-landis-gyr.jpg`}
            alt="Landis und Gyr SmartMeter"
            caption="Abb. 2 — Landis+Gyr SmartMeter (Beispiel E350 / MAP120)"
            description={
              'Der Landis+Gyr SmartMeter meldet Wirkleistung (Pact in kW) mit Zeitstempel (LDT) ' +
              'und Geräte-ID (CID) direkt an den /smartmeter-Endpunkt von Ella Edge EMS. ' +
              'Die CID-zu-Meter-Zuordnung erfolgt einmalig in der Stammdatenverwaltung — ' +
              'danach läuft die Kommunikation vollautomatisch.'
            }
          />
        </section>

        {/* Abschnitt 3: Betreiber-Dashboard */}
        <section className="space-y-6 print:break-inside-avoid">
          <div className="border-l-4 border-amber-500 pl-4">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white print:text-black">
              3 &nbsp; Betreiber-Dashboard — Echtzeit-Übersicht
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 print:text-gray-600 mt-1">
              Das Betreiber-Dashboard gibt der Hausverwaltung einen vollständigen Echtzeit-Überblick
              über Energieflüsse, Batteriezustand, Netz-Bezug und aktive Alarme — jederzeit
              im Browser, ohne App-Installation.
            </p>
          </div>
          <DocImage
            src={`${IMG_BASE}/dashboard-operator.png`}
            alt="Ella EMS Betreiber-Dashboard Screenshot"
            caption="Abb. 3 — Betreiber-Dashboard: Leistungsverlauf, Live-Kacheln und Regelstatus"
            description={
              'Oben: Live-Kacheln für B+/H+-Gesamtverbrauch, PV-Leistung, Batterie-SOC, ' +
              'Deckungsgrad, Netzeinspeisung und Zählerstatus. ' +
              'Mitte: Leistungsverlauf (B+, PV, Netz-Bezug, Batterie-SOC) über wählbare ' +
              'Zeitfenster von 5 Minuten bis 24 Stunden — mit optionaler Teilnehmer-Overlay-Linie ' +
              'für die Einzelansicht eines Bewohners. ' +
              'Unten: Letzte Regelentscheidung des Inverter-Controllers mit Grund-Code und Istwert.'
            }
          />
        </section>

        {/* Abschnitt 4: Simulation */}
        <section className="space-y-6 print:break-inside-avoid">
          <div className="border-l-4 border-purple-500 pl-4">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white print:text-black">
              4 &nbsp; Simulationsumgebung — Demo ohne Produktivanlage
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 print:text-gray-600 mt-1">
              Ella Edge EMS enthält eine vollständige Simulationsumgebung: PV-Leistung, Batteriezustand
              und Einzelverbrauch aller Bewohner werden per Slider konfiguriert und live in die
              EMS-Datenbank geschrieben — ideal für Verkaufspräsentationen und Schulungen.
            </p>
          </div>
          <DocImage
            src={`${IMG_BASE}/dashboard-simulation.png`}
            alt="Ella EMS Simulation Dashboard Screenshot"
            caption="Abb. 4 — Simulationsdashboard: Energiefluss-Visualisierung und Hardware-Push-Test"
            description={
              'Links: Konfigurierbare Parameter — PV-Leistung (kW), Batterie-SOC (%), ' +
              'Verbrauch je Bewohner (individuelle Slider bis max_load_w), ' +
              'B+/B–-Status pro Einheit, H+-Wärmepumpe. ' +
              'Mitte: Live-Energieflussdiagramm (PV → Batterie → B+ → Netz). ' +
              'Rechts: Hardware-Push-Modus — sendet Echtzeitwerte per SmartMeter-Protokoll ' +
              'an /ella_ems/smartmeter, als würde ein realer Zähler liefern. ' +
              'Die EMS-Datenbank und das Betreiber-Dashboard reagieren in Echtzeit.'
            }
          />
        </section>

        {/* Bildhinweis für Redaktion */}
        <div className="print:hidden bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 text-sm space-y-2">
          <p className="text-amber-600 dark:text-amber-400 font-medium">Bildverwaltung</p>
          <p className="text-gray-500 dark:text-gray-400">
            Bilder in <code className="bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded text-amber-700 dark:text-amber-300 text-xs">docs/images/</code> ablegen
            — sofort sichtbar ohne Rebuild oder Neustart:
          </p>
          <ul className="text-xs text-gray-500 space-y-1 font-mono">
            <li>docs/images/<span className="text-green-600 dark:text-green-400">dashboard-operator.png</span></li>
            <li>docs/images/<span className="text-green-600 dark:text-green-400">dashboard-simulation.png</span></li>
            <li>docs/images/<span className="text-green-600 dark:text-green-400">pv-anlage.jpg</span></li>
            <li>docs/images/<span className="text-green-600 dark:text-green-400">smartmeter-landis-gyr.jpg</span></li>
          </ul>
          <p className="text-gray-500 dark:text-gray-600 text-xs">
            Prod: <code>scp bild.png ella@www.sailersoft.com:~/app/ella_ems/docs/images/</code>
          </p>
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 dark:border-gray-800 print:border-gray-300 pt-5 text-center space-y-1">
          <p className="font-bold text-gray-700 dark:text-gray-200 print:text-black">Ella Edge EMS</p>
          <p className="text-xs text-gray-500 print:text-gray-500">
            Entwickelt von Sailer Engineering · www.sailersoft.com
          </p>
          <p className="text-[10px] text-gray-400 dark:text-gray-700 print:text-gray-400 mt-2">
            Ella_EMS_Doc2 · Entwurf · Alle Angaben ohne Gewähr · Änderungen vorbehalten
          </p>
        </div>

      </div>
    </div>
  )
}
