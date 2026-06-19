"""PDF report generation using fpdf2 with DejaVu Unicode fonts."""
from fpdf import FPDF
from datetime import datetime
from zoneinfo import ZoneInfo
import os

_TZ = ZoneInfo('Europe/Vienna')

def _to_local(utc_str: str) -> str:
    """UTC ISO-String → Wien Lokalzeit als 'DD.MM.YYYY HH:MM'."""
    dt = datetime.fromisoformat(utc_str.replace('Z', '+00:00'))
    return dt.astimezone(_TZ).strftime('%d.%m.%Y %H:%M')

GREEN  = (22, 101, 52)
DKGRAY = (31, 41, 55)
LTGRAY = (156, 163, 175)
WHITE  = (255, 255, 255)
BGROW  = (243, 244, 246)

FONT_DIR = '/usr/share/fonts/truetype/dejavu'
FONT_REGULAR = os.path.join(FONT_DIR, 'DejaVuSans.ttf')
FONT_BOLD    = os.path.join(FONT_DIR, 'DejaVuSans-Bold.ttf')


def _month_label(month: str) -> str:
    y, m = month.split('-')
    names = ['', 'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
             'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember']
    return f"{names[int(m)]} {y}"


class EllaReportBase(FPDF):
    def __init__(self, title: str):
        super().__init__()
        self._title = title
        self.add_font('DejaVu',  '',  FONT_REGULAR)
        self.add_font('DejaVu',  'B', FONT_BOLD)

    def header(self):
        self.set_fill_color(*GREEN)
        self.rect(0, 0, 210, 22, 'F')
        self.set_text_color(*WHITE)
        self.set_font('DejaVu', 'B', 13)
        self.set_xy(10, 6)
        self.cell(100, 10, 'Ella Edge EMS')
        self.set_font('DejaVu', '', 11)
        self.set_xy(110, 6)
        self.cell(90, 10, self._title, align='R')
        self.set_text_color(*DKGRAY)
        self.ln(18)

    def footer(self):
        self.set_y(-12)
        self.set_font('DejaVu', '', 8)
        self.set_text_color(*LTGRAY)
        self.cell(0, 8, f'Ella Edge EMS  ·  Seite {self.page_no()}  ·  Erstellt: {datetime.now().strftime("%d.%m.%Y %H:%M")}', align='C')

    def section(self, text: str):
        self.set_font('DejaVu', 'B', 10)
        self.set_fill_color(*DKGRAY)
        self.set_text_color(*WHITE)
        self.cell(0, 7, f'  {text}', fill=True, new_x='LMARGIN', new_y='NEXT')
        self.set_text_color(*DKGRAY)
        self.ln(1)

    def kv(self, key: str, value: str, bg: bool = False):
        self.set_font('DejaVu', '', 9)
        if bg:
            self.set_fill_color(*BGROW)
            fill = True
        else:
            fill = False
        self.set_text_color(*LTGRAY)
        self.cell(70, 6, key, fill=fill)
        self.set_text_color(*DKGRAY)
        self.set_font('DejaVu', 'B', 9)
        self.cell(0, 6, value, fill=fill, new_x='LMARGIN', new_y='NEXT')

    def kv_wide(self, key: str, value: str, bg: bool = False):
        """Key-value row with wide label (125 mm) and right-aligned value (65 mm).
        Use for cost-breakdown lines where the label includes a calculation formula."""
        self.set_font('DejaVu', '', 9)
        fill = bg
        if bg:
            self.set_fill_color(*BGROW)
        self.set_text_color(*LTGRAY)
        self.cell(125, 6, key, fill=fill)
        self.set_text_color(*DKGRAY)
        self.set_font('DejaVu', 'B', 9)
        self.cell(65, 6, value, fill=fill, align='R', new_x='LMARGIN', new_y='NEXT')

    def kv_total(self, key: str, value: str):
        """Bold summary row with green background — for totals and savings."""
        self.set_fill_color(*GREEN)
        self.set_text_color(*WHITE)
        self.set_font('DejaVu', 'B', 9)
        self.cell(125, 7, f'  {key}', fill=True)
        self.cell(65, 7, value, fill=True, align='R', new_x='LMARGIN', new_y='NEXT')
        self.set_text_color(*DKGRAY)

    def mix_bar(self, local_pct: float, width: int = 170):
        local_w = int(width * local_pct / 100)
        grid_w  = width - local_w
        x, y = self.get_x(), self.get_y()

        if local_w > 0:
            self.set_fill_color(*GREEN)
            self.rect(x, y, local_w, 8, 'F')

        if grid_w > 0:
            self.set_fill_color(107, 114, 128)
            self.rect(x + local_w, y, grid_w, 8, 'F')

        self.set_font('DejaVu', '', 7)
        self.set_text_color(*WHITE)
        self.set_xy(x + 2, y + 1.5)
        self.cell(local_w - 4, 5, f'{local_pct:.0f}% lokal' if local_w > 30 else '')
        self.set_xy(x + local_w + 2, y + 1.5)
        self.cell(grid_w - 4, 5, f'{100 - local_pct:.0f}% Netz' if grid_w > 30 else '')
        self.set_text_color(*DKGRAY)
        self.ln(12)

    def table_header(self, cols: list):
        self.set_font('DejaVu', 'B', 8)
        self.set_fill_color(*DKGRAY)
        self.set_text_color(*WHITE)
        for label, width, align in cols:
            self.cell(width, 6, label, fill=True, align=align)
        self.ln()
        self.set_text_color(*DKGRAY)

    def table_row(self, cols: list, even: bool = False):
        self.set_font('DejaVu', '', 8)
        if even:
            self.set_fill_color(*BGROW)
            fill = True
        else:
            fill = False
        for value, width, align in cols:
            self.cell(width, 5.5, str(value), fill=fill, align=align)
        self.ln()


def generate_resident_monthly(db, participant_id: str, from_s: str, to_s: str, period_label: str, include_detail: bool = True) -> bytes:
    """PDF: Bewohner-Report (Monat oder Einzeltag)."""
    participant = db.execute(
        "SELECT * FROM participants WHERE id=?", (participant_id,)
    ).fetchone()
    if not participant:
        raise ValueError(f'Participant {participant_id} not found')

    tariff = None
    if participant['tariff_id']:
        tariff = db.execute(
            "SELECT * FROM tariffs WHERE id=?", (participant['tariff_id'],)
        ).fetchone()

    allocs = db.execute("""
        SELECT si.interval_start_utc,
               spa.consumption_wh, spa.local_energy_wh,
               spa.grid_energy_wh, spa.local_coverage_percent
        FROM settlement_participant_allocations spa
        JOIN settlement_intervals si ON si.id = spa.settlement_interval_id
        WHERE spa.participant_id = ?
          AND si.interval_start_utc >= ? AND si.interval_start_utc < ?
        ORDER BY si.interval_start_utc
    """, (participant_id, from_s, to_s)).fetchall()

    total_kwh  = sum(r['consumption_wh']  for r in allocs) / 1000
    local_kwh  = sum(r['local_energy_wh'] for r in allocs) / 1000
    grid_kwh   = sum(r['grid_energy_wh']  for r in allocs) / 1000
    coverage   = (local_kwh / total_kwh * 100) if total_kwh > 0 else 0

    cost_local    = None
    cost_service  = None
    cost_grid_part= None
    total_cost    = None
    ref_cost      = None
    savings       = None
    saving_per_kwh= None
    if tariff:
        lp  = tariff['local_price_ct_per_kwh']
        gp  = tariff['grid_price_ct_per_kwh']
        sp  = tariff['service_fee_ct_per_kwh']
        cost_local     = local_kwh * lp / 100
        cost_service   = local_kwh * sp / 100
        cost_grid_part = grid_kwh  * gp / 100
        total_cost     = cost_local + cost_service + cost_grid_part
        ref_cost       = total_kwh * gp / 100
        savings        = ref_cost - total_cost
        saving_per_kwh = (gp - lp - sp) / 100  # EUR/kWh

    pdf = EllaReportBase(f'Bewohner-Report {period_label}')
    pdf.add_page()

    pdf.section('Teilnehmer')
    pdf.kv('Name', participant['display_name'], bg=False)
    pdf.kv('Teilnahme', 'B+ Energiegemeinschaft', bg=True)
    pdf.kv('Zeitraum', period_label, bg=False)
    pdf.kv('Zähler', participant['meter_id'] or '-', bg=True)
    pdf.ln(3)

    pdf.section('Zusammenfassung')
    pdf.kv('Gesamtverbrauch', f'{total_kwh:.3f} kWh', bg=False)
    pdf.kv('Lokaler Gemeinschaftsstrom', f'{local_kwh:.3f} kWh', bg=True)
    pdf.kv('Ergänzung aus öffentlichem Netz', f'{grid_kwh:.3f} kWh', bg=False)
    pdf.kv('Lokaler Deckungsgrad', f'{coverage:.1f} %', bg=True)
    pdf.ln(3)

    pdf.section('Strommix')
    pdf.ln(2)
    pdf.set_x(20)
    pdf.mix_bar(coverage)
    pdf.ln(2)

    if tariff:
        pdf.section('Tarif')
        pdf.kv('Lokaler Strom', f'{lp:.2f} ct/kWh', bg=False)
        pdf.kv('Netzstrom (Referenz)', f'{gp:.2f} ct/kWh', bg=True)
        pdf.kv('Service-Gebühr', f'{sp:.2f} ct/kWh', bg=False)
        pdf.kv('Vorteil je kWh Lokalstrom', f'{saving_per_kwh * 100:.2f} ct/kWh  ({saving_per_kwh:.4f} EUR/kWh)', bg=True)
        pdf.ln(3)

        pdf.section('Kostenübersicht (geschätzt)')
        pdf.kv_wide(f'Lokalstrom  ({local_kwh:.3f} kWh × {lp:.2f} ct)',
                    f'{cost_local:.2f} EUR', bg=False)
        pdf.kv_wide(f'Service-Gebühr  ({local_kwh:.3f} kWh × {sp:.2f} ct)',
                    f'{cost_service:.2f} EUR', bg=True)
        pdf.kv_wide(f'Netzstrom  ({grid_kwh:.3f} kWh × {gp:.2f} ct)',
                    f'{cost_grid_part:.2f} EUR', bg=False)
        pdf.ln(1)
        pdf.kv_total('Gesamtkosten (B+ Tarif)', f'{total_cost:.2f} EUR')
        pdf.ln(2)
        pdf.kv_wide(f'Referenz reine Netzversorgung  ({total_kwh:.3f} kWh × {gp:.2f} ct)',
                    f'{ref_cost:.2f} EUR', bg=False)
        pdf.kv_total('Geschätzter Gesamtvorteil', f'{savings:.2f} EUR')
        pdf.ln(3)

    if include_detail and allocs:
        pdf.section(f'15-Minuten-Detailnachweis ({len(allocs)} Intervalle)')
        cols = [
            ('Zeitpunkt', 40, 'L'),
            ('Ø Leistung W', 30, 'R'),
            ('Verbrauch Wh', 30, 'R'),
            ('Lokal Wh', 28, 'R'),
            ('Netz Wh', 26, 'R'),
            ('Deckung %', 20, 'R'),
        ]
        pdf.table_header(cols)
        for i, r in enumerate(allocs):
            ts = _to_local(r['interval_start_utc'])
            avg_w = round(r['consumption_wh'] * 4)
            pdf.table_row([
                (ts, 40, 'L'),
                (f'{avg_w}', 30, 'R'),
                (f'{r["consumption_wh"]:.1f}', 30, 'R'),
                (f'{r["local_energy_wh"]:.1f}', 28, 'R'),
                (f'{r["grid_energy_wh"]:.1f}', 26, 'R'),
                (f'{r["local_coverage_percent"]:.1f}', 20, 'R'),
            ], even=(i % 2 == 0))
            if pdf.get_y() > 265:
                pdf.add_page()
                pdf.table_header(cols)

    elif not include_detail and allocs:
        pdf.set_font('DejaVu', '', 8)
        pdf.set_text_color(*LTGRAY)
        pdf.cell(0, 5, f'  15-Minuten-Detailnachweis nicht angefordert ({len(allocs)} Intervalle vorhanden — CSV-Export verfügbar)', new_x='LMARGIN', new_y='NEXT')

    return bytes(pdf.output())


def generate_operator_monthly(db, site_id: str, from_s: str, to_s: str, period_label: str) -> bytes:
    """PDF: Betreiber-Report (Monat oder Einzeltag)."""

    totals = db.execute("""
        SELECT COUNT(*) AS n,
               COALESCE(SUM(bplus_consumption_wh),0) AS bplus_wh,
               COALESCE(SUM(local_energy_available_wh),0) AS local_wh,
               COALESCE(SUM(bminus_consumption_wh),0) AS bminus_wh,
               COALESCE(AVG(local_allocation_factor),0) AS avg_factor,
               SUM(CASE WHEN plausibility_status='OK' THEN 1 ELSE 0 END) AS ok_n,
               SUM(CASE WHEN plausibility_status!='OK' THEN 1 ELSE 0 END) AS bad_n
        FROM settlement_intervals
        WHERE site_id=? AND interval_start_utc>=? AND interval_start_utc<?
    """, (site_id, from_s, to_s)).fetchone()

    participants = db.execute("""
        SELECT p.display_name, p.participant_status,
               COALESCE(SUM(spa.consumption_wh),0) AS c_wh,
               COALESCE(SUM(spa.local_energy_wh),0) AS l_wh,
               COALESCE(SUM(spa.grid_energy_wh),0) AS g_wh,
               COALESCE(AVG(spa.local_coverage_percent),0) AS cov
        FROM participants p
        LEFT JOIN settlement_participant_allocations spa ON spa.participant_id = p.id
        LEFT JOIN settlement_intervals si ON si.id = spa.settlement_interval_id
          AND si.interval_start_utc>=? AND si.interval_start_utc<?
        WHERE p.site_id=? AND p.is_active=1
        GROUP BY p.id ORDER BY p.participant_status DESC, p.display_name
    """, (from_s, to_s, site_id)).fetchall()

    alarms = db.execute("""
        SELECT alarm_class, alarm_code, message, triggered_at
        FROM alarms WHERE site_id=?
          AND triggered_at>=? AND triggered_at<?
        ORDER BY triggered_at DESC LIMIT 20
    """, (site_id, from_s[:10], to_s[:10])).fetchall()

    pdf = EllaReportBase(f'Betreiber-Report {period_label}')
    pdf.add_page()

    pdf.section('Energiebilanz')
    bplus_kwh = totals['bplus_wh'] / 1000
    local_kwh = totals['local_wh'] / 1000
    coverage  = totals['avg_factor'] * 100
    pdf.kv('B+ Gesamtverbrauch', f'{bplus_kwh:.3f} kWh', bg=False)
    pdf.kv('B- Gesamtverbrauch', f'{totals["bminus_wh"]/1000:.3f} kWh', bg=True)
    pdf.kv('Lokal verfügbar (PV/Speicher)', f'{local_kwh:.3f} kWh', bg=False)
    pdf.kv('Ø Lokaler Deckungsgrad B+', f'{coverage:.1f} %', bg=True)
    pdf.kv('Abgerechnete Intervalle', f'{totals["n"]} × 15 Min', bg=False)
    pdf.kv('Plausibilität OK / Abweichungen', f'{totals["ok_n"]} / {totals["bad_n"]}', bg=True)
    pdf.ln(3)

    pdf.section('Strommix Gesamtanlage')
    pdf.ln(2)
    pdf.set_x(20)
    pdf.mix_bar(coverage)
    pdf.ln(2)

    pdf.section('Teilnehmer-Übersicht')
    cols = [
        ('Teilnehmer', 62, 'L'),
        ('Status', 14, 'C'),
        ('Verbrauch kWh', 30, 'R'),
        ('Lokal kWh', 26, 'R'),
        ('Netz kWh', 26, 'R'),
        ('Deckung %', 22, 'R'),
    ]
    pdf.table_header(cols)
    for i, p in enumerate(participants):
        cov_str = f'{p["cov"]:.1f}' if p['participant_status'] == 'BPLUS' else '-'
        pdf.table_row([
            (p['display_name'], 62, 'L'),
            ('B+' if p['participant_status'] == 'BPLUS' else 'B-', 14, 'C'),
            (f'{p["c_wh"]/1000:.3f}', 30, 'R'),
            (f'{p["l_wh"]/1000:.3f}', 26, 'R'),
            (f'{p["g_wh"]/1000:.3f}', 26, 'R'),
            (cov_str, 22, 'R'),
        ], even=(i % 2 == 0))
    pdf.ln(3)

    if alarms:
        pdf.section(f'Alarme ({len(alarms)} im Zeitraum)')
        cols2 = [('Zeitpunkt', 40, 'L'), ('Klasse', 20, 'C'), ('Code', 40, 'L'), ('Meldung', 80, 'L')]
        pdf.table_header(cols2)
        for i, a in enumerate(alarms):
            pdf.table_row([
                (a['triggered_at'][:16].replace('T', ' '), 40, 'L'),
                (a['alarm_class'], 20, 'C'),
                (a['alarm_code'], 40, 'L'),
                (a['message'][:45], 80, 'L'),
            ], even=(i % 2 == 0))

    return bytes(pdf.output())


def _next_month(month: str) -> str:
    y, m = [int(x) for x in month.split('-')]
    return f'{y + 1}-01-01T00:00:00Z' if m == 12 else f'{y}-{m + 1:02d}-01T00:00:00Z'
