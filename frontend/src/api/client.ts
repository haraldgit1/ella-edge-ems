const BASE = '/api'

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`)
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${path}`)
  return res.json()
}

async function post<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${path}`)
  return res.json()
}

export const api = {
  health:              () => get<any>('/health'),
  dashboardOperator:   (rangeS = 1800) => get<any>(`/dashboard/operator?range=${rangeS}`),
  dashboardResident:   (id: string) => get<any>(`/dashboard/resident/${id}`),
  dashboardDevices:    () => get<any>('/dashboard/devices'),
  participants:        () => get<any[]>('/participants'),
  meters:              () => get<any[]>('/meters/status'),
  alarms:              () => get<any[]>('/alarms'),
  activeAlarms:        () => get<any[]>('/alarms/active'),
  ackAlarm:            (id: number) => post<any>(`/alarms/${id}/ack`),
  closeAlarm:          (id: number) => post<any>(`/alarms/${id}/close`),
  controlDecisions:    (limit = 20) => get<any[]>(`/control-decisions?limit=${limit}`),
  latestDecision:      () => get<any>('/control-decisions/latest'),
  settlementIntervals:    (month: string) => get<any[]>(`/settlement/intervals?month=${month}`),
  settlementSummary:      (month: string) => get<any>(`/settlement/summary?month=${month}`),
  settlementPlausibility: (month: string) => get<any>(`/settlement/plausibility?month=${month}`),
  settlementApprove:      (month: string) => post<any>('/settlement/approve', { month }),
  reports:                () => get<any[]>('/reports'),
  reportGenerate:         (body: object) => post<any>('/reports/generate', body),
  reportStatus:           (id: string) => get<any>(`/reports/${id}/status`),
  reportDownloadUrl:      (id: string) => `/api/reports/${id}/download`,
}
