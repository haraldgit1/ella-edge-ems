const BASE = '/ella_ems/api'

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

async function put<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'PUT',
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
  meterHistory:        (id: string, rangeS: number) => get<any[]>(`/meters/${id}/history?range=${rangeS}`),
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
  reportDownloadUrl:      (id: string) => `/ella_ems/api/reports/${id}/download`,

  // ── MDM ────────────────────────────────────────────────────────────────────
  mdmParticipants:   (params = '') => get<any[]>(`/mdm/participants${params}`),
  mdmParticipant:    (id: string)  => get<any>(`/mdm/participants/${id}`),
  mdmParticipantCreate: (body: object) => post<any>('/mdm/participants', body),
  mdmParticipantUpdate: (id: string, body: object) => put<any>(`/mdm/participants/${id}`, body),
  mdmParticipantDelete: (id: string) => fetch(`${BASE}/mdm/participants/${id}`, { method: 'DELETE' }).then(r => r.json()),

  mdmDevices:   (params = '')  => get<any[]>(`/mdm/devices${params}`),
  mdmDevice:    (id: string)   => get<any>(`/mdm/devices/${id}`),
  mdmDeviceCreate: (body: object) => post<any>('/mdm/devices', body),
  mdmDeviceUpdate: (id: string, body: object) => put<any>(`/mdm/devices/${id}`, body),
  mdmDeviceDelete: (id: string) => fetch(`${BASE}/mdm/devices/${id}`, { method: 'DELETE' }).then(r => r.json()),

  mdmSmartmeterLog:       (params = '') => get<any[]>(`/mdm/smartmeter-log${params}`),
  mdmSmartmeterLogUpdate: (id: number, body: object) => put<any>(`/mdm/smartmeter-log/${id}`, body),
  mdmSmartmeterLogDelete: (id: number) => fetch(`${BASE}/mdm/smartmeter-log/${id}`, { method: 'DELETE' }).then(r => r.json()),
}
