"""
Ella inverter-controller
Reads power_states, calculates setpoint, writes control_decisions.
"""
import os
import time
import sqlite3
from datetime import datetime, timezone

DB_PATH = os.environ.get('ELLA_DB_PATH', '/data/ella-edge.db')
SIMULATION_MODE = os.environ.get('SIMULATION_MODE', 'true').lower() == 'true'
CONTROL_INTERVAL_S = int(os.environ.get('CONTROL_INTERVAL_S', '5'))

# Control parameters
MIN_SOC_PCT = float(os.environ.get('MIN_SOC_PCT', '15'))
MAX_INVERTER_W = float(os.environ.get('MAX_INVERTER_W', '10000'))
HYSTERESIS_W = float(os.environ.get('HYSTERESIS_W', '50'))

ALGO_VERSION = 'v1.0'


def get_db():
    db = sqlite3.connect(DB_PATH)
    db.execute('PRAGMA journal_mode=WAL')
    db.execute('PRAGMA foreign_keys=ON')
    db.row_factory = sqlite3.Row
    return db


def control_loop(db):
    now = datetime.now(timezone.utc)
    ts = now.isoformat(timespec='seconds').replace('+00:00', 'Z')

    # Get latest power state
    ps = db.execute(
        "SELECT * FROM power_states ORDER BY timestamp_utc DESC LIMIT 1"
    ).fetchone()

    if not ps:
        _write_decision(db, ts, 0, 0, 0, None, None, 0, 0, 0,
                        'NO_DATA', 'NO_VALID_BPLUS_DATA')
        return

    bplus_w = ps['bplus_power_w']
    bminus_w = ps['bminus_power_w']
    soc = ps['battery_soc_pct']
    pv_w = ps['pv_power_w']
    valid_count = ps['valid_meter_count']

    reason = 'OK_BPLUS_DEMAND_MATCHED'
    setpoint = bplus_w

    # SOC limit
    if soc is not None and soc < MIN_SOC_PCT:
        setpoint = 0
        reason = 'LIMITED_BY_BATTERY_SOC'

    # Inverter max limit
    if setpoint > MAX_INVERTER_W:
        setpoint = MAX_INVERTER_W
        reason = 'LIMITED_BY_INVERTER_MAX'

    # Not enough valid meters
    if valid_count < 1:
        setpoint = 0
        reason = 'NO_VALID_BPLUS_DATA'

    # Hysteresis: check last sent setpoint
    last = db.execute(
        "SELECT sent_setpoint_w FROM control_decisions ORDER BY timestamp_utc DESC LIMIT 1"
    ).fetchone()
    last_setpoint = last['sent_setpoint_w'] if last and last['sent_setpoint_w'] is not None else -1

    if abs(setpoint - last_setpoint) < HYSTERESIS_W and reason.startswith('OK'):
        # No change needed
        return

    # Simulate actual inverter response (90-100% of setpoint in sim)
    import random
    actual = setpoint * random.uniform(0.90, 1.0) if SIMULATION_MODE else setpoint

    _write_decision(db, ts, bplus_w, bminus_w, bplus_w + bminus_w,
                    soc, pv_w, MAX_INVERTER_W, round(setpoint, 1),
                    round(setpoint, 1), round(actual, 1),
                    'OK' if reason.startswith('OK') or reason.startswith('LIMITED') else 'FAILSAFE',
                    reason)

    print(f"[{ts}] B+={bplus_w:.0f}W setpoint={setpoint:.0f}W SOC={soc}% reason={reason}")


def _write_decision(db, ts, bplus, bminus, total, soc, pv,
                    max_disch, calc_sp, sent_sp, actual, status, reason):
    db.execute("""
        INSERT INTO control_decisions
            (site_id, timestamp_utc, bplus_power_w, bminus_power_w,
             total_power_w, battery_soc_percent, pv_power_w,
             max_allowed_discharge_w, calculated_setpoint_w,
             sent_setpoint_w, actual_inverter_power_w,
             decision_status, reason, algorithm_version)
        VALUES ('site-demo-01',?,?,?,?,?,?,?,?,?,?,?,?,?)
    """, (ts, bplus, bminus, total, soc, pv,
          max_disch, calc_sp, sent_sp, actual, status, reason, ALGO_VERSION))
    db.commit()


def main():
    print(f"inverter-controller starting | simulation={SIMULATION_MODE}")
    while True:
        try:
            db = get_db()
            control_loop(db)
            db.close()
        except Exception as e:
            print(f"ERROR: {e}")
        time.sleep(CONTROL_INTERVAL_S)


if __name__ == '__main__':
    main()
