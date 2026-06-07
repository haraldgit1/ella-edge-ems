"""Ella Simulation API – standalone energy-flow simulator, optional EMS DB sync."""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone
import sqlite3
import os
import uvicorn

ELLA_DB_PATH = os.environ.get('ELLA_DB_PATH', '')  # empty = no DB sync available
SITE_ID      = 'site-demo-01'
# Simulation meter index → real DB meter ID (must match seed order)
DB_METER_IDS = ['meter-01', 'meter-02', 'meter-03', 'meter-04', 'meter-05', 'meter-06']

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
    load_kw: float
    is_bplus: bool


class SimUpdate(BaseModel):
    pv_kw:      Optional[float]           = None
    soc_pct:    Optional[float]           = None
    meters:     Optional[List[MeterState]] = None
    interval_s: Optional[int]             = None


def compute_flow(s: dict) -> dict:
    pv_w = s["pv_kw"] * 1000.0
    soc  = s["soc_pct"]

    bplus  = [m for m in s["meters"] if     m["is_bplus"]]
    bminus = [m for m in s["meters"] if not m["is_bplus"]]

    bplus_demand_w  = sum(m["load_kw"] * 1000 for m in bplus)
    bminus_demand_w = sum(m["load_kw"] * 1000 for m in bminus)

    discharge_avail_w = MAX_DISCHARGE_W if soc > 20 else 0.0

    if pv_w >= bplus_demand_w:
        pv_to_bplus_w       = bplus_demand_w
        surplus_w           = pv_w - bplus_demand_w
        battery_charge_w    = min(surplus_w, MAX_CHARGE_W)
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
def push_to_ems():
    """
    Write current simulation state into EMS DB tables.
    Writes: measurements (per meter) + power_states.
    The running inverter-controller will react and produce a control_decision.
    """
    if not ELLA_DB_PATH or not os.path.exists(ELLA_DB_PATH):
        return {"ok": False, "error": "EMS database not accessible"}

    s = state
    f = compute_flow(s)
    now = datetime.now(timezone.utc)
    ts  = now.isoformat(timespec='seconds').replace('+00:00', 'Z')

    try:
        db = sqlite3.connect(ELLA_DB_PATH, timeout=10)
        db.execute('PRAGMA journal_mode=WAL')
        db.execute('PRAGMA foreign_keys=ON')

        # Per-meter measurements (simulation index maps to DB meter order)
        for i, meter in enumerate(s['meters']):
            if i >= len(DB_METER_IDS):
                break
            db.execute(
                "INSERT INTO measurements "
                "  (site_id, meter_id, timestamp_utc, active_power_w, quality_flag, source) "
                "VALUES (?, ?, ?, ?, 'OK', 'SIM_PUSH')",
                (SITE_ID, DB_METER_IDS[i], ts, round(meter['load_kw'] * 1000, 2)),
            )

        # Aggregated power state (what the EMS dashboard reads)
        db.execute(
            "INSERT INTO power_states "
            "  (site_id, timestamp_utc, bplus_power_w, bminus_power_w, total_power_w, "
            "   pv_power_w, battery_soc_pct, valid_meter_count, invalid_meter_count) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (SITE_ID, ts,
             round(f['bplus_demand_w'], 2),
             round(f['bminus_demand_w'], 2),
             round(f['bplus_demand_w'] + f['bminus_demand_w'], 2),
             round(f['pv_w'], 2),
             round(s['soc_pct'], 1),
             len(s['meters']), 0),
        )

        db.commit()
        db.close()
        print(f"[SIM_PUSH] {ts}  B+={f['bplus_demand_w']:.0f}W  PV={f['pv_w']:.0f}W  SOC={s['soc_pct']:.0f}%")
        return {"ok": True, "ts": ts, "flow": f}

    except Exception as e:
        return {"ok": False, "error": str(e)}


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8080, log_level="info")
