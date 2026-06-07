import os

db_path = r'C:\dev2\ella_ems\data\ella-edge.db'
wal_path = db_path + '-wal'
shm_path = db_path + '-shm'

print(f'DB  size: {os.path.getsize(db_path):,} bytes')
print(f'WAL size: {os.path.getsize(wal_path):,} bytes' if os.path.exists(wal_path) else 'WAL: absent')
print(f'SHM size: {os.path.getsize(shm_path):,} bytes' if os.path.exists(shm_path) else 'SHM: absent')

with open(db_path, 'rb') as f:
    header = f.read(16)
print(f'Header : {header}')
print(f'Magic  : {"OK - valid SQLite" if header[:6] == b"SQLite" else "WRONG - not a SQLite file!"}')
