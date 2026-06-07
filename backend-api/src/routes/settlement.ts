import { Elysia, t } from 'elysia'
import { getDb } from '../db/init'

export const settlementRoutes = new Elysia({ prefix: '/api/settlement' })

  // ── List intervals for a month ─────────────────────────────────────────
  .get('/intervals', ({ query }) => {
    const db = getDb()
    const month = String(query.month ?? new Date().toISOString().slice(0, 7))
    const from = `${month}-01T00:00:00Z`
    const to   = nextMonthStart(month)
    return db.query(`
      SELECT * FROM settlement_intervals
      WHERE site_id = 'site-demo-01'
        AND interval_start_utc >= ? AND interval_start_utc < ?
      ORDER BY interval_start_utc DESC
    `).all(from, to)
  })

  // ── Monthly summary ────────────────────────────────────────────────────
  .get('/summary', ({ query }) => {
    const db = getDb()
    const month = String(query.month ?? new Date().toISOString().slice(0, 7))
    const from = `${month}-01T00:00:00Z`
    const to   = nextMonthStart(month)

    const totals = db.query(`
      SELECT
        COUNT(*) AS interval_count,
        COALESCE(SUM(bplus_consumption_wh),     0) AS bplus_wh,
        COALESCE(SUM(local_energy_available_wh),0) AS local_wh,
        COALESCE(SUM(grid_energy_bplus_wh),     0) AS grid_wh,
        COALESCE(AVG(local_allocation_factor),  0) AS avg_factor,
        SUM(CASE WHEN plausibility_status='OK'      THEN 1 ELSE 0 END) AS ok_count,
        SUM(CASE WHEN plausibility_status='WARNING' THEN 1 ELSE 0 END) AS warn_count,
        SUM(CASE WHEN plausibility_status='FAILED'  THEN 1 ELSE 0 END) AS fail_count,
        SUM(CASE WHEN plausibility_status='PENDING' THEN 1 ELSE 0 END) AS pending_count,
        SUM(CASE WHEN settlement_status='APPROVED'  THEN 1 ELSE 0 END) AS approved_count
      FROM settlement_intervals
      WHERE site_id = 'site-demo-01'
        AND interval_start_utc >= ? AND interval_start_utc < ?
    `).get(from, to) as any

    // Per-participant summary
    const participants = db.query(`
      SELECT
        p.id, p.display_name, p.participant_status,
        COALESCE(SUM(spa.consumption_wh),   0) AS consumption_wh,
        COALESCE(SUM(spa.local_energy_wh),  0) AS local_wh,
        COALESCE(SUM(spa.grid_energy_wh),   0) AS grid_wh,
        COALESCE(AVG(spa.local_coverage_percent), 0) AS avg_coverage
      FROM participants p
      LEFT JOIN settlement_participant_allocations spa ON spa.participant_id = p.id
      LEFT JOIN settlement_intervals si ON si.id = spa.settlement_interval_id
        AND si.interval_start_utc >= ? AND si.interval_start_utc < ?
      WHERE p.site_id = 'site-demo-01' AND p.is_active = 1
      GROUP BY p.id
      ORDER BY p.participant_status DESC, p.display_name
    `).all(from, to) as any[]

    const canApprove =
      totals.interval_count > 0 &&
      totals.fail_count === 0 &&
      totals.pending_count === 0 &&
      totals.approved_count < totals.interval_count

    return {
      month,
      totals: {
        interval_count:  totals.interval_count,
        bplus_kwh:       wh2kwh(totals.bplus_wh),
        local_kwh:       wh2kwh(totals.local_wh),
        grid_kwh:        wh2kwh(totals.grid_wh),
        avg_coverage_pct: Math.round(totals.avg_factor * 100),
        ok_count:        totals.ok_count,
        warn_count:      totals.warn_count,
        fail_count:      totals.fail_count,
        pending_count:   totals.pending_count,
        approved_count:  totals.approved_count,
      },
      can_approve: canApprove,
      participants: participants.map(p => ({
        id:               p.id,
        display_name:     p.display_name,
        status:           p.participant_status,
        consumption_kwh:  wh2kwh(p.consumption_wh),
        local_kwh:        wh2kwh(p.local_wh),
        grid_kwh:         wh2kwh(p.grid_wh),
        coverage_pct:     Math.round(p.avg_coverage),
      })),
    }
  })

  // ── Plausibility report ────────────────────────────────────────────────
  .get('/plausibility', ({ query }) => {
    const db = getDb()
    const month = String(query.month ?? new Date().toISOString().slice(0, 7))
    const from = `${month}-01T00:00:00Z`
    const to   = nextMonthStart(month)

    const intervals = db.query(`
      SELECT id, interval_start_utc, interval_end_utc,
             bplus_consumption_wh, local_energy_available_wh,
             local_allocation_factor, settlement_status, plausibility_status
      FROM settlement_intervals
      WHERE site_id = 'site-demo-01'
        AND interval_start_utc >= ? AND interval_start_utc < ?
      ORDER BY interval_start_utc DESC
    `).all(from, to) as any[]

    // Check for missing intervals (should have 96/day * days in month)
    const expectedCount = expectedIntervals(month)
    const missing = expectedCount - intervals.length

    // Check for intervals with issues
    const issues = intervals.filter(i =>
      i.plausibility_status === 'FAILED' || i.plausibility_status === 'WARNING'
    )

    const overallStatus =
      intervals.some(i => i.plausibility_status === 'FAILED') ? 'FAILED' :
      missing > 0 || intervals.some(i => i.plausibility_status === 'WARNING') ? 'WARNING' :
      intervals.length === 0 ? 'PENDING' : 'OK'

    return {
      month,
      overall_status: overallStatus,
      checks: {
        intervals_expected: expectedCount,
        intervals_found:    intervals.length,
        intervals_missing:  missing,
        failed:             intervals.filter(i => i.plausibility_status === 'FAILED').length,
        warnings:           intervals.filter(i => i.plausibility_status === 'WARNING').length,
        ok:                 intervals.filter(i => i.plausibility_status === 'OK').length,
        pending:            intervals.filter(i => i.plausibility_status === 'PENDING').length,
      },
      issues: issues.slice(0, 20),
    }
  })

  // ── Approve a month ────────────────────────────────────────────────────
  .post('/approve', ({ body }: { body: any }) => {
    const db = getDb()
    const month = String(body?.month ?? new Date().toISOString().slice(0, 7))
    const from = `${month}-01T00:00:00Z`
    const to   = nextMonthStart(month)

    // Only approve if no FAILED intervals
    const failed = (db.query(`
      SELECT COUNT(*) as n FROM settlement_intervals
      WHERE site_id='site-demo-01' AND interval_start_utc >= ? AND interval_start_utc < ?
        AND plausibility_status = 'FAILED'
    `).get(from, to) as any).n

    if (failed > 0) {
      return { error: `Cannot approve: ${failed} intervals with FAILED plausibility` }
    }

    const result = db.query(`
      UPDATE settlement_intervals
      SET settlement_status = 'APPROVED',
          approved_at = datetime('now'),
          approved_by = 'operator'
      WHERE site_id = 'site-demo-01'
        AND interval_start_utc >= ? AND interval_start_utc < ?
        AND settlement_status = 'CALCULATED'
    `).run(from, to)

    return {
      ok: true,
      month,
      approved_count: (result as any).changes ?? 0,
    }
  }, { body: t.Optional(t.Object({ month: t.Optional(t.String()) })) })


// ── Helpers ──────────────────────────────────────────────────────────────
function wh2kwh(wh: number): number {
  return Math.round(wh / 10) / 100
}

function nextMonthStart(month: string): string {
  const [y, m] = month.split('-').map(Number)
  const next = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`
  return `${next}-01T00:00:00Z`
}

function expectedIntervals(month: string): number {
  const [y, m] = month.split('-').map(Number)
  const daysInMonth = new Date(y, m, 0).getDate()
  const today = new Date()
  const isCurrentMonth = today.getFullYear() === y && today.getMonth() + 1 === m
  if (isCurrentMonth) {
    const elapsed = today.getDate() - 1
    const hours = today.getUTCHours()
    const mins  = today.getUTCMinutes()
    return elapsed * 96 + Math.floor((hours * 60 + mins) / 15)
  }
  return daysInMonth * 96
}
