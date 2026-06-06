import { useEffect, useState } from 'react'
import { api } from '../api/client'

export default function Participants() {
  const [rows, setRows] = useState<any[]>([])

  useEffect(() => { api.participants().then(setRows).catch(console.error) }, [])

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Teilnehmer</h1>
      <div className="overflow-x-auto rounded-xl border border-gray-800">
        <table className="w-full text-sm">
          <thead className="bg-gray-900 text-gray-400 text-xs uppercase">
            <tr>
              {['Name', 'Status', 'Zähler', 'Tarif', 'Aktiv seit'].map(h => (
                <th key={h} className="px-4 py-3 text-left">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.id} className="border-t border-gray-800 hover:bg-gray-900/50">
                <td className="px-4 py-3 font-medium">{r.display_name}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                    r.participant_status === 'BPLUS'
                      ? 'bg-green-900/40 text-green-400'
                      : 'bg-gray-800 text-gray-400'
                  }`}>
                    {r.participant_status === 'BPLUS' ? 'B+' : 'B−'}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-400 font-mono text-xs">{r.meter_id ?? '—'}</td>
                <td className="px-4 py-3 text-gray-400 text-xs">{r.tariff_id ?? '—'}</td>
                <td className="px-4 py-3 text-gray-400 text-xs">{r.valid_from}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-600">Keine Daten</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
