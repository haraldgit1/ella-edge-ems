import { useState, useEffect } from 'react'
import { usePolling } from '../hooks/usePolling'
import { api } from '../api/client'
import { EnergyMixBar } from '../components/EnergyMixBar'
import { Tile } from '../components/Tile'

const DEMO_PARTICIPANTS = [
  { id: 'part-01', name: 'Familie Müller (Top 1)' },
  { id: 'part-02', name: 'Hr. Schmidt (Top 2)' },
  { id: 'part-03', name: 'Fr. Berger (Top 3)' },
  { id: 'part-04', name: 'Familie Wagner (Top 4)' },
]

export default function ResidentDashboard() {
  const [selectedId, setSelectedId] = useState(DEMO_PARTICIPANTS[0].id)

  const { data, error, loading } = usePolling(
    () => api.dashboardResident(selectedId),
    10000
  )

  if (error) return (
    <div className="text-red-600 dark:text-red-400 bg-red-900/20 rounded-xl p-4 border border-red-200 dark:border-red-800">
      Fehler: {error}
    </div>
  )

  const today = data?.today
  const month = data?.month

  return (
    <div className="space-y-6 max-w-2xl">

      {/* Participant selector */}
      <div className="flex items-center gap-4">
        <h1 className="text-xl font-semibold">Mein Strommix</h1>
        <select
          className="ml-auto bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-1.5 text-sm text-gray-700 dark:text-gray-200 focus:outline-none focus:border-gray-500"
          value={selectedId}
          onChange={e => setSelectedId(e.target.value)}
        >
          {DEMO_PARTICIPANTS.map(p => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>

      {/* Current power */}
      {data?.current_power_w != null && (
        <div className="bg-white dark:bg-gray-900 rounded-xl p-4 border border-gray-200 dark:border-gray-800 flex items-center gap-4">
          <div className="w-3 h-3 rounded-full bg-green-400 animate-pulse" />
          <span className="text-sm text-gray-500 dark:text-gray-400">Aktueller Verbrauch</span>
          <span className="font-bold text-gray-900 dark:text-white">{Math.round(data.current_power_w)} W</span>
          <span className={`ml-auto text-xs px-2 py-0.5 rounded-full border ${
            data.meter_quality === 'OK'
              ? 'bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400 border-green-200 dark:border-green-800'
              : 'bg-yellow-900/30 text-yellow-600 dark:text-yellow-400 border-yellow-800'
          }`}>{data.meter_quality}</span>
        </div>
      )}

      {/* Heute – Energy Mix */}
      <div className="bg-white dark:bg-gray-900 rounded-xl p-5 border border-gray-200 dark:border-gray-800 space-y-4">
        <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Heute</p>

        <EnergyMixBar localPct={today?.coverage_pct ?? 0} />

        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-3">
            <p className="text-xs text-gray-500 mb-1">Gesamtverbrauch</p>
            <p className="text-lg font-bold">{today?.consumption_kwh ?? '—'} <span className="text-sm font-normal text-gray-500 dark:text-gray-400">kWh</span></p>
          </div>
          <div className="bg-green-900/20 border border-green-900/40 rounded-lg p-3">
            <p className="text-xs text-gray-500 mb-1">Lokaler Gemeinschaftsstrom</p>
            <p className="text-lg font-bold text-green-600 dark:text-green-400">{today?.local_kwh ?? '—'} <span className="text-sm font-normal text-gray-500 dark:text-gray-400">kWh</span></p>
          </div>
          <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-3">
            <p className="text-xs text-gray-500 mb-1">Ergänzung aus Netz</p>
            <p className="text-lg font-bold text-gray-600 dark:text-gray-300">{today?.grid_kwh ?? '—'} <span className="text-sm font-normal text-gray-500 dark:text-gray-400">kWh</span></p>
          </div>
          <div className="bg-blue-900/20 border border-blue-900/40 rounded-lg p-3">
            <p className="text-xs text-gray-500 mb-1">Geschätzter Vorteil</p>
            <p className="text-lg font-bold text-blue-600 dark:text-blue-400">
              {today?.savings_eur != null ? `${today.savings_eur.toFixed(2)} €` : '—'}
            </p>
          </div>
        </div>

        {today && (
          <p className="text-xs text-gray-500 dark:text-gray-600">
            Lokaler Deckungsgrad heute: {today.coverage_pct}% – {
              today.coverage_pct >= 60 ? 'Sehr gute lokale Versorgung.' :
              today.coverage_pct >= 30 ? 'Gute lokale Versorgung.' :
              'Geringe lokale Versorgung (typisch Winter/bewölkt).'
            }
          </p>
        )}
      </div>

      {/* Monat */}
      <div className="bg-white dark:bg-gray-900 rounded-xl p-5 border border-gray-200 dark:border-gray-800 space-y-3">
        <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Laufender Monat</p>
        <EnergyMixBar localPct={month?.coverage_pct ?? 0} />
        <div className="grid grid-cols-3 gap-3 text-sm">
          <div className="text-center">
            <p className="text-xs text-gray-500">Verbrauch</p>
            <p className="font-bold">{month?.consumption_kwh ?? '—'} kWh</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-green-600 dark:text-green-500">Lokal</p>
            <p className="font-bold text-green-600 dark:text-green-400">{month?.local_kwh ?? '—'} kWh</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-gray-500">Netz</p>
            <p className="font-bold text-gray-600 dark:text-gray-300">{month?.grid_kwh ?? '—'} kWh</p>
          </div>
        </div>
      </div>

      {/* Tariff info */}
      {data?.tariff && (
        <p className="text-xs text-gray-500 dark:text-gray-600">
          Tarif: Lokal {data.tariff.local_ct} ct/kWh · Netz {data.tariff.grid_ct} ct/kWh
        </p>
      )}

    </div>
  )
}
