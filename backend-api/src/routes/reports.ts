import { Elysia, t } from 'elysia'
import { readFileSync, existsSync } from 'fs'
import { getDb } from '../db/init'

const REPORTS_DIR = process.env.REPORTS_DIR ?? '/reports'
const SITE_ID     = 'site-demo-01'

const REPORT_TYPES = ['RESIDENT_MONTHLY', 'OPERATOR_MONTHLY', 'CSV_DETAIL', 'DIAGNOSTICS'] as const

function makeId(): string {
  return `rpt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

function mimeFor(fmt: string): string {
  if (fmt === 'PDF') return 'application/pdf'
  if (fmt === 'CSV') return 'text/csv; charset=utf-8'
  if (fmt === 'ZIP') return 'application/zip'
  return 'application/octet-stream'
}

function extFor(fmt: string): string {
  if (fmt === 'PDF') return 'pdf'
  if (fmt === 'CSV') return 'csv'
  if (fmt === 'ZIP') return 'zip'
  return 'bin'
}

export const reportRoutes = new Elysia({ prefix: '/api/reports' })

  // ── List reports ─────────────────────────────────────────────────────
  .get('/', () => {
    const db = getDb()
    return db.query(`
      SELECT r.*, p.display_name as participant_name
      FROM reports r
      LEFT JOIN participants p ON p.id = r.participant_id
      WHERE r.site_id = ?
      ORDER BY r.created_at DESC
      LIMIT 100
    `).all(SITE_ID)
  })

  // ── Request report generation ─────────────────────────────────────
  .post('/generate', ({ body }: { body: any }) => {
    const db    = getDb()
    const rtype = String(body?.report_type ?? '')
    const month = String(body?.month ?? new Date().toISOString().slice(0, 7))
    const date  = body?.date ? String(body.date) : null   // YYYY-MM-DD optional
    const partId = body?.participant_id ?? null
    const includeDetail = body?.include_detail !== false  // default true

    if (!REPORT_TYPES.includes(rtype as any)) {
      return { error: `Invalid report_type. Valid: ${REPORT_TYPES.join(', ')}` }
    }
    if (rtype === 'RESIDENT_MONTHLY' && !partId) {
      return { error: 'participant_id required for RESIDENT_MONTHLY' }
    }

    const id   = makeId()
    let from: string, to: string
    if (date) {
      from = date
      to   = nextDayStart(date)
    } else {
      from = `${month}-01`
      to   = nextMonthStart(month).slice(0, 10)
    }
    const params = JSON.stringify({ include_detail: includeDetail })

    db.query(`
      INSERT INTO reports
        (id, site_id, report_type, period_from, period_to, participant_id,
         file_format, status, created_by, params)
      VALUES (?,?,?,?,?,?,?,?,?,?)
    `).run(id, SITE_ID, rtype, from, to, partId,
           rtype === 'CSV_DETAIL' ? 'CSV' : rtype === 'DIAGNOSTICS' ? 'ZIP' : 'PDF',
           'PENDING', 'operator', params)

    return { id, status: 'PENDING', report_type: rtype, month, date }
  }, {
    body: t.Object({
      report_type:    t.String(),
      month:          t.Optional(t.String()),
      date:           t.Optional(t.String()),
      participant_id: t.Optional(t.String()),
      include_detail: t.Optional(t.Boolean()),
    })
  })

  // ── Download a completed report ───────────────────────────────────
  .get('/:id/download', ({ params, set }) => {
    const db  = getDb()
    const row = db.query('SELECT * FROM reports WHERE id=?').get(params.id) as any

    if (!row) { set.status = 404; return 'Not found' }
    if (row.status !== 'COMPLETED') { set.status = 202; return `Report status: ${row.status}` }
    if (!row.file_path || !existsSync(row.file_path)) {
      set.status = 404; return 'File not found on disk'
    }

    const data = readFileSync(row.file_path)
    const fmt  = row.file_format ?? 'PDF'
    const periodStr = row.period_to && row.period_from
      && new Date(row.period_to).getTime() - new Date(row.period_from).getTime() <= 86400000
      ? row.period_from                   // single day → YYYY-MM-DD
      : row.period_from?.slice(0, 7)      // month → YYYY-MM
    const name = `ella-${row.report_type.toLowerCase()}-${periodStr ?? 'export'}.${extFor(fmt)}`

    set.headers = {
      'Content-Type':        mimeFor(fmt),
      'Content-Disposition': `attachment; filename="${name}"`,
      'Content-Length':      String(data.length),
    }
    return data
  })

  // ── Status of a single report ─────────────────────────────────────
  .get('/:id/status', ({ params }) => {
    const db  = getDb()
    const row = db.query('SELECT id, status, report_type, created_at, completed_at FROM reports WHERE id=?').get(params.id)
    return row ?? { error: 'Not found' }
  })


function nextMonthStart(month: string): string {
  const [y, m] = month.split('-').map(Number)
  return m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`
}

function nextDayStart(date: string): string {
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + 1)
  return d.toISOString().slice(0, 10)
}
