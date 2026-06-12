// Parse a UTC timestamp from the DB into a local Date object.
// Handles both "2026-06-12T15:20:33Z" (API) and "2026-06-12 15:20:33" (SQLite datetime()).
export function utcToDate(ts: string): Date {
  if (!ts) return new Date(NaN)
  const s = ts.replace(' ', 'T')
  return new Date(s.endsWith('Z') || s.includes('+') ? s : s + 'Z')
}

// Format a UTC timestamp string as local time HH:MM:SS
export function fmtLocalTime(ts: string): string {
  const d = utcToDate(ts)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleTimeString('de-AT')
}

// Format a UTC timestamp string as local date+time
export function fmtLocalDateTime(ts: string): string {
  const d = utcToDate(ts)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleString('de-AT')
}
