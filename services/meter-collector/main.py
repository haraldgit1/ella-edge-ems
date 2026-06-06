"""
Ella meter-collector
Reads smart meters (or simulates them) and writes to measurements table.
"""
import os
import time
import sqlite3
import math
import random
from datetime import datetime, timezone

DB_PATH = os.environ.get('ELLA_DB_PATH', '/data/ella-edge.db')
SIMULATION_MODE = os.environ.get('SIMULATION_MODE', 'true').lower() == 'true'
SCENARIO = os.environ.get('SIMULATION_SCENARIO', 'summer_high_pv')
POLL_INTERVAL_S = int(os.environ.get('METER_POLL_INTERVAL_S', '5'))


def get_db():
    db = sqlite3.connect(DB_PATH)
    db.execute('PRAGMA journal_mode=WAL')
    db.execute('PRAGMA foreign_keys=ON')
    return db


def get_active_meters(db):
    cur = db.execute(
        "SELECT id, site_id, protocol FROM meters WHERE is_active = 1"
    )
    return cur.fetchall()


def simulate_power(meter_id: str, scenario: str, t: float) -> float:
    """Returns simulated active_power_w for a meter based on scenario."""
    # Each meter gets a deterministic base load from its id hash
    seed = sum(ord(c) for c in meter_id)
    random.seed(seed)
    base_load = random.uniform(150, 600)  # W

    hour = (t / 3600) % 24
    # Typical residential load curve
    if 7 <= hour < 9 or 17 <= hour < 22:
        load = base_load * 1.8
    elif 0 <= hour < 6:
        load = base_load * 0.3
    else:
        load = base_load

    # Small noise
    random.seed(int(t) + seed)
    load += random.uniform(-30, 30)
    return max(0.0, load)


def collect_simulation(db):
    meters = get_active_meters(db)
    now = datetime.now(timezone.utc)
    ts = now.isoformat(timespec='seconds').replace('+00:00', 'Z')
    t = now.timestamp()

    rows = []
    for meter_id, site_id, protocol in meters:
        power_w = simulate_power(meter_id, SCENARIO, t)
        rows.append((
            site_id, meter_id, ts,
            round(power_w, 2),
            None, None, None, None, None,
            'OK', 'SIMULATION'
        ))

    db.executemany("""
        INSERT INTO measurements
            (site_id, meter_id, timestamp_utc, active_power_w,
             energy_import_wh, energy_export_wh, voltage_v, current_a,
             power_factor, quality_flag, source)
        VALUES (?,?,?,?,?,?,?,?,?,?,?)
    """, rows)
    db.commit()

    # Update power_states
    bplus = db.execute("""
        SELECT COALESCE(SUM(m.active_power_w),0)
        FROM measurements m
        JOIN participants p ON p.meter_id = m.meter_id
        WHERE p.participant_status='BPLUS' AND p.is_active=1
          AND m.timestamp_utc = ?
    """, (ts,)).fetchone()[0]

    bminus = db.execute("""
        SELECT COALESCE(SUM(m.active_power_w),0)
        FROM measurements m
        JOIN participants p ON p.meter_id = m.meter_id
        WHERE p.participant_status='BMINUS' AND p.is_active=1
          AND m.timestamp_utc = ?
    """, (ts,)).fetchone()[0]

    valid_count = len([r for r in rows if r[9] == 'OK'])
    site_id = rows[0][0] if rows else 'site-demo-01'

    db.execute("""
        INSERT INTO power_states
            (site_id, timestamp_utc, bplus_power_w, bminus_power_w,
             total_power_w, pv_power_w, battery_soc_pct,
             valid_meter_count, invalid_meter_count)
        VALUES (?,?,?,?,?,?,?,?,?)
    """, (site_id, ts, round(bplus, 2), round(bminus, 2),
          round(bplus + bminus, 2),
          round(simulate_pv(SCENARIO, t), 2),
          round(simulate_soc(t), 1),
          valid_count, 0))
    db.commit()

    print(f"[{ts}] B+={bplus:.0f}W B-={bminus:.0f}W meters={len(rows)}")


def simulate_pv(scenario: str, t: float) -> float:
    hour = (t / 3600) % 24
    if scenario == 'summer_high_pv':
        if 6 <= hour <= 20:
            return max(0, 5000 * math.sin(math.pi * (hour - 6) / 14))
    elif scenario == 'winter_20_percent_local_coverage':
        if 8 <= hour <= 16:
            return max(0, 800 * math.sin(math.pi * (hour - 8) / 8))
    return 0.0


def simulate_soc(t: float) -> float:
    hour = (t / 3600) % 24
    # Battery charges midday, discharges evening
    return 40 + 40 * math.sin(math.pi * (hour - 6) / 12)


def main():
    print(f"meter-collector starting | simulation={SIMULATION_MODE} | scenario={SCENARIO}")
    while True:
        try:
            db = get_db()
            if SIMULATION_MODE:
                collect_simulation(db)
            else:
                print("Modbus mode not yet implemented")
            db.close()
        except Exception as e:
            print(f"ERROR: {e}")
        time.sleep(POLL_INTERVAL_S)


if __name__ == '__main__':
    main()
