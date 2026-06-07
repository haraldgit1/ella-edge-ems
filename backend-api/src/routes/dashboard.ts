import { Elysia } from 'elysia'
import { getDb } from '../db/init'

export const dashboardRoutes = new Elysia({ prefix: '/api/dashboard' })

  .get('/operator', ({ query }: { query: Record<string, string> }) => {
    const db = getDb()

    const ps = db.query(
      "SELECT * FROM power_states ORDER BY timestamp_utc DESC LIMIT 1"
    ).get() as any

    const activeAlarms = (db.query(
      "SELECT COUNT(*) as count FROM alarms WHERE status = 'ACTIVE'"
    ).get() as any)?.count ?? 0

    const latestDecision = db.query(
      "SELECT * FROM control_decisions ORDER BY timestamp_utc DESC LIMIT 1"
    ).get() as any

    // Configurable history: ?range=<seconds>, default 1800 (30 min)
    // Always returns ~120 bucketed points regardless of range
    const rangeRaw = parseInt(query?.range ?? '1800')
    const rangeS   = Math.min(86400, Math.max(300, isNaN(rangeRaw) ? 1800 : rangeRaw))
    const bucketS  = Math.max(5, Math.round(rangeS / 120))

    // SQLite time-bucket aggregation: floor(unix_ts / bucket) * bucket → AVG per bucket
    const history = db.query(`
      SELECT
        datetime(
          CAST(strftime('%s', timestamp_utc) AS INTEGER) / ${bucketS} * ${bucketS},
          'unixepoch'
        ) AS timestamp_utc,
        ROUND(AVG(bplus_power_w),  1) AS bplus_power_w,
        ROUND(AVG(bminus_power_w), 1) AS bminus_power_w,
        ROUND(AVG(pv_power_w),     1) AS pv_power_w,
        ROUND(AVG(battery_soc_pct),1) AS battery_soc_pct
      FROM power_states
      WHERE site_id = 'site-demo-01'
        AND CAST(strftime('%s', timestamp_utc) AS INTEGER) >= strftime('%s', 'now') - ${rangeS}
      GROUP BY CAST(strftime('%s', timestamp_utc) AS INTEGER) / ${bucketS}
      ORDER BY timestamp_utc ASC
    `).all() as any[]

    // Today's totals from settlement
    const todaySettlement = db.query(`
      SELECT
        COALESCE(SUM(bplus_consumption_wh), 0)    as bplus_kwh,
        COALESCE(SUM(local_energy_available_wh), 0) as local_kwh,
        COALESCE(AVG(local_allocation_factor), 0) as avg_factor
      FROM settlement_intervals
      WHERE site_id = 'site-demo-01'
        AND interval_start_utc >= date('now')
    `).get() as any

    return {
      power_state: ps ?? null,
      active_alarms: activeAlarms,
      latest_decision: latestDecision ?? null,
      power_history: history,
      range_s:  rangeS,
      bucket_s: bucketS,
      today: {
        bplus_kwh: Math.round((todaySettlement?.bplus_kwh ?? 0) / 1000 * 100) / 100,
        local_kwh: Math.round((todaySettlement?.local_kwh ?? 0) / 1000 * 100) / 100,
        avg_coverage_pct: Math.round((todaySettlement?.avg_factor ?? 0) * 100),
      },
      timestamp: new Date().toISOString(),
    }
  })

  .get('/resident/:participantId', ({ params }) => {
    const db = getDb()

    const participant = db.query(
      "SELECT * FROM participants WHERE id = ?"
    ).get(params.participantId) as any

    if (!participant) return { error: 'Participant not found' }

    // Today's energy from settlement
    const today = db.query(`
      SELECT
        COALESCE(SUM(spa.consumption_wh), 0)   as consumption_wh,
        COALESCE(SUM(spa.local_energy_wh), 0)  as local_wh,
        COALESCE(SUM(spa.grid_energy_wh), 0)   as grid_wh,
        COALESCE(AVG(spa.local_coverage_percent), 0) as avg_coverage
      FROM settlement_participant_allocations spa
      JOIN settlement_intervals si ON si.id = spa.settlement_interval_id
      WHERE spa.participant_id = ?
        AND si.interval_start_utc >= date('now')
    `).get(params.participantId) as any

    // Current month
    const month = db.query(`
      SELECT
        COALESCE(SUM(spa.consumption_wh), 0)   as consumption_wh,
        COALESCE(SUM(spa.local_energy_wh), 0)  as local_wh,
        COALESCE(SUM(spa.grid_energy_wh), 0)   as grid_wh,
        COALESCE(AVG(spa.local_coverage_percent), 0) as avg_coverage
      FROM settlement_participant_allocations spa
      JOIN settlement_intervals si ON si.id = spa.settlement_interval_id
      WHERE spa.participant_id = ?
        AND si.interval_start_utc >= date('now', 'start of month')
    `).get(params.participantId) as any

    // Latest meter reading
    const meterLatest = participant.meter_id ? db.query(
      "SELECT active_power_w, timestamp_utc, quality_flag FROM measurements WHERE meter_id = ? ORDER BY timestamp_utc DESC LIMIT 1"
    ).get(participant.meter_id) as any : null

    // Tariff for savings calculation
    const tariff = participant.tariff_id ? db.query(
      "SELECT * FROM tariffs WHERE id = ?"
    ).get(participant.tariff_id) as any : null

    const toKwh = (wh: number) => Math.round(wh / 10) / 100

    const savings_today = tariff
      ? Math.round((today?.local_wh ?? 0) / 1000 * (tariff.grid_price_ct_per_kwh - tariff.local_price_ct_per_kwh - tariff.service_fee_ct_per_kwh)) / 100
      : null

    return {
      participant: {
        id: participant.id,
        display_name: participant.display_name,
        status: participant.participant_status,
      },
      today: {
        consumption_kwh: toKwh(today?.consumption_wh ?? 0),
        local_kwh: toKwh(today?.local_wh ?? 0),
        grid_kwh: toKwh(today?.grid_wh ?? 0),
        coverage_pct: Math.round(today?.avg_coverage ?? 0),
        savings_eur: savings_today,
      },
      month: {
        consumption_kwh: toKwh(month?.consumption_wh ?? 0),
        local_kwh: toKwh(month?.local_wh ?? 0),
        grid_kwh: toKwh(month?.grid_wh ?? 0),
        coverage_pct: Math.round(month?.avg_coverage ?? 0),
      },
      current_power_w: meterLatest?.active_power_w ?? null,
      meter_quality: meterLatest?.quality_flag ?? null,
      tariff: tariff ? {
        local_ct: tariff.local_price_ct_per_kwh,
        grid_ct: tariff.grid_price_ct_per_kwh,
      } : null,
    }
  })

  .get('/devices', () => {
    const db = getDb()

    const decision = db.query(
      "SELECT * FROM control_decisions ORDER BY timestamp_utc DESC LIMIT 1"
    ).get() as any

    const ps = db.query(
      "SELECT * FROM power_states ORDER BY timestamp_utc DESC LIMIT 1"
    ).get() as any

    const inverter = db.query(
      "SELECT * FROM devices WHERE device_type = 'INVERTER' AND is_active = 1 LIMIT 1"
    ).get() as any

    const battery = db.query(
      "SELECT * FROM devices WHERE device_type = 'BATTERY' AND is_active = 1 LIMIT 1"
    ).get() as any

    // Determine online status: last decision within 30s = online
    const lastTs = decision?.timestamp_utc
    const ageS = lastTs
      ? (Date.now() - new Date(lastTs.replace('Z', '+00:00')).getTime()) / 1000
      : 9999
    const inverterOnline = ageS < 30

    return {
      inverter: {
        ...inverter,
        online: inverterOnline,
        current_power_w: decision?.actual_inverter_power_w ?? null,
        last_setpoint_w: decision?.sent_setpoint_w ?? null,
        last_decision_reason: decision?.reason ?? null,
        last_seen: lastTs ?? null,
      },
      battery: {
        ...battery,
        online: inverterOnline,
        soc_pct: ps?.battery_soc_pct ?? null,
        last_seen: ps?.timestamp_utc ?? null,
      },
    }
  })
