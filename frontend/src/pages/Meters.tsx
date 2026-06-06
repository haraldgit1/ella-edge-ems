import { useEffect, useState } from 'react'
import { api } from '../api/client'

export default function Meters() {
  const [rows, setRows] = useState<any[]>([])

  useEffect(() => { api.meters().then(setRows).catch(console.error) }, [])

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Zähler-Status</h1>
      <div className="overflow-x-auto rounded-xl border border-gray-800">
        <table className="w-full text-sm">
          <thead className="bg-gray-900 text-gray-400 text-xs uppercase">
            <tr>
              {['Zähler', 'Seriennr.', 'Protokoll', 'Leistung', 'Qualität', 'Letzter Wert'].map(h => (
                <th key={h} className="px-4 py-3 text-left">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.id} className="border-t border-gray-800 hover:bg-gray-900/50">
                <td className="px-4 py-3 font-mono text-xs">{r.id}</td>
                <td className="px-4 py-3 text-gray-400 text-xs">{r.serial_number}</td>
                <td className="px-4 py-3 text-gray-400 text-xs">{r.protocol}</td>
                <td className="px-4 py-3 font-medium">
                  {r.active_power_w != null ? `${Math.round(r.active_power_w)} W` : '—'}
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded text-xs ${
                    r.quality_flag === 'OK' ? 'bg-green-900/40 text-green-400' :
                    r.quality_flag === 'COMM_ERROR' ? 'bg-red-900/40 text-red-400' :
                    'bg-yellow-900/40 text-yellow-400'
                  }`}>{r.quality_flag ?? '—'}</span>
                </td>
                <td className="px-4 py-3 text-gray-500 text-xs">{r.last_reading?.slice(0, 19) ?? '—'}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-600">Keine Daten</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
