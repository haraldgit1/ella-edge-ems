const DOCUMENTS = [
  {
    id:       'ella-ems-doc1',
    name:     'Ella_EMS_Doc1',
    title:    'Leistungsbeschreibung Ella Edge EMS',
    type:     'Produkt-Flyer',
    audience: 'Geschäftspartner / Vertrieb',
    description: 'Nutzen für Bewohner, Betreiber und Systemlösungsanbieter. Positionierung, USPs und technische Highlights von Ella Edge EMS.',
    status:   'Entwurf',
  },
  {
    id:       'ella-ems-doc2',
    name:     'Ella_EMS_Doc2',
    title:    'Das System im Überblick — Screenshots & Referenzbilder',
    type:     'Produkt-Präsentation',
    audience: 'Geschäftspartner / Vertrieb',
    description: 'Visuelle Darstellung: Betreiber-Dashboard, Simulationsumgebung, PV-Anlage und SmartMeter mit Bildbeschreibungen.',
    status:   'Entwurf',
  },
  {
    id:       'ella-ems-doc3',
    name:     'Ella_EMS_Doc3',
    title:    'Ella Edge EMS — Vollständige Produktübersicht',
    type:     'Produkt-Kombidokument',
    audience: 'Geschäftspartner / Vertrieb / Technik',
    description: 'Kombination aus Text und Bild: alle drei Zielgruppen (Bewohner, Betreiber, Systemlösungsanbieter), Nutzenargumente, Screenshots, SmartMeter-Integration und technische Eckdaten.',
    status:   'Entwurf',
  },
  {
    id:       'ella-ems-doc4',
    name:     'Ella_EMS_Doc4',
    title:    'Ella Edge EMS — Premium-Flyer im BMW-Stil',
    type:     'Marketing-Prospekt',
    audience: 'Geschäftspartner / Vertrieb',
    description: 'Hochwertiger Produkt-Flyer im Stil eines BMW-Prospekts: präzise Typografie (Helvetica Neue), BMW-Blau als Akzentfarbe, Kennzahlen-Block, Drei-Säulen-Layout und dunkler Footer-Band.',
    status:   'Entwurf',
  },
]

export default function DocumentsOverview() {
  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-xl font-semibold">Dokumente</h1>
        <p className="text-sm text-gray-500 mt-1">
          Produktunterlagen, Flyer und Leistungsbeschreibungen — ansehen und als PDF drucken.
        </p>
      </div>

      <div className="space-y-3">
        {DOCUMENTS.map(doc => (
          <a
            key={doc.id}
            href={`/ella_ems/documents/${doc.id}`}
            className="block bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5 hover:border-green-300 dark:hover:border-green-800 hover:bg-gray-100 dark:hover:bg-gray-900/70 transition-colors group"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-xs text-gray-500">{doc.name}</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800">
                    {doc.type}
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
                    {doc.status}
                  </span>
                </div>
                <p className="font-medium text-gray-800 dark:text-gray-100 group-hover:text-green-600 dark:group-hover:text-green-400 transition-colors">
                  {doc.title}
                </p>
                <p className="text-sm text-gray-500">{doc.description}</p>
                <p className="text-xs text-gray-500 dark:text-gray-600">Zielgruppe: {doc.audience}</p>
              </div>
              <span className="text-gray-500 dark:text-gray-600 group-hover:text-green-600 dark:group-hover:text-green-500 text-lg shrink-0 mt-1">→</span>
            </div>
          </a>
        ))}
      </div>

      <p className="text-xs text-gray-400 dark:text-gray-700">
        Jedes Dokument kann über den Browser-Druckdialog (Strg+P) als PDF gespeichert werden.
      </p>
    </div>
  )
}
