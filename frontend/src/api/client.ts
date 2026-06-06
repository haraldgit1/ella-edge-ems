const BASE = '/api'

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`)
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${path}`)
  return res.json()
}

export const api = {
  health: () => get<{ status: string; version: string; simulation_mode: boolean }>('/health'),
  dashboard: () => get<any>('/dashboard/operator'),
  participants: () => get<any[]>('/participants'),
  meters: () => get<any[]>('/meters/status'),
  alarms: () => get<any[]>('/alarms/active'),
  controlDecisions: (limit = 20) => get<any[]>(`/control-decisions?limit=${limit}`),
  latestDecision: () => get<any>('/control-decisions/latest'),
}
