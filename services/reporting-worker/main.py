"""
Ella reporting-worker
Polls the reports table for PENDING jobs and generates PDF/CSV/ZIP files.
"""
import os
import time
import sqlite3
import traceback
from datetime import datetime, timezone
from pdf_reports import generate_resident_monthly, generate_operator_monthly
from csv_reports import generate_csv_detail, generate_diagnostics_zip

DB_PATH     = os.environ.get('ELLA_DB_PATH', '/data/ella-edge.db')
REPORTS_DIR = os.environ.get('REPORTS_DIR', '/reports')
SITE_ID     = os.environ.get('SITE_ID', 'site-demo-01')
POLL_S      = 10


def get_db():
    db = sqlite3.connect(DB_PATH)
    db.execute('PRAGMA journal_mode=WAL')
    db.execute('PRAGMA busy_timeout=5000')
    db.row_factory = sqlite3.Row
    return db


def process_job(db, job) -> None:
    job_id   = job['id']
    rtype    = job['report_type']
    month    = (job['period_from'] or '')[:7]  # YYYY-MM
    part_id  = job['participant_id']

    import json as _json
    params         = _json.loads(job['params'] or '{}')
    include_detail = params.get('include_detail', True)

    print(f"Processing job {job_id}: {rtype} month={month} participant={part_id} detail={include_detail}")

    if rtype == 'RESIDENT_MONTHLY':
        data = generate_resident_monthly(db, part_id, month, include_detail=include_detail)
        ext  = 'pdf'
        fmt  = 'PDF'

    elif rtype == 'OPERATOR_MONTHLY':
        data = generate_operator_monthly(db, SITE_ID, month)
        ext  = 'pdf'
        fmt  = 'PDF'

    elif rtype == 'CSV_DETAIL':
        data = generate_csv_detail(db, SITE_ID, month)
        ext  = 'csv'
        fmt  = 'CSV'

    elif rtype == 'DIAGNOSTICS':
        data = generate_diagnostics_zip(db, SITE_ID)
        ext  = 'zip'
        fmt  = 'ZIP'

    else:
        raise ValueError(f'Unknown report type: {rtype}')

    file_path = f'{REPORTS_DIR}/{job_id}.{ext}'
    os.makedirs(REPORTS_DIR, exist_ok=True)
    with open(file_path, 'wb') as f:
        f.write(data)

    db.execute("""
        UPDATE reports
        SET status='COMPLETED', file_path=?, file_format=?, completed_at=datetime('now')
        WHERE id=?
    """, (file_path, fmt, job_id))
    db.commit()
    print(f"Done: {file_path} ({len(data)} bytes)")


def run_once(db):
    jobs = db.execute("""
        SELECT * FROM reports WHERE status='PENDING'
        ORDER BY created_at ASC LIMIT 5
    """).fetchall()

    for job in jobs:
        db.execute("UPDATE reports SET status='PROCESSING' WHERE id=?", (job['id'],))
        db.commit()
        try:
            process_job(db, job)
        except Exception as e:
            db.execute(
                "UPDATE reports SET status='FAILED', completed_at=datetime('now') WHERE id=?",
                (job['id'],)
            )
            db.commit()
            print(f"ERROR job {job['id']}: {e}")
            traceback.print_exc()


def main():
    print(f"reporting-worker starting | reports_dir={REPORTS_DIR}")
    while True:
        try:
            db = get_db()
            run_once(db)
            db.close()
        except Exception as e:
            print(f"ERROR: {e}")
        time.sleep(POLL_S)


if __name__ == '__main__':
    main()
