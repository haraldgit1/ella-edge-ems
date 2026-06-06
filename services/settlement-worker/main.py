"""
Ella settlement-worker
Closes 15-minute intervals and allocates local energy to B+ participants.
"""
import os
import time
import sqlite3
from datetime import datetime, timezone, timedelta

DB_PATH = os.environ.get('ELLA_DB_PATH', '/data/ella-edge.db')
RUN_INTERVAL_S = 60  # check every minute


def get_db():
    db = sqlite3.connect(DB_PATH)
    db.execute('PRAGMA journal_mode=WAL')
    db.execute('PRAGMA foreign_keys=ON')
    db.row_factory = sqlite3.Row
    return db


def floor_15min(dt: datetime) -> datetime:
    return dt.replace(second=0, microsecond=0,
                      minute=(dt.minute // 15) * 15)


def settle_interval(db, interval_start: datetime):
    interval_end = interval_start + timedelta(minutes=15)
    start_s = interval_start.isoformat(timespec='seconds').replace('+00:00', 'Z')
    end_s = interval_end.isoformat(timespec='seconds').replace('+00:00', 'Z')

    # Already settled?
    existing = db.execute(
        "SELECT id FROM settlement_intervals WHERE interval_start_utc=? AND site_id='site-demo-01'",
        (start_s,)
    ).fetchone()
    if existing:
        return

    # B+ consumption in interval (sum of avg power * 0.25h for each meter)
    bplus_rows = db.execute("""
        SELECT p.id as participant_id,
               AVG(m.active_power_w) * 0.25 as consumption_wh
        FROM measurements m
        JOIN participants p ON p.meter_id = m.meter_id
        WHERE p.participant_status = 'BPLUS'
          AND p.is_active = 1
          AND m.timestamp_utc >= ? AND m.timestamp_utc < ?
          AND m.quality_flag IN ('OK','ESTIMATED')
        GROUP BY p.id
    """, (start_s, end_s)).fetchall()

    bminus_wh = db.execute("""
        SELECT COALESCE(SUM(AVG(m.active_power_w)) * 0.25, 0)
        FROM measurements m
        JOIN participants p ON p.meter_id = m.meter_id
        WHERE p.participant_status = 'BMINUS'
          AND p.is_active = 1
          AND m.timestamp_utc >= ? AND m.timestamp_utc < ?
          AND m.quality_flag IN ('OK','ESTIMATED')
        GROUP BY p.id
    """, (start_s, end_s)).fetchone()

    if not bplus_rows:
        return  # No data yet, skip

    bplus_total_wh = sum(r['consumption_wh'] for r in bplus_rows)
    bminus_total_wh = (bminus_wh[0] if bminus_wh else 0) or 0

    # Local energy available = avg inverter output * 0.25h
    local_wh = db.execute("""
        SELECT COALESCE(AVG(actual_inverter_power_w) * 0.25, 0)
        FROM control_decisions
        WHERE timestamp_utc >= ? AND timestamp_utc < ?
    """, (start_s, end_s)).fetchone()[0] or 0

    factor = min(1.0, local_wh / bplus_total_wh) if bplus_total_wh > 0 else 0

    # Write interval
    cur = db.execute("""
        INSERT INTO settlement_intervals
            (site_id, interval_start_utc, interval_end_utc,
             bplus_consumption_wh, bminus_consumption_wh,
             local_energy_available_wh, local_allocation_factor,
             grid_energy_bplus_wh, settlement_status, plausibility_status)
        VALUES ('site-demo-01',?,?,?,?,?,?,?,'CALCULATED','OK')
    """, (start_s, end_s,
          round(bplus_total_wh, 4), round(bminus_total_wh, 4),
          round(local_wh, 4), round(factor, 6),
          round(bplus_total_wh * (1 - factor), 4)))
    interval_id = cur.lastrowid
    db.commit()

    # Write per-participant allocation
    for row in bplus_rows:
        local_e = row['consumption_wh'] * factor
        grid_e = row['consumption_wh'] - local_e
        db.execute("""
            INSERT INTO settlement_participant_allocations
                (settlement_interval_id, participant_id,
                 consumption_wh, local_energy_wh, grid_energy_wh, local_coverage_percent)
            VALUES (?,?,?,?,?,?)
        """, (interval_id, row['participant_id'],
              round(row['consumption_wh'], 4),
              round(local_e, 4), round(grid_e, 4),
              round(factor * 100, 2)))
    db.commit()

    print(f"Settled {start_s} | B+={bplus_total_wh:.1f}Wh local={local_wh:.1f}Wh factor={factor:.1%}")


def main():
    print("settlement-worker starting")
    while True:
        try:
            db = get_db()
            now = datetime.now(timezone.utc)
            # Settle the last completed 15-min interval
            current_slot = floor_15min(now)
            previous_slot = current_slot - timedelta(minutes=15)
            settle_interval(db, previous_slot)
            db.close()
        except Exception as e:
            print(f"ERROR: {e}")
        time.sleep(RUN_INTERVAL_S)


if __name__ == '__main__':
    main()
