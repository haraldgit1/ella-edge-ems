import os, sqlite3, sys

db_path = r'C:\dev2\ella_ems\data\ella-edge.db'
shm     = db_path + '-shm'

if os.path.exists(shm):
    try:
        os.remove(shm)
        print('SHM removed')
    except Exception as e:
        print(f'SHM remove: {e}')

try:
    db = sqlite3.connect(db_path, timeout=10)
    db.execute('PRAGMA wal_checkpoint(TRUNCATE)')
    print('Reports:', db.execute('SELECT COUNT(*) FROM reports').fetchone()[0])
    print('Intervals:', db.execute('SELECT COUNT(*) FROM settlement_intervals').fetchone()[0])
    print('Measurements:', db.execute('SELECT COUNT(*) FROM measurements').fetchone()[0])
    db.close()
    print('DB OK')
except Exception as e:
    print(f'ERROR: {e}')
    sys.exit(1)
