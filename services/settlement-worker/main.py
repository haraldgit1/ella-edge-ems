"""
Ella settlement-worker
Closes 15-minute intervals and allocates local energy to B+ participants.
Runs plausibility checks on every settled interval.
"""
import os
import time
import sqlite3
from datetime import datetime, timezone, timedelta

DB_PATH = os.environ.get('ELLA_DB_PATH', '/data/ella-edge.db')
SITE_ID = os.environ.get('SITE_ID', 'site-demo-01')
RUN_INTERVAL_S = 60


def get_db():
    db = sqlite3.connect(DB_PATH)
    db.execute('PRAGMA journal_mode=WAL')
    db.execute('PRAGMA foreign_keys=ON')
    db.row_factory = sqlite3.Row
    return db


def floor_15min(dt: datetime) -> datetime:
    return dt.replace(second=0, microsecond=0, minute=(dt.minute // 15) * 15)


def check_plausibility(db, interval_id: int, bplus_wh: float,
                        local_wh: float, allocs: list) -> tuple[str, list]:
    """
    Returns (status, issues) where status is OK / WARNING / FAILED.
    """
    issues = []

    # Rule 1: local allocation must not exceed available local energy
    total_allocated = sum(a['local_energy_wh'] for a in allocs)
    if local_wh > 0 and total_allocated > local_wh * 1.01:  # 1% tolerance
        issues.append(f'Over-allocation: {total_allocated:.1f}Wh > {local_wh:.1f}Wh available')

    # Rule 2: no negative values
    for a in allocs:
        if a['consumption_wh'] < 0 or a['local_energy_wh'] < 0 or a['grid_energy_wh'] < 0:
            issues.append(f'Negative value for participant {a["participant_id"]}')

    # Rule 3: B- participants must have zero local energy
    bminus_with_local = db.execute("""
        SELECT spa.participant_id
        FROM settlement_participant_allocations spa
        JOIN participants p ON p.id = spa.participant_id
        WHERE spa.settlement_interval_id = ?
          AND p.participant_status = 'BMINUS'
          AND spa.local_energy_wh > 0
    """, (interval_id,)).fetchall()
    if bminus_with_local:
        issues.append(f'B- participants received local energy: {[r[0] for r in bminus_with_local]}')

    # Rule 4: check for COMM_ERROR measurements in interval (warn only)
    comm_errors = db.execute("""
        SELECT COUNT(*) as n FROM measurements
        WHERE quality_flag = 'COMM_ERROR'
          AND timestamp_utc >= (
              SELECT interval_start_utc FROM settlement_intervals WHERE id = ?
          )
          AND timestamp_utc < (
              SELECT interval_end_utc FROM settlement_intervals WHERE id = ?
          )
    """, (interval_id, interval_id)).fetchone()['n']
    if comm_errors > 0:
        issues.append(f'{comm_errors} COMM_ERROR measurements in interval (estimated values used)')

    if not issues:
        return 'OK', []
    # Any B- violation or over-allocation = FAILED; comm errors = WARNING
    critical = [i for i in issues if 'B-' in i or 'Over-allocation' in i or 'Negative' in i]
    return ('FAILED' if critical else 'WARNING'), issues


def settle_interval(db, interval_start: datetime) -> bool:
    interval_end = interval_start + timedelta(minutes=15)
    start_s = interval_start.strftime('%Y-%m-%dT%H:%M:%SZ')
    end_s   = interval_end.strftime('%Y-%m-%dT%H:%M:%SZ')

    # Already settled?
    existing = db.execute(
        "SELECT id FROM settlement_intervals WHERE interval_start_utc=? AND site_id=?",
        (start_s, SITE_ID)
    ).fetchone()
    if existing:
        return False

    # ── B+ consumption per participant ────────────────────────────────────
    bplus_rows = db.execute("""
        SELECT p.id AS participant_id,
               COALESCE(AVG(m.active_power_w), 0) * 0.25 AS consumption_wh
        FROM participants p
        LEFT JOIN measurements m
            ON m.meter_id = p.meter_id
           AND m.timestamp_utc >= ?
           AND m.timestamp_utc <  ?
           AND m.quality_flag IN ('OK','ESTIMATED')
        WHERE p.participant_status = 'BPLUS'
          AND p.is_active = 1
          AND p.site_id = ?
        GROUP BY p.id
    """, (start_s, end_s, SITE_ID)).fetchall()

    if not bplus_rows:
        return False   # no B+ participants yet

    # ── B- consumption (sum of per-meter averages) ────────────────────────
    bminus_result = db.execute("""
        SELECT COALESCE(SUM(avg_power_w) * 0.25, 0) AS wh
        FROM (
            SELECT AVG(m.active_power_w) AS avg_power_w
            FROM participants p
            LEFT JOIN measurements m
                ON m.meter_id = p.meter_id
               AND m.timestamp_utc >= ?
               AND m.timestamp_utc <  ?
               AND m.quality_flag IN ('OK','ESTIMATED')
            WHERE p.participant_status = 'BMINUS'
              AND p.is_active = 1
              AND p.site_id = ?
            GROUP BY p.id
        )
    """, (start_s, end_s, SITE_ID)).fetchone()
    bminus_wh = bminus_result['wh'] if bminus_result else 0.0

    # ── Local energy from inverter ────────────────────────────────────────
    local_result = db.execute("""
        SELECT COALESCE(AVG(actual_inverter_power_w), 0) * 0.25 AS wh
        FROM control_decisions
        WHERE site_id = ?
          AND timestamp_utc >= ?
          AND timestamp_utc <  ?
    """, (SITE_ID, start_s, end_s)).fetchone()
    local_wh = local_result['wh'] if local_result else 0.0

    bplus_total_wh = sum(float(r['consumption_wh']) for r in bplus_rows)
    factor = min(1.0, local_wh / bplus_total_wh) if bplus_total_wh > 0 else 0.0

    # ── Write settlement interval ─────────────────────────────────────────
    cur = db.execute("""
        INSERT INTO settlement_intervals
            (site_id, interval_start_utc, interval_end_utc,
             bplus_consumption_wh, bminus_consumption_wh,
             local_energy_available_wh, local_allocation_factor,
             grid_energy_bplus_wh, settlement_status, plausibility_status)
        VALUES (?,?,?,?,?,?,?,?,'CALCULATED','PENDING')
    """, (SITE_ID, start_s, end_s,
          round(bplus_total_wh, 4), round(float(bminus_wh), 4),
          round(local_wh, 4), round(factor, 6),
          round(bplus_total_wh * (1 - factor), 4)))
    interval_id = cur.lastrowid

    # ── Write per-participant allocations ─────────────────────────────────
    allocs = []
    for row in bplus_rows:
        c_wh  = float(row['consumption_wh'])
        l_wh  = c_wh * factor
        g_wh  = c_wh - l_wh
        allocs.append({
            'participant_id': row['participant_id'],
            'consumption_wh': round(c_wh, 4),
            'local_energy_wh': round(l_wh, 4),
            'grid_energy_wh': round(g_wh, 4),
        })
        db.execute("""
            INSERT INTO settlement_participant_allocations
                (settlement_interval_id, participant_id,
                 consumption_wh, local_energy_wh, grid_energy_wh,
                 local_coverage_percent)
            VALUES (?,?,?,?,?,?)
        """, (interval_id, row['participant_id'],
              round(c_wh, 4), round(l_wh, 4), round(g_wh, 4),
              round(factor * 100, 2)))

    db.commit()

    # ── Plausibility check ────────────────────────────────────────────────
    plaus_status, issues = check_plausibility(db, interval_id, bplus_total_wh, local_wh, allocs)
    db.execute(
        "UPDATE settlement_intervals SET plausibility_status=? WHERE id=?",
        (plaus_status, interval_id)
    )
    db.commit()

    flag = '✓' if plaus_status == 'OK' else f'⚠ {plaus_status}'
    print(f"Settled {start_s} | B+={bplus_total_wh:.1f}Wh "
          f"local={local_wh:.1f}Wh factor={factor:.1%} {flag}")
    if issues:
        for issue in issues:
            print(f"  ! {issue}")

    return True


def main():
    print(f"settlement-worker starting | site={SITE_ID}")
    while True:
        try:
            db = get_db()
            now = datetime.now(timezone.utc)
            current_slot = floor_15min(now)

            # Settle all unsettled complete slots from the last 2 hours
            for offset in range(8, 0, -1):
                slot = current_slot - timedelta(minutes=15 * offset)
                settle_interval(db, slot)

            db.close()
        except Exception as e:
            print(f"ERROR: {e}")
        time.sleep(RUN_INTERVAL_S)


if __name__ == '__main__':
    main()
