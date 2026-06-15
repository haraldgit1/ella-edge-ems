"""Ella Simulation API – standalone energy-flow simulator, optional EMS DB sync."""
from fastapi import FastAPI, Body, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone
import sqlite3
import json
import os
import uvicorn

ELLA_DB_PATH = os.environ.get('ELLA_DB_PATH', '')  # empty = no DB sync available
SITE_ID      = 'site-demo-01'

app = FastAPI(title="Ella Simulation API")
app.add_middleware(
    CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"],
)

MAX_CHARGE_W    = 5000.0
MAX_DISCHARGE_W = 5000.0

DEFAULT_METERS = [
    {"id": "m1", "name": "Familie Müller",  "load_kw": 1.2, "is_bplus": True},
    {"id": "m2", "name": "Hr. Schmidt",     "load_kw": 0.8, "is_bplus": True},
    {"id": "m3", "name": "Fr. Berger",      "load_kw": 1.5, "is_bplus": True},
    {"id": "m4", "name": "Familie Wagner",  "load_kw": 2.0, "is_bplus": True},
    {"id": "m5", "name": "Hr. Huber",       "load_kw": 0.6, "is_bplus": False},
    {"id": "m6", "name": "Fr. Novak",       "load_kw": 1.0, "is_bplus": False},
]

state: dict = {
    "pv_kw":     5.0,
    "soc_pct":   60.0,
    "meters":    [dict(m) for m in DEFAULT_METERS],
    "interval_s": 2,
}


class MeterState(BaseModel):
    id: str
    name: str
    db_meter_id: Optional[str] = None  # real PK in meters table; required for sim/push
    load_kw: float
    is_bplus: bool
    model_config = {"extra": "ignore"}


class SimUpdate(BaseModel):
    pv_kw:      Optional[float]           = None
    soc_pct:    Optional[float]           = None
    meters:     Optional[List[MeterState]] = None
    interval_s: Optional[int]             = None


class SmartMeterReading(BaseModel):
    LDT:   Optional[str] = None  # timestamp with timezone; if empty/absent → server time
    LDTsm: Optional[str] = None  # direct from meter clock; stored in log only
    CID:   str                   # custom ID → maps to meter.cid in DB
    Pact:  str                   # active power in kW (string from device)


def compute_flow(s: dict) -> dict:
    pv_w = s["pv_kw"] * 1000.0
    soc  = s["soc_pct"]

    bplus  = [m for m in s["meters"] if     m["is_bplus"]]
    bminus = [m for m in s["meters"] if not m["is_bplus"]]

    bplus_demand_w  = sum(m["load_kw"] * 1000 for m in bplus)
    bminus_demand_w = sum(m["load_kw"] * 1000 for m in bminus)

    discharge_avail_w = MAX_DISCHARGE_W if soc > 20  else 0.0
    charge_avail_w    = MAX_CHARGE_W    if soc < 100 else 0.0  # no charging when full

    if pv_w >= bplus_demand_w:
        pv_to_bplus_w       = bplus_demand_w
        surplus_w           = pv_w - bplus_demand_w
        battery_charge_w    = min(surplus_w, charge_avail_w)
        pv_to_grid_w        = max(0.0, surplus_w - battery_charge_w)
        battery_discharge_w = 0.0
        grid_to_bplus_w     = 0.0
    else:
        pv_to_bplus_w       = pv_w
        deficit_w           = bplus_demand_w - pv_w
        battery_discharge_w = min(deficit_w, discharge_avail_w)
        grid_to_bplus_w     = deficit_w - battery_discharge_w
        battery_charge_w    = 0.0
        pv_to_grid_w        = 0.0

    local_supply_w      = pv_to_bplus_w + battery_discharge_w
    local_coverage_pct  = (local_supply_w / bplus_demand_w * 100) if bplus_demand_w > 0 else 100.0
    grid_import_w       = grid_to_bplus_w + bminus_demand_w
    grid_export_w       = pv_to_grid_w

    return {
        "pv_w":                 round(pv_w, 1),
        "pv_to_bplus_w":        round(pv_to_bplus_w, 1),
        "pv_to_grid_w":         round(pv_to_grid_w, 1),
        "battery_charge_w":     round(battery_charge_w, 1),
        "battery_discharge_w":  round(battery_discharge_w, 1),
        "grid_to_bplus_w":      round(grid_to_bplus_w, 1),
        "grid_to_bminus_w":     round(bminus_demand_w, 1),
        "grid_import_w":        round(grid_import_w, 1),
        "grid_export_w":        round(grid_export_w, 1),
        "bplus_demand_w":       round(bplus_demand_w, 1),
        "bminus_demand_w":      round(bminus_demand_w, 1),
        "local_supply_w":       round(local_supply_w, 1),
        "local_coverage_pct":   round(local_coverage_pct, 1),
    }


@app.get("/sim/state")
def get_state():
    return {**state, "flow": compute_flow(state)}


@app.post("/sim/update")
def update_state(update: SimUpdate):
    if update.pv_kw      is not None: state["pv_kw"]     = max(0.0, min(20.0, update.pv_kw))
    if update.soc_pct    is not None: state["soc_pct"]    = max(0.0, min(100.0, update.soc_pct))
    if update.meters     is not None: state["meters"]     = [m.model_dump() for m in update.meters]
    if update.interval_s is not None: state["interval_s"] = max(1, min(5, update.interval_s))
    return {**state, "flow": compute_flow(state)}


@app.get("/sim/reset")
def reset_state():
    state["pv_kw"]     = 5.0
    state["soc_pct"]   = 60.0
    state["meters"]    = [dict(m) for m in DEFAULT_METERS]
    state["interval_s"] = 2
    return {**state, "flow": compute_flow(state)}


@app.get("/sim/db_status")
def db_status():
    """Check whether EMS DB is reachable from simulation container."""
    if not ELLA_DB_PATH:
        return {"available": False, "reason": "ELLA_DB_PATH not set"}
    if not os.path.exists(ELLA_DB_PATH):
        return {"available": False, "reason": f"DB file not found: {ELLA_DB_PATH}"}
    try:
        db = sqlite3.connect(ELLA_DB_PATH, timeout=3)
        count = db.execute("SELECT COUNT(*) FROM meters").fetchone()[0]
        db.close()
        return {"available": True, "meters_in_db": count}
    except Exception as e:
        return {"available": False, "reason": str(e)}


@app.post("/sim/push")
def push_to_ems(body: Optional[SimUpdate] = Body(None)):
    """
    Write simulation state into EMS DB.
    Accepts optional body with current state from the React frontend — this is
    the authoritative source when EMS sync is active, because SOC evolves in
    the frontend and is passed here directly rather than via a separate /update call.
    """
    if not ELLA_DB_PATH or not os.path.exists(ELLA_DB_PATH):
        return {"ok": False, "error": "EMS database not accessible"}

    # Apply any state from the React frontend before computing flow
    if body:
        if body.pv_kw      is not None: state["pv_kw"]     = max(0.0, min(20.0, body.pv_kw))
        if body.soc_pct    is not None: state["soc_pct"]    = max(0.0, min(100.0, body.soc_pct))
        if body.meters     is not None: state["meters"]     = [m.model_dump() for m in body.meters]
        if body.interval_s is not None: state["interval_s"] = max(1, min(5, body.interval_s))

    s = state
    f = compute_flow(s)
    now = datetime.now(timezone.utc)
    ts  = now.isoformat(timespec='seconds').replace('+00:00', 'Z')

    try:
        db = sqlite3.connect(ELLA_DB_PATH, timeout=10)
        db.execute('PRAGMA journal_mode=WAL')
        db.execute('PRAGMA foreign_keys=ON')

        # Per-meter measurements — use db_meter_id passed from frontend; skip if missing
        contributions: dict = {}
        for meter in s['meters']:
            db_mid = meter.get('db_meter_id')
            if not db_mid:
                continue
            db.execute(
                "INSERT INTO measurements "
                "  (site_id, meter_id, timestamp_utc, active_power_w, quality_flag, source) "
                "VALUES (?, ?, ?, ?, 'OK', 'SIM_PUSH')",
                (SITE_ID, db_mid, ts, round(meter['load_kw'] * 1000, 2)),
            )
            contributions[db_mid] = round(meter['load_kw'] * 1000, 2)

        # Aggregated power state with per-meter snapshot for overlay queries
        db.execute(
            "INSERT INTO power_states "
            "  (site_id, timestamp_utc, bplus_power_w, bminus_power_w, total_power_w, "
            "   pv_power_w, battery_soc_pct, valid_meter_count, invalid_meter_count, "
            "   meter_contributions_json) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (SITE_ID, ts,
             round(f['bplus_demand_w'], 2),
             round(f['bminus_demand_w'], 2),
             round(f['bplus_demand_w'] + f['bminus_demand_w'], 2),
             round(f['pv_w'], 2),
             round(s['soc_pct'], 1),
             len(s['meters']), 0,
             json.dumps(contributions) if contributions else None),
        )

        db.commit()
        db.close()
        print(f"[SIM_PUSH] {ts}  B+={f['bplus_demand_w']:.0f}W  PV={f['pv_w']:.0f}W  SOC={s['soc_pct']:.0f}%")
        return {"ok": True, "ts": ts, "flow": f}

    except Exception as e:
        return {"ok": False, "error": str(e)}


def _log_smartmeter(db: sqlite3.Connection, cid: str | None, pact: str | None,
                    ldt: str | None, meter_id: str | None,
                    status: str, error_msg: str | None, source_ip: str | None) -> None:
    try:
        db.execute(
            "INSERT INTO smartmeter_log(cid, pact_str, ldt, meter_id, status, error_msg, source_ip) "
            "VALUES (?, ?, ?, ?, ?, ?, ?)",
            (cid, pact, ldt, meter_id, status, error_msg, source_ip),
        )
    except Exception:
        pass  # log table may not exist on old DBs — never block the main flow


@app.post("/smartmeter")
async def smartmeter_push(reading: SmartMeterReading, request: Request):
    """
    Fire-and-forget SmartMeter hardware push.
    Maps CID → meter_id via DB, writes one measurement row,
    then refreshes power_states from latest readings of all meters.
    """
    source_ip = request.client.host if request.client else None

    if not ELLA_DB_PATH or not os.path.exists(ELLA_DB_PATH):
        return {"ok": False, "error": "EMS database not accessible"}

    try:
        pact_kw = float(reading.Pact)
    except (ValueError, TypeError):
        try:
            db_err = sqlite3.connect(ELLA_DB_PATH, timeout=3)
            _log_smartmeter(db_err, reading.CID, reading.Pact, reading.LDT,
                            None, 'ERROR', f"Ungültiger Pact-Wert: {reading.Pact!r}", source_ip)
            db_err.commit(); db_err.close()
        except Exception:
            pass
        return {"ok": False, "error": f"Ungültiger Pact-Wert: {reading.Pact!r}"}

    try:
        db = sqlite3.connect(ELLA_DB_PATH, timeout=10)
        db.execute('PRAGMA journal_mode=WAL')
        db.execute('PRAGMA foreign_keys=ON')

        # Resolve CID → meter_id
        row = db.execute(
            "SELECT id FROM meters WHERE cid = ? AND is_active = 1", (reading.CID,)
        ).fetchone()
        if not row:
            _log_smartmeter(db, reading.CID, reading.Pact, reading.LDT,
                            None, 'ERROR', f"Unbekannte CID: {reading.CID}", source_ip)
            db.commit(); db.close()
            return {"ok": False, "error": f"Unbekannte CID: {reading.CID}"}
        meter_id = row[0]

        # Parse LDT timestamp → UTC; fall back to server time if absent or unparseable
        ts_str: str
        if reading.LDT:
            try:
                ts_str = datetime.fromisoformat(reading.LDT).astimezone(timezone.utc) \
                                 .isoformat(timespec='seconds').replace('+00:00', 'Z')
            except Exception:
                ts_str = datetime.now(timezone.utc).isoformat(timespec='seconds').replace('+00:00', 'Z')
        else:
            ts_str = datetime.now(timezone.utc).isoformat(timespec='seconds').replace('+00:00', 'Z')

        # Write measurement for this one meter
        db.execute(
            "INSERT INTO measurements "
            "  (site_id, meter_id, timestamp_utc, active_power_w, quality_flag, source) "
            "VALUES (?, ?, ?, ?, 'OK', 'HW_PUSH')",
            (SITE_ID, meter_id, ts_str, round(pact_kw * 1000, 2)),
        )

        # Recompute power_states from latest measurement per active meter.
        # STALE entries (written by meter-watchdog for timed-out meters) count
        # as invalid (0W). No time-window needed — watchdog handles timeouts.
        meter_rows = db.execute("""
            SELECT m.id, p.participant_status,
                   meas.active_power_w AS latest_w,
                   meas.quality_flag   AS latest_flag
            FROM meters m
            LEFT JOIN participants p ON p.meter_id = m.id AND p.is_active = 1
            LEFT JOIN measurements meas ON meas.id = (
                SELECT id FROM measurements WHERE meter_id = m.id
                ORDER BY timestamp_utc DESC LIMIT 1
            )
            WHERE m.site_id = ? AND m.is_active = 1
        """, (SITE_ID,)).fetchall()

        bplus_w = bminus_w = 0.0
        valid_count = invalid_count = 0
        contributions: dict = {}
        for mid, status, w, flag in meter_rows:
            if w is None or flag == 'STALE':
                invalid_count += 1
                contributions[mid] = 0.0
            else:
                valid_count += 1
                contributions[mid] = round(w, 2)
                if status == 'BPLUS':
                    bplus_w += w
                else:
                    bminus_w += w

        # Carry forward pv_power_w and battery_soc_pct from last power_states row
        last_ps = db.execute(
            "SELECT pv_power_w, battery_soc_pct FROM power_states WHERE site_id = ? "
            "ORDER BY timestamp_utc DESC LIMIT 1", (SITE_ID,)
        ).fetchone()
        pv_w = last_ps[0] if last_ps else None
        soc  = last_ps[1] if last_ps else None

        now_str = datetime.now(timezone.utc).isoformat(timespec='seconds').replace('+00:00', 'Z')
        db.execute(
            "INSERT INTO power_states "
            "  (site_id, timestamp_utc, bplus_power_w, bminus_power_w, total_power_w, "
            "   pv_power_w, battery_soc_pct, valid_meter_count, invalid_meter_count, "
            "   meter_contributions_json) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (SITE_ID, now_str,
             round(bplus_w, 2), round(bminus_w, 2), round(bplus_w + bminus_w, 2),
             pv_w, soc, valid_count, invalid_count,
             json.dumps(contributions)),
        )

        _log_smartmeter(db, reading.CID, reading.Pact, reading.LDT,
                        meter_id, 'OK', None, source_ip)
        db.commit()
        db.close()
        print(f"[HW_PUSH] {ts_str}  CID={reading.CID}  meter={meter_id}  {pact_kw:.3f} kW")
        return {"ok": True, "meter_id": meter_id, "kw": round(pact_kw, 3), "ts": ts_str}

    except Exception as e:
        return {"ok": False, "error": str(e)}


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8080, log_level="info")
