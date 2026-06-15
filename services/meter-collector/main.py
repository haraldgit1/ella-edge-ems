"""
Ella meter-watchdog
Monitors active meters for push timeouts. When a meter has been silent
for longer than push_timeout_s, writes a single 0W measurement
(quality_flag='STALE', source='WATCHDOG') retroactively at
last_timestamp + push_interval_s, then recalculates power_states.

Does NOT write simulation values. Simulation only via SimDashboard UI.
"""
import os
import time
import sqlite3
from datetime import datetime, timezone, timedelta

DB_PATH         = os.environ.get('ELLA_DB_PATH', '/data/ella-edge.db')
POLL_INTERVAL_S = int(os.environ.get('WATCHDOG_POLL_S', '5'))
SITE_ID         = 'site-demo-01'


def get_db():
    db = sqlite3.connect(DB_PATH, timeout=10)
    db.execute('PRAGMA journal_mode=WAL')
    db.execute('PRAGMA foreign_keys=ON')
    db.execute('PRAGMA busy_timeout=5000')
    return db


def check_timeouts(db):
    now    = datetime.now(timezone.utc)
    ts_now = now.strftime('%Y-%m-%dT%H:%M:%SZ')

    rows = db.execute("""
        SELECT
            m.id                              AS meter_id,
            m.site_id,
            COALESCE(m.push_interval_s, 10)  AS push_interval_s,
            COALESCE(m.push_timeout_s,  60)  AS push_timeout_s,
            meas.timestamp_utc               AS last_ts,
            meas.quality_flag                AS last_flag
        FROM meters m
        LEFT JOIN measurements meas ON meas.id = (
            SELECT id FROM measurements
            WHERE meter_id = m.id
            ORDER BY timestamp_utc DESC LIMIT 1
        )
        WHERE m.is_active = 1 AND m.site_id = ?
    """, (SITE_ID,)).fetchall()

    wrote_any = False

    for meter_id, site_id, interval_s, timeout_s, last_ts, last_flag in rows:
        if last_ts is None:
            continue   # meter has never reported — nothing to time out
        if last_flag == 'STALE':
            continue   # already marked timed-out; wait for next real push

        try:
            last_dt = datetime.fromisoformat(last_ts.replace('Z', '+00:00'))
        except ValueError:
            continue

        age_s = (now - last_dt).total_seconds()
        if age_s <= timeout_s:
            continue   # still within timeout window

        # Retroactive timestamp: one push_interval after the last real value
        stale_dt = last_dt + timedelta(seconds=interval_s)
        stale_ts = stale_dt.strftime('%Y-%m-%dT%H:%M:%SZ')

        db.execute("""
            INSERT INTO measurements
                (site_id, meter_id, timestamp_utc, active_power_w, quality_flag, source)
            VALUES (?, ?, ?, 0.0, 'STALE', 'WATCHDOG')
        """, (site_id, meter_id, stale_ts))

        print(f"[WATCHDOG] {meter_id}: {age_s:.0f}s silence → 0W STALE at {stale_ts}")
        wrote_any = True

    if wrote_any:
        recalculate_power_states(db, SITE_ID, ts_now)

    db.commit()


def recalculate_power_states(db, site_id: str, ts_now: str):
    """Recompute power_states from latest measurement per active meter.
    STALE entries contribute 0W and count as invalid_meter_count.
    PV and SOC are carried forward from the last known power_states row.
    """
    last_ps = db.execute(
        "SELECT pv_power_w, battery_soc_pct FROM power_states "
        "ORDER BY timestamp_utc DESC LIMIT 1"
    ).fetchone()
    pv_w = float(last_ps[0]) if last_ps and last_ps[0] is not None else 0.0
    soc  = float(last_ps[1]) if last_ps and last_ps[1] is not None else 0.0

    meter_rows = db.execute("""
        SELECT m.id, p.participant_status,
               meas.active_power_w,
               meas.quality_flag
        FROM meters m
        LEFT JOIN participants p ON p.meter_id = m.id AND p.is_active = 1
        LEFT JOIN measurements meas ON meas.id = (
            SELECT id FROM measurements
            WHERE meter_id = m.id
            ORDER BY timestamp_utc DESC LIMIT 1
        )
        WHERE m.site_id = ? AND m.is_active = 1
    """, (site_id,)).fetchall()

    bplus_w = bminus_w = 0.0
    valid_count = invalid_count = 0

    for _mid, status, w, flag in meter_rows:
        if w is None or flag == 'STALE':
            invalid_count += 1
        else:
            valid_count += 1
            if status == 'BPLUS':
                bplus_w += w
            elif status == 'BMINUS':
                bminus_w += w

    db.execute("""
        INSERT INTO power_states
            (site_id, timestamp_utc, bplus_power_w, bminus_power_w,
             total_power_w, pv_power_w, battery_soc_pct,
             valid_meter_count, invalid_meter_count)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (site_id, ts_now,
          round(bplus_w, 2), round(bminus_w, 2),
          round(bplus_w + bminus_w, 2),
          pv_w, soc, valid_count, invalid_count))

    print(f"[WATCHDOG] power_states updated: B+={bplus_w:.0f}W B-={bminus_w:.0f}W "
          f"valid={valid_count} invalid={invalid_count}")


def main():
    print(f"meter-watchdog starting | poll={POLL_INTERVAL_S}s | db={DB_PATH}")
    while True:
        try:
            db = get_db()
            check_timeouts(db)
            db.close()
        except Exception as e:
            print(f"ERROR: {e}")
        time.sleep(POLL_INTERVAL_S)


if __name__ == '__main__':
    main()
