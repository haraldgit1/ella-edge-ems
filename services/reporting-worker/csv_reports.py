"""CSV and ZIP report generation."""
import csv
import io
import json
import zipfile
from datetime import datetime, timezone


def generate_csv_detail(db, site_id: str, month: str) -> bytes:
    """CSV: 15-Min-Detailnachweis aller B+ Teilnehmer für einen Monat."""
    from_s = f'{month}-01T00:00:00Z'
    to_s   = _next_month(month)

    rows = db.execute("""
        SELECT si.interval_start_utc, si.interval_end_utc,
               p.display_name, p.participant_status,
               spa.consumption_wh, spa.local_energy_wh,
               spa.grid_energy_wh, spa.local_coverage_percent,
               si.local_allocation_factor, si.plausibility_status
        FROM settlement_participant_allocations spa
        JOIN settlement_intervals si ON si.id = spa.settlement_interval_id
        JOIN participants p ON p.id = spa.participant_id
        WHERE si.site_id = ?
          AND si.interval_start_utc >= ? AND si.interval_start_utc < ?
        ORDER BY si.interval_start_utc, p.display_name
    """, (site_id, from_s, to_s)).fetchall()

    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow([
        'interval_start_utc', 'interval_end_utc',
        'participant', 'status',
        'consumption_wh', 'local_energy_wh', 'grid_energy_wh',
        'local_coverage_pct', 'site_allocation_factor', 'plausibility'
    ])
    for r in rows:
        writer.writerow([
            r['interval_start_utc'], r['interval_end_utc'],
            r['display_name'], r['participant_status'],
            f"{r['consumption_wh']:.4f}",
            f"{r['local_energy_wh']:.4f}",
            f"{r['grid_energy_wh']:.4f}",
            f"{r['local_coverage_percent']:.2f}",
            f"{r['local_allocation_factor']:.6f}",
            r['plausibility_status'],
        ])

    return buf.getvalue().encode('utf-8-sig')  # BOM for Excel compatibility


def generate_diagnostics_zip(db, site_id: str) -> bytes:
    """ZIP: Diagnoseexport mit system_info, logs, decisions, alarms."""
    buf = io.BytesIO()
    now = datetime.now(timezone.utc)

    with zipfile.ZipFile(buf, 'w', zipfile.ZIP_DEFLATED) as zf:

        # system_info.json
        site = db.execute("SELECT * FROM sites WHERE id=?", (site_id,)).fetchone()
        info = {
            'generated_at': now.isoformat(),
            'site_id': site_id,
            'site_name': site['name'] if site else '?',
            'ella_version': '1.0.0',
        }
        zf.writestr('system_info.json', json.dumps(info, indent=2, ensure_ascii=False))

        # db_summary.json
        tables = ['sites', 'participants', 'meters', 'measurements',
                  'power_states', 'control_decisions', 'settlement_intervals',
                  'settlement_participant_allocations', 'alarms', 'reports']
        summary = {}
        for t in tables:
            try:
                n = db.execute(f"SELECT COUNT(*) as n FROM {t}").fetchone()['n']
                summary[t] = n
            except Exception:
                summary[t] = 'error'
        zf.writestr('db_summary.json', json.dumps(summary, indent=2))

        # recent_control_decisions.csv
        decisions = db.execute("""
            SELECT timestamp_utc, bplus_power_w, bminus_power_w, pv_power_w,
                   battery_soc_percent, calculated_setpoint_w, sent_setpoint_w,
                   actual_inverter_power_w, decision_status, reason
            FROM control_decisions
            WHERE site_id=?
            ORDER BY timestamp_utc DESC LIMIT 500
        """, (site_id,)).fetchall()
        d_buf = io.StringIO()
        w = csv.writer(d_buf)
        w.writerow(['timestamp_utc', 'bplus_w', 'bminus_w', 'pv_w', 'soc_pct',
                    'calc_setpoint_w', 'sent_setpoint_w', 'actual_w', 'status', 'reason'])
        for r in decisions:
            w.writerow([r['timestamp_utc'], r['bplus_power_w'], r['bminus_power_w'],
                        r['pv_power_w'], r['battery_soc_percent'],
                        r['calculated_setpoint_w'], r['sent_setpoint_w'],
                        r['actual_inverter_power_w'], r['decision_status'], r['reason']])
        zf.writestr('recent_control_decisions.csv', d_buf.getvalue())

        # recent_alarms.csv
        alarms = db.execute("""
            SELECT triggered_at, alarm_class, alarm_code, message, status, acked_at
            FROM alarms WHERE site_id=?
            ORDER BY triggered_at DESC LIMIT 100
        """, (site_id,)).fetchall()
        a_buf = io.StringIO()
        w = csv.writer(a_buf)
        w.writerow(['triggered_at', 'class', 'code', 'message', 'status', 'acked_at'])
        for r in alarms:
            w.writerow([r['triggered_at'], r['alarm_class'], r['alarm_code'],
                        r['message'], r['status'], r['acked_at']])
        zf.writestr('recent_alarms.csv', a_buf.getvalue())

        # settlement_summary.csv (last 3 months)
        s_rows = db.execute("""
            SELECT interval_start_utc, bplus_consumption_wh, local_energy_available_wh,
                   local_allocation_factor, settlement_status, plausibility_status
            FROM settlement_intervals
            WHERE site_id=?
            ORDER BY interval_start_utc DESC LIMIT 1000
        """, (site_id,)).fetchall()
        s_buf = io.StringIO()
        w = csv.writer(s_buf)
        w.writerow(['interval_start', 'bplus_wh', 'local_wh', 'factor', 'status', 'plausibility'])
        for r in s_rows:
            w.writerow([r['interval_start_utc'], r['bplus_consumption_wh'],
                        r['local_energy_available_wh'], r['local_allocation_factor'],
                        r['settlement_status'], r['plausibility_status']])
        zf.writestr('settlement_summary.csv', s_buf.getvalue())

    return buf.getvalue()


def _next_month(month: str) -> str:
    y, m = [int(x) for x in month.split('-')]
    return f'{y + 1}-01-01T00:00:00Z' if m == 12 else f'{y}-{m + 1:02d}-01T00:00:00Z'
