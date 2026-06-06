-- Demo Seed – Ella Edge EMS
-- 1 Site, 1 Building, 6 Apartments, 4x B+, 2x B-

INSERT OR IGNORE INTO sites(id, name, address, timezone) VALUES
    ('site-demo-01', 'Ella Demo Anlage', 'Musterstraße 1, 1010 Wien', 'Europe/Vienna');

INSERT OR IGNORE INTO buildings(id, site_id, name) VALUES
    ('bld-01', 'site-demo-01', 'Haus A');

INSERT OR IGNORE INTO apartments(id, building_id, site_id, unit_label, floor) VALUES
    ('apt-01', 'bld-01', 'site-demo-01', 'Top 1', 0),
    ('apt-02', 'bld-01', 'site-demo-01', 'Top 2', 0),
    ('apt-03', 'bld-01', 'site-demo-01', 'Top 3', 1),
    ('apt-04', 'bld-01', 'site-demo-01', 'Top 4', 1),
    ('apt-05', 'bld-01', 'site-demo-01', 'Top 5', 2),
    ('apt-06', 'bld-01', 'site-demo-01', 'Top 6', 2);

INSERT OR IGNORE INTO meters(id, site_id, apartment_id, serial_number, protocol) VALUES
    ('meter-01', 'site-demo-01', 'apt-01', 'SIM-001', 'SIMULATION'),
    ('meter-02', 'site-demo-01', 'apt-02', 'SIM-002', 'SIMULATION'),
    ('meter-03', 'site-demo-01', 'apt-03', 'SIM-003', 'SIMULATION'),
    ('meter-04', 'site-demo-01', 'apt-04', 'SIM-004', 'SIMULATION'),
    ('meter-05', 'site-demo-01', 'apt-05', 'SIM-005', 'SIMULATION'),
    ('meter-06', 'site-demo-01', 'apt-06', 'SIM-006', 'SIMULATION');

INSERT OR IGNORE INTO devices(id, site_id, device_type, name, protocol, max_power_w) VALUES
    ('dev-inverter-01', 'site-demo-01', 'INVERTER', 'Wechselrichter SIM', 'SIMULATION', 10000),
    ('dev-battery-01',  'site-demo-01', 'BATTERY',  'Batterie SIM',       'SIMULATION', 8000);

INSERT OR IGNORE INTO tariffs(id, site_id, name, local_price_ct_per_kwh, grid_price_ct_per_kwh, service_fee_ct_per_kwh, valid_from) VALUES
    ('tariff-demo-01', 'site-demo-01', 'Demo Tarif 2026', 8.0, 28.0, 2.0, '2026-01-01');

-- 4x B+, 2x B-
INSERT OR IGNORE INTO participants(id, site_id, apartment_id, meter_id, tariff_id, display_name, participant_status, valid_from) VALUES
    ('part-01', 'site-demo-01', 'apt-01', 'meter-01', 'tariff-demo-01', 'Familie Müller (Top 1)',   'BPLUS',  '2026-01-01'),
    ('part-02', 'site-demo-01', 'apt-02', 'meter-02', 'tariff-demo-01', 'Hr. Schmidt (Top 2)',      'BPLUS',  '2026-01-01'),
    ('part-03', 'site-demo-01', 'apt-03', 'meter-03', 'tariff-demo-01', 'Fr. Berger (Top 3)',       'BPLUS',  '2026-01-01'),
    ('part-04', 'site-demo-01', 'apt-04', 'meter-04', 'tariff-demo-01', 'Familie Wagner (Top 4)',   'BPLUS',  '2026-01-01'),
    ('part-05', 'site-demo-01', 'apt-05', 'meter-05', NULL,             'Hr. Bauer (Top 5)',        'BMINUS', '2026-01-01'),
    ('part-06', 'site-demo-01', 'apt-06', 'meter-06', NULL,             'Fr. Huber (Top 6)',        'BMINUS', '2026-01-01');

-- Admin user (password: ella-admin-2026 — change in production!)
INSERT OR IGNORE INTO users(id, username, email, password_hash, display_name) VALUES
    ('user-admin-01', 'admin', 'admin@ella-edge.local',
     '$2b$10$placeholder_hash_change_before_use', 'Ella Admin');

INSERT OR IGNORE INTO user_roles(user_id, role_id, site_id) VALUES
    ('user-admin-01', 'role-admin', 'site-demo-01');
