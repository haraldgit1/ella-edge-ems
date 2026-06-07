"""
Ella Edge EMS – Backfill-Script
Generates a full month of simulated measurements, power_states,
control_decisions and settlement data.

Usage (inside reporting-worker container):
  python backfill_month.py 2026-05

The script is idempotent: already-settled intervals are skipped.
"""
import sys
import os
import sqlite3
import math
import random
from datetime import datetime, timezone, timedelta

DB_PATH  = os.environ.get('ELLA_DB_PATH', '/data/ella-edge.db')
SITE_ID  = os.environ.get('SITE_ID', 'site-demo-01')
SCENARIO = os.environ.get('SIMULATION_SCENARIO', 'summer_high_pv')

MIN_SOC_PCT   = 15.0
MAX_INV_W     = 10_000.0
BATTERY_CAP_W = 8_000.0     # max discharge rate
HYSTERESIS_W  = 50.0


# ── Simulation helpers (same as meter-collector) ─────────────────────────────

def simulate_power(meter_id: str, t: float) -> float:
    seed = sum(ord(c) for c in meter_id)
    random.seed(seed)
    base_load = random.uniform(150, 600)
    hour = (t / 3600) % 24
    if 7 <= hour < 9 or 17 <= hour < 22:
        load = base_load * 1.8
    elif 0 <= hour < 6:
        load = base_load * 0.3
    else:
        load = base_load
    random.seed(int(t) + seed)
    load += random.uniform(-30, 30)
    return max(0.0, load)


def simulate_pv(t: float) -> float:
    hour = (t / 3600) % 24
    if SCENARIO == 'summer_high_pv':
        if 6 <= hour <= 20:
            return max(0.0, 5000.0 * math.sin(math.pi * (hour - 6) / 14))
    elif SCENARIO == 'winter_20_percent_local_coverage':
        if 8 <= hour <= 16:
            return max(0.0, 800.0 * math.sin(math.pi * (hour - 8) / 8))
    return 0.0


def simulate_soc(t: float) -> float:
    hour = (t / 3600) % 24
    return 40.0 + 40.0 * math.sin(math.pi * (hour - 6) / 12)


def inverter_setpoint(bplus_w: float, pv_w: float, soc_pct: float) -> tuple:
    if soc_pct <= MIN_SOC_PCT:
        return 0.0, 'LIMITED_BY_BATTERY_SOC'
    # Battery can supplement PV up to its discharge limit, scaled by SOC
    battery_avail = ((soc_pct - MIN_SOC_PCT) / (100.0 - MIN_SOC_PCT)) * BATTERY_CAP_W
    total_avail   = min(pv_w + battery_avail, MAX_INV_W)
    setpoint      = min(bplus_w, total_avail)
    if setpoint < HYSTERESIS_W:
        return 0.0, 'BELOW_HYSTERESIS'
    if total_avail < bplus_w - HYSTERESIS_W:
        reason = 'LIMITED_BY_BATTERY_SOC' if pv_w < bplus_w else 'LIMITED_BY_INVERTER_MAX'
    else:
        reason = 'OK_BPLUS_DEMAND_MATCHED'
    return round(setpoint, 2), reason


# ── DB helpers ────────────────────────────────────────────────────────────────

def get_db() -> sqlite3.Connection:
    db = sqlite3.connect(DB_PATH, timeout=30)
    db.execute('PRAGMA journal_mode=WAL')
    db.execute('PRAGMA foreign_keys=ON')
    db.execute('PRAGMA busy_timeout=10000')
    db.row_factory = sqlite3.Row
    return db


def floor_15min(dt: datetime) -> datetime:
    return dt.replace(second=0, microsecond=0, minute=(dt.minute // 15) * 15)


# ── Phase 1: Measurements, power_states, control_decisions ───────────────────

def backfill_measurements(db, start: datetime, end: datetime, meters: list, step_s: int = 300):
    print(f"Phase 1: inserting measurements ({step_s}s step) …")
    total_steps = int((end - start).total_seconds() / step_s)
    inserted = 0
    skipped  = 0

    # Check which timestamps already exist (for idempotency)
    first_ts = start.strftime('%Y-%m-%dT%H:%M:%SZ')
    last_ts  = (end - timedelta(seconds=step_s)).strftime('%Y-%m-%dT%H:%M:%SZ')
    existing = set(
        r[0] for r in db.execute(
            "SELECT DISTINCT timestamp_utc FROM measurements "
            "WHERE site_id=? AND timestamp_utc>=? AND timestamp_utc<=?",
            (SITE_ID, first_ts, last_ts)
        ).fetchall()
    )

    meas_buf  = []
    ps_buf    = []
    cd_buf    = []

    bplus_meter_ids  = [m['id'] for m in meters if m['status'] == 'BPLUS']
    bminus_meter_ids = [m['id'] for m in meters if m['status'] == 'BMINUS']

    t = start
    step = timedelta(seconds=step_s)
    dot_every = max(1, total_steps // 40)

    while t < end:
        ts  = t.strftime('%Y-%m-%dT%H:%M:%SZ')
        tst = t.timestamp()

        if ts in existing:
            t += step
            skipped += 1
            continue

        pv_w  = simulate_pv(tst)
        soc   = simulate_soc(tst)

        bplus_w  = 0.0
        bminus_w = 0.0

        for m in meters:
            pw = simulate_power(m['id'], tst)
            meas_buf.append((
                SITE_ID, m['id'], ts, round(pw, 2),
                None, None, None, None, None, 'OK', 'SIMULATION'
            ))
            if m['status'] == 'BPLUS':
                bplus_w  += pw
            else:
                bminus_w += pw

        # power_state
        ps_buf.append((
            SITE_ID, ts, round(bplus_w, 2), round(bminus_w, 2),
            round(bplus_w + bminus_w, 2),
            round(pv_w, 2), round(soc, 1),
            len(bplus_meter_ids), 0
        ))

        # control_decision
        setpoint, reason = inverter_setpoint(bplus_w, pv_w, soc)
        cd_buf.append((
            SITE_ID, ts, round(bplus_w, 2), round(bminus_w, 2),
            round(pv_w, 2), round(soc, 1),
            round(setpoint, 2), round(setpoint, 2), round(setpoint, 2),
            'OK', reason
        ))

        inserted += 1
        if inserted % dot_every == 0:
            print('.', end='', flush=True)

        # Flush every 500 steps
        if len(meas_buf) >= 500 * len(meters):
            _flush(db, meas_buf, ps_buf, cd_buf)
            meas_buf.clear(); ps_buf.clear(); cd_buf.clear()

        t += step

    if meas_buf:
        _flush(db, meas_buf, ps_buf, cd_buf)

    print(f"\n  → {inserted} timestamps inserted, {skipped} skipped (already present)")


def _flush(db, meas_buf, ps_buf, cd_buf):
    db.executemany("""
        INSERT OR IGNORE INTO measurements
            (site_id, meter_id, timestamp_utc, active_power_w,
             energy_import_wh, energy_export_wh, voltage_v, current_a,
             power_factor, quality_flag, source)
        VALUES (?,?,?,?,?,?,?,?,?,?,?)
    """, meas_buf)
    db.executemany("""
        INSERT OR IGNORE INTO power_states
            (site_id, timestamp_utc, bplus_power_w, bminus_power_w,
             total_power_w, pv_power_w, battery_soc_pct,
             valid_meter_count, invalid_meter_count)
        VALUES (?,?,?,?,?,?,?,?,?)
    """, ps_buf)
    db.executemany("""
        INSERT OR IGNORE INTO control_decisions
            (site_id, timestamp_utc, bplus_power_w, bminus_power_w,
             pv_power_w, battery_soc_percent,
             calculated_setpoint_w, sent_setpoint_w, actual_inverter_power_w,
             decision_status, reason)
        VALUES (?,?,?,?,?,?,?,?,?,?,?)
    """, cd_buf)
    db.commit()


# ── Phase 2: Settlement ───────────────────────────────────────────────────────

def backfill_settlement(db, start: datetime, end: datetime):
    print("Phase 2: settling 15-minute intervals …")

    bplus_participants = db.execute("""
        SELECT id FROM participants
        WHERE site_id=? AND participant_status='BPLUS' AND is_active=1
    """, (SITE_ID,)).fetchall()
    if not bplus_participants:
        print("  No B+ participants found — skipping settlement.")
        return

    t = floor_15min(start)
    count = 0
    skipped = 0
    dot_every = max(1, int((end - start).total_seconds() / 900) // 40)

    while t < end:
        interval_end = t + timedelta(minutes=15)
        start_s = t.strftime('%Y-%m-%dT%H:%M:%SZ')
        end_s   = interval_end.strftime('%Y-%m-%dT%H:%M:%SZ')

        existing = db.execute(
            "SELECT id FROM settlement_intervals WHERE interval_start_utc=? AND site_id=?",
            (start_s, SITE_ID)
        ).fetchone()
        if existing:
            t = interval_end
            skipped += 1
            continue

        # B+ consumption
        bplus_rows = db.execute("""
            SELECT p.id AS participant_id,
                   COALESCE(AVG(m.active_power_w), 0) * 0.25 AS consumption_wh
            FROM participants p
            LEFT JOIN measurements m
                ON m.meter_id = p.meter_id
               AND m.timestamp_utc >= ? AND m.timestamp_utc < ?
               AND m.quality_flag IN ('OK','ESTIMATED')
            WHERE p.participant_status='BPLUS' AND p.is_active=1 AND p.site_id=?
            GROUP BY p.id
        """, (start_s, end_s, SITE_ID)).fetchall()

        # B- consumption
        bminus_wh = db.execute("""
            SELECT COALESCE(SUM(avg_w) * 0.25, 0) AS wh FROM (
                SELECT AVG(m.active_power_w) AS avg_w
                FROM participants p
                LEFT JOIN measurements m
                    ON m.meter_id = p.meter_id
                   AND m.timestamp_utc >= ? AND m.timestamp_utc < ?
                   AND m.quality_flag IN ('OK','ESTIMATED')
                WHERE p.participant_status='BMINUS' AND p.is_active=1 AND p.site_id=?
                GROUP BY p.id
            )
        """, (start_s, end_s, SITE_ID)).fetchone()['wh']

        # Local energy from inverter
        local_wh = db.execute("""
            SELECT COALESCE(AVG(actual_inverter_power_w), 0) * 0.25 AS wh
            FROM control_decisions
            WHERE site_id=? AND timestamp_utc>=? AND timestamp_utc<?
        """, (SITE_ID, start_s, end_s)).fetchone()['wh']

        bplus_total = sum(float(r['consumption_wh']) for r in bplus_rows)
        factor = min(1.0, local_wh / bplus_total) if bplus_total > 0 else 0.0

        cur = db.execute("""
            INSERT INTO settlement_intervals
                (site_id, interval_start_utc, interval_end_utc,
                 bplus_consumption_wh, bminus_consumption_wh,
                 local_energy_available_wh, local_allocation_factor,
                 grid_energy_bplus_wh, settlement_status, plausibility_status)
            VALUES (?,?,?,?,?,?,?,?,'CALCULATED','PENDING')
        """, (SITE_ID, start_s, end_s,
              round(bplus_total, 4), round(float(bminus_wh), 4),
              round(local_wh, 4), round(factor, 6),
              round(bplus_total * (1 - factor), 4)))
        interval_id = cur.lastrowid

        allocs = []
        for row in bplus_rows:
            c_wh = float(row['consumption_wh'])
            l_wh = c_wh * factor
            g_wh = c_wh - l_wh
            allocs.append({'participant_id': row['participant_id'],
                           'local_energy_wh': l_wh, 'consumption_wh': c_wh,
                           'grid_energy_wh': g_wh})
            db.execute("""
                INSERT INTO settlement_participant_allocations
                    (settlement_interval_id, participant_id,
                     consumption_wh, local_energy_wh, grid_energy_wh,
                     local_coverage_percent)
                VALUES (?,?,?,?,?,?)
            """, (interval_id, row['participant_id'],
                  round(c_wh, 4), round(l_wh, 4), round(g_wh, 4),
                  round(factor * 100, 2)))

        # Plausibility
        total_alloc = sum(a['local_energy_wh'] for a in allocs)
        issues = []
        if local_wh > 0 and total_alloc > local_wh * 1.01:
            issues.append('over-allocation')
        if any(a['consumption_wh'] < 0 or a['local_energy_wh'] < 0 for a in allocs):
            issues.append('negative-value')
        plaus = 'OK' if not issues else 'FAILED'

        db.execute(
            "UPDATE settlement_intervals SET plausibility_status=? WHERE id=?",
            (plaus, interval_id)
        )
        db.commit()

        count += 1
        if count % dot_every == 0:
            print('.', end='', flush=True)

        t = interval_end

    print(f"\n  → {count} intervals settled, {skipped} skipped (already present)")


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    month = sys.argv[1] if len(sys.argv) > 1 else '2026-05'
    try:
        y, m = [int(x) for x in month.split('-')]
    except ValueError:
        print("Usage: python backfill_month.py YYYY-MM")
        sys.exit(1)

    start = datetime(y, m, 1, 0, 0, 0, tzinfo=timezone.utc)
    if m == 12:
        end = datetime(y + 1, 1, 1, 0, 0, 0, tzinfo=timezone.utc)
    else:
        end = datetime(y, m + 1, 1, 0, 0, 0, tzinfo=timezone.utc)

    days = (end - start).days
    intervals = days * 96

    print(f"Ella Edge EMS – Backfill {month}")
    print(f"  DB      : {DB_PATH}")
    print(f"  Site    : {SITE_ID}")
    print(f"  Scenario: {SCENARIO}")
    print(f"  Period  : {start.date()} → {end.date()} ({days} days, {intervals} intervals)")
    print()

    db = get_db()

    meters = db.execute("""
        SELECT m.id, p.participant_status AS status
        FROM meters m
        JOIN participants p ON p.meter_id = m.id
        WHERE m.site_id=? AND m.is_active=1 AND p.is_active=1
    """, (SITE_ID,)).fetchall()

    if not meters:
        print("ERROR: No active meters with participants found. Check seed data.")
        sys.exit(1)

    bplus_count  = sum(1 for m in meters if m['status'] == 'BPLUS')
    bminus_count = sum(1 for m in meters if m['status'] == 'BMINUS')
    print(f"  Meters  : {len(meters)} total ({bplus_count} B+, {bminus_count} B-)")
    print()

    backfill_measurements(db, start, end, meters)
    print()
    backfill_settlement(db, start, end)
    print()

    # Summary
    n_intervals = db.execute(
        "SELECT COUNT(*) as n FROM settlement_intervals WHERE site_id=? "
        "AND interval_start_utc>=? AND interval_start_utc<?",
        (SITE_ID, start.strftime('%Y-%m-%dT%H:%M:%SZ'), end.strftime('%Y-%m-%dT%H:%M:%SZ'))
    ).fetchone()['n']

    totals = db.execute("""
        SELECT COALESCE(SUM(bplus_consumption_wh),0)/1000 AS bplus_kwh,
               COALESCE(SUM(local_energy_available_wh),0)/1000 AS local_kwh,
               COALESCE(AVG(local_allocation_factor)*100,0) AS avg_cov
        FROM settlement_intervals
        WHERE site_id=? AND interval_start_utc>=? AND interval_start_utc<?
    """, (SITE_ID, start.strftime('%Y-%m-%dT%H:%M:%SZ'), end.strftime('%Y-%m-%dT%H:%M:%SZ'))).fetchone()

    print("Done.")
    print(f"  Settlement intervals : {n_intervals}")
    print(f"  B+ Gesamtverbrauch   : {totals['bplus_kwh']:.1f} kWh")
    print(f"  Lokal verfügbar      : {totals['local_kwh']:.1f} kWh")
    print(f"  Ø Deckungsgrad       : {totals['avg_cov']:.1f} %")

    db.close()


if __name__ == '__main__':
    main()
