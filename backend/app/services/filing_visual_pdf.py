"""Visual PDF for a single filing — includes charts alongside tables."""
import io
from decimal import Decimal

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
    HRFlowable,
    PageBreak,
)
from reportlab.graphics.shapes import Drawing, String, Rect
from reportlab.graphics.charts.barcharts import VerticalBarChart
from reportlab.graphics.charts.piecharts import Pie
from reportlab.graphics.charts.legends import Legend

from app.schemas.calculation import TaxBreakdown

# ── Color palette ──
GREEN = colors.HexColor("#1a7a3a")
GREEN_LIGHT = colors.HexColor("#52c41a")
RED = colors.HexColor("#cf1322")
RED_LIGHT = colors.HexColor("#ff7875")
BLUE = colors.HexColor("#1890ff")
BLUE_LIGHT = colors.HexColor("#69c0ff")
ORANGE = colors.HexColor("#fa8c16")
PURPLE = colors.HexColor("#722ed1")
CYAN = colors.HexColor("#13c2c2")
GREY = colors.HexColor("#8c8c8c")
GREY_LIGHT = colors.HexColor("#d9d9d9")

PIE_COLORS = [GREEN_LIGHT, BLUE, PURPLE, ORANGE]
SLAB_COLORS = [
    colors.HexColor("#f0f5ff"),  # 0%
    colors.HexColor("#bae7ff"),  # 6%
    colors.HexColor("#91d5ff"),  # 12%
    colors.HexColor("#69c0ff"),  # 18%
    colors.HexColor("#40a9ff"),  # 24%
    colors.HexColor("#1890ff"),  # 30%
    colors.HexColor("#096dd9"),  # 36%
]


def _fmt(v: float | Decimal) -> str:
    return f"LKR {float(v):,.0f}"


def _fmt_short(v: float | Decimal) -> str:
    return f"{float(v):,.0f}"


def _fmt_compact(v: float) -> str:
    if abs(v) >= 1_000_000:
        return f"{v / 1_000_000:.1f}M"
    if abs(v) >= 1_000:
        return f"{v / 1_000:.0f}K"
    return f"{v:.0f}"


def _pct(v: float | Decimal) -> str:
    return f"{float(v):.1f}%"


def _build_income_pie(breakdown: TaxBreakdown, width: float = 340, height: float = 220) -> Drawing:
    """Pie chart: income by category."""
    d = Drawing(width, height)

    data_items = [
        ("Salary", float(breakdown.gross_income.salary)),
        ("Interest", float(breakdown.gross_income.interest)),
        ("Foreign", float(breakdown.gross_income.foreign_employment)),
        ("Other", float(breakdown.gross_income.other)),
    ]
    # Filter out zero values
    filtered = [(n, v) for n, v in data_items if v > 0]
    if not filtered:
        d.add(String(width / 2, height / 2, "No income data",
                     textAnchor="middle", fontName="Helvetica", fontSize=10, fillColor=GREY))
        return d

    names, values = zip(*filtered)

    pie = Pie()
    pie.x = 40
    pie.y = 20
    pie.width = 160
    pie.height = 160
    pie.data = values
    pie.labels = None
    pie.sideLabels = False
    pie.slices.strokeWidth = 1
    pie.slices.strokeColor = colors.white

    color_map = {"Salary": GREEN_LIGHT, "Interest": BLUE, "Foreign": PURPLE, "Other": ORANGE}
    for i, name in enumerate(names):
        pie.slices[i].fillColor = color_map.get(name, GREY)

    d.add(pie)

    # Title
    d.add(String(width / 2, height - 8, "Income by Category",
                 textAnchor="middle", fontName="Helvetica-Bold", fontSize=11, fillColor=colors.HexColor("#1a1a2e")))

    # Legend with values
    total = sum(values)
    legend = Legend()
    legend.x = 220
    legend.y = height - 50
    legend.fontName = "Helvetica"
    legend.fontSize = 9
    legend.alignment = "right"
    legend.columnMaximum = 5
    legend.colorNamePairs = [
        (color_map.get(n, GREY), f"{n}: {_fmt_compact(v)} ({v/total*100:.0f}%)")
        for n, v in zip(names, values)
    ]
    d.add(legend)

    return d


def _build_slab_chart(breakdown: TaxBreakdown, width: float = 370, height: float = 220) -> Drawing:
    """Bar chart showing tax per slab — each slab as separate series for individual colors."""
    d = Drawing(width, height)

    slabs = [s for s in breakdown.domestic_tax.slab_breakdown if float(s.tax) > 0]
    if not slabs:
        d.add(String(width / 2, height / 2, "No tax (within relief)",
                     textAnchor="middle", fontName="Helvetica", fontSize=10, fillColor=GREY))
        d.add(String(width / 2, height - 8, "Tax by Slab",
                     textAnchor="middle", fontName="Helvetica-Bold", fontSize=11, fillColor=colors.HexColor("#1a1a2e")))
        return d

    # Manual bar drawing for individual colors
    taxes = [float(s.tax) for s in slabs]
    labels = [f"{float(s.rate)*100:.0f}%" for s in slabs]
    max_tax = max(taxes) * 1.2

    chart_left = 60
    chart_bottom = 40
    chart_w = width - 90
    chart_h = height - 75
    bar_gap = 8
    bar_w = (chart_w - bar_gap * (len(slabs) - 1)) / len(slabs)
    bar_w = min(bar_w, 50)
    total_bars_w = bar_w * len(slabs) + bar_gap * (len(slabs) - 1)
    start_x = chart_left + (chart_w - total_bars_w) / 2

    # Grid lines
    for i in range(5):
        y_val = max_tax * i / 4
        y_pos = chart_bottom + (y_val / max_tax) * chart_h
        d.add(Rect(chart_left, y_pos, chart_w, 0.3, fillColor=GREY_LIGHT, strokeColor=None))
        d.add(String(chart_left - 8, y_pos - 3, _fmt_compact(y_val),
                     textAnchor="end", fontName="Helvetica", fontSize=7, fillColor=GREY))

    # Baseline
    d.add(Rect(chart_left, chart_bottom, chart_w, 0.5, fillColor=colors.HexColor("#333"), strokeColor=None))

    slab_bar_colors = [
        colors.HexColor("#bae7ff"),
        colors.HexColor("#91d5ff"),
        colors.HexColor("#69c0ff"),
        colors.HexColor("#40a9ff"),
        colors.HexColor("#1890ff"),
        colors.HexColor("#096dd9"),
        colors.HexColor("#0050b3"),
    ]

    for i, (tax, label) in enumerate(zip(taxes, labels)):
        x = start_x + i * (bar_w + bar_gap)
        bar_h = (tax / max_tax) * chart_h
        color = slab_bar_colors[i % len(slab_bar_colors)]
        d.add(Rect(x, chart_bottom, bar_w, bar_h, fillColor=color, strokeColor=None, rx=2))

        # Value on top
        d.add(String(x + bar_w / 2, chart_bottom + bar_h + 4, _fmt_compact(tax),
                     textAnchor="middle", fontName="Helvetica-Bold", fontSize=7, fillColor=color))
        # Rate label below
        d.add(String(x + bar_w / 2, chart_bottom - 14, label,
                     textAnchor="middle", fontName="Helvetica", fontSize=8, fillColor=colors.HexColor("#333")))

    # Title
    d.add(String(width / 2, height - 8, "Tax by Slab",
                 textAnchor="middle", fontName="Helvetica-Bold", fontSize=11, fillColor=colors.HexColor("#1a1a2e")))

    return d


def _build_waterfall_chart(breakdown: TaxBreakdown, width: float = 700, height: float = 220) -> Drawing:
    """Waterfall-style bar chart: Gross Income → deductions → Taxable → Tax → Credits → Net."""
    d = Drawing(width, height)

    gross = float(breakdown.gross_income.total)
    exemption = float(breakdown.exemptions.interest_exempt_amount)
    allowance = float(breakdown.tax_free_allowance)
    gross_tax = float(breakdown.gross_tax)
    credits_total = float(breakdown.credits.total_credits)
    net = float(breakdown.net_tax_payable)

    items = [
        ("Gross\nIncome", gross, GREEN_LIGHT, True),
        ("Interest\nExempt", -exemption, colors.HexColor("#ffd591"), False),
        ("Tax-Free\nAllowance", -allowance, colors.HexColor("#ffd591"), False),
        ("Gross\nTax", gross_tax, RED_LIGHT, True),
        ("Credits", -credits_total, BLUE_LIGHT, False),
        ("Net\nPayable", net, RED if net > 0 else GREEN_LIGHT, True),
    ]

    max_val = max(abs(v) for _, v, _, _ in items) * 1.15

    chart_left = 60
    chart_bottom = 40
    chart_width = width - 100
    chart_height = height - 80
    bar_width = chart_width / (len(items) * 2)

    # Y-axis
    d.add(String(chart_left - 5, chart_bottom + chart_height / 2, "",
                 textAnchor="middle", fontName="Helvetica", fontSize=8))

    # Grid lines
    for i in range(5):
        y_val = max_val * i / 4
        y_pos = chart_bottom + (y_val / max_val) * chart_height
        d.add(Rect(chart_left, y_pos, chart_width, 0.3, fillColor=GREY_LIGHT, strokeColor=None))
        d.add(String(chart_left - 8, y_pos - 3, _fmt_compact(y_val),
                     textAnchor="end", fontName="Helvetica", fontSize=7, fillColor=GREY))

    # Baseline
    d.add(Rect(chart_left, chart_bottom, chart_width, 0.5, fillColor=colors.HexColor("#333"), strokeColor=None))

    for i, (label, value, color, _) in enumerate(items):
        x = chart_left + (i * 2 + 0.5) * bar_width
        abs_val = abs(value)
        bar_h = (abs_val / max_val) * chart_height

        # Draw bar
        d.add(Rect(x, chart_bottom, bar_width, bar_h, fillColor=color, strokeColor=None, rx=3))

        # Value label
        d.add(String(x + bar_width / 2, chart_bottom + bar_h + 4, _fmt_compact(abs_val),
                     textAnchor="middle", fontName="Helvetica-Bold", fontSize=8,
                     fillColor=color))

        # Category label
        for li, line in enumerate(label.split("\n")):
            d.add(String(x + bar_width / 2, chart_bottom - 12 - li * 10, line,
                         textAnchor="middle", fontName="Helvetica", fontSize=7, fillColor=colors.HexColor("#333")))

    # Title
    d.add(String(width / 2, height - 8, "Tax Calculation Flow",
                 textAnchor="middle", fontName="Helvetica-Bold", fontSize=12, fillColor=colors.HexColor("#1a1a2e")))

    return d


def _build_credits_pie(breakdown: TaxBreakdown, width: float = 200, height: float = 200) -> Drawing:
    """Pie chart: credits breakdown (WHT, PAYE, Self-Assessment)."""
    d = Drawing(width, height)

    data_items = [
        ("WHT", float(breakdown.credits.wht_on_interest)),
        ("PAYE", float(breakdown.credits.paye_deducted)),
        ("Self-Assmt", float(breakdown.credits.self_assessment_paid)),
    ]
    filtered = [(n, v) for n, v in data_items if v > 0]
    if not filtered:
        d.add(String(width / 2, height / 2, "No credits",
                     textAnchor="middle", fontName="Helvetica", fontSize=9, fillColor=GREY))
        d.add(String(width / 2, height - 8, "Credits",
                     textAnchor="middle", fontName="Helvetica-Bold", fontSize=10, fillColor=colors.HexColor("#1a1a2e")))
        return d

    names, values = zip(*filtered)
    credit_colors = [BLUE, CYAN, ORANGE]

    pie_size = min(width - 20, 120)
    pie = Pie()
    pie.x = (width - pie_size) / 2
    pie.y = 30
    pie.width = pie_size
    pie.height = pie_size
    pie.data = values
    pie.labels = None
    pie.slices.strokeWidth = 1
    pie.slices.strokeColor = colors.white

    for i in range(len(filtered)):
        pie.slices[i].fillColor = credit_colors[i] if i < len(credit_colors) else GREY

    d.add(pie)

    # Title
    d.add(String(width / 2, height - 8, "Credits",
                 textAnchor="middle", fontName="Helvetica-Bold", fontSize=10, fillColor=colors.HexColor("#1a1a2e")))

    # Simple labels below pie
    total = sum(values)
    for i, (n, v) in enumerate(filtered):
        y_pos = 18 - i * 10
        c = credit_colors[i] if i < len(credit_colors) else GREY
        d.add(Rect(10, y_pos - 2, 8, 8, fillColor=c, strokeColor=None))
        d.add(String(22, y_pos - 1, f"{n} ({v/total*100:.0f}%)",
                     textAnchor="start", fontName="Helvetica", fontSize=7, fillColor=colors.HexColor("#333")))

    return d


def generate_filing_visual_pdf(
    breakdown: TaxBreakdown,
    fiscal_year: str,
    taxpayer_name: str,
    filing_status: str = "calculated",
) -> io.BytesIO:
    """Generate a visual filing summary PDF with charts."""
    buffer = io.BytesIO()
    pdf_title = f"Filing Summary — {taxpayer_name} — FY {fiscal_year}"
    doc = SimpleDocTemplate(
        buffer,
        pagesize=landscape(A4),
        topMargin=18 * mm,
        bottomMargin=12 * mm,
        leftMargin=15 * mm,
        rightMargin=15 * mm,
        title=pdf_title,
        author=taxpayer_name,
        subject=f"Tax Filing Summary for FY {fiscal_year}",
        creator="SL Tax Calculator",
    )

    styles = getSampleStyleSheet()

    title_style = ParagraphStyle(
        "CustomTitle", parent=styles["Title"],
        fontSize=22, textColor=colors.HexColor("#1a5c2a"), spaceAfter=4,
    )
    subtitle_style = ParagraphStyle(
        "CustomSubtitle", parent=styles["Normal"],
        fontSize=11, textColor=colors.grey, spaceAfter=12,
    )
    section_style = ParagraphStyle(
        "Section", parent=styles["Heading2"],
        fontSize=13, textColor=colors.HexColor("#1a7a3a"), spaceBefore=14, spaceAfter=6,
    )
    note_style = ParagraphStyle(
        "Note", parent=styles["Normal"], fontSize=8, textColor=colors.grey,
    )

    elements = []

    # ── Title ──
    elements.append(Paragraph("Filing Summary — Visual Report", title_style))
    elements.append(Spacer(1, 4))
    status_label = filing_status.upper()
    elements.append(Paragraph(f"{taxpayer_name} — FY {fiscal_year} — Status: {status_label}", subtitle_style))
    elements.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor("#1a7a3a")))
    elements.append(Spacer(1, 8))

    # ── Hero Metrics ──
    net_color = RED if float(breakdown.net_tax_payable) > 0 else GREEN
    hero_data = [
        ["Gross Income", "Gross Tax", "Total Credits", "Net Payable", "Eff. Rate"],
        [
            "All sources combined",
            "Before credits",
            "WHT + PAYE + Self-Assmt",
            "After all deductions",
            "Tax ÷ income",
        ],
        [
            _fmt(breakdown.gross_income.total),
            _fmt(breakdown.gross_tax),
            _fmt(breakdown.credits.total_credits),
            _fmt(breakdown.net_tax_payable),
            _pct(breakdown.effective_rate_pct),
        ],
    ]
    hero_table = Table(hero_data, colWidths=[145, 130, 145, 140, 90])
    hero_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#e6f7ed")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.HexColor("#1a5c2a")),
        ("FONTSIZE", (0, 0), (-1, 0), 9),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("TEXTCOLOR", (0, 1), (-1, 1), colors.HexColor("#999999")),
        ("FONTSIZE", (0, 1), (-1, 1), 7),
        ("FONTSIZE", (0, 2), (-1, 2), 13),
        ("FONTNAME", (0, 2), (-1, 2), "Helvetica-Bold"),
        ("TEXTCOLOR", (0, 2), (0, 2), GREEN),
        ("TEXTCOLOR", (1, 2), (1, 2), RED),
        ("TEXTCOLOR", (2, 2), (2, 2), BLUE),
        ("TEXTCOLOR", (3, 2), (3, 2), net_color),
        ("TEXTCOLOR", (4, 2), (4, 2), PURPLE),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#d9d9d9")),
        ("BOX", (0, 0), (-1, -1), 1, GREEN),
    ]))
    elements.append(hero_table)
    elements.append(Spacer(1, 8))

    # ── Charts Row 1: Income Pie + Slab Bar side by side ──
    elements.append(Paragraph("Visual Breakdown", section_style))

    income_pie = _build_income_pie(breakdown, 370, 220)
    slab_chart = _build_slab_chart(breakdown, 370, 220)

    chart_row = Table(
        [[income_pie, slab_chart]],
        colWidths=[380, 380],
        rowHeights=[230],
    )
    chart_row.setStyle(TableStyle([
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ]))
    elements.append(chart_row)

    # ── Page 2: Waterfall + Credits + Tables ──
    elements.append(PageBreak())

    # Waterfall chart — full width
    waterfall = _build_waterfall_chart(breakdown, 750, 230)
    elements.append(waterfall)
    elements.append(Spacer(1, 12))

    # ── Income + Credits Tables side by side ──
    # Income table
    income_rows = [
        ["Category", "Amount (LKR)"],
        ["Salary", _fmt_short(breakdown.gross_income.salary)],
        ["Interest", _fmt_short(breakdown.gross_income.interest)],
        ["Foreign Income", _fmt_short(breakdown.gross_income.foreign_employment)],
        ["Other", _fmt_short(breakdown.gross_income.other)],
        ["Total", _fmt_short(breakdown.gross_income.total)],
    ]
    income_table = Table(income_rows, colWidths=[140, 120])
    income_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#fafafa")),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("ALIGN", (1, 0), (1, -1), "RIGHT"),
        ("BACKGROUND", (0, -1), (-1, -1), colors.HexColor("#e6f7ed")),
        ("FONTNAME", (0, -1), (-1, -1), "Helvetica-Bold"),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#e8e8e8")),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))

    # Credits table
    credit_rows = [["Credit", "Amount (LKR)"]]
    credit_rows.append(["WHT on Interest", _fmt_short(breakdown.credits.wht_on_interest)])
    credit_rows.append(["PAYE Deducted", _fmt_short(breakdown.credits.paye_deducted)])
    if breakdown.credits.self_assessment_paid:
        credit_rows.append(["Self-Assessment", _fmt_short(breakdown.credits.self_assessment_paid)])
    for adj in breakdown.credits.adjustments:
        credit_rows.append([adj.label, _fmt_short(adj.amount)])
    credit_rows.append(["Total Credits", _fmt_short(breakdown.credits.total_credits)])

    credit_table = Table(credit_rows, colWidths=[140, 120])
    credit_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#fafafa")),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("ALIGN", (1, 0), (1, -1), "RIGHT"),
        ("BACKGROUND", (0, -1), (-1, -1), colors.HexColor("#e6f4ff")),
        ("FONTNAME", (0, -1), (-1, -1), "Helvetica-Bold"),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#e8e8e8")),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))

    # Credits pie
    credits_pie = _build_credits_pie(breakdown, 200, 200)

    tables_row = Table(
        [[income_table, credit_table, credits_pie]],
        colWidths=[280, 280, 210],
        rowHeights=[210],
    )
    tables_row.setStyle(TableStyle([
        ("ALIGN", (0, 0), (-1, -1), "LEFT"),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
    ]))
    elements.append(tables_row)

    # ── Slab Breakdown Table ──
    elements.append(Spacer(1, 8))
    elements.append(Paragraph("Slab Breakdown (Domestic)", section_style))

    slab_rows = [["Slab", "Taxable Amount", "Rate", "Tax"]]
    for slab in breakdown.domestic_tax.slab_breakdown:
        slab_rows.append([
            slab.label,
            _fmt(slab.taxable_in_slab),
            f"{float(slab.rate) * 100:.0f}%",
            _fmt(slab.tax),
        ])
    slab_rows.append(["Total", "", "", _fmt(breakdown.domestic_tax.tax)])

    slab_table = Table(slab_rows, colWidths=[200, 140, 70, 140])
    slab_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#fafafa")),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("ALIGN", (1, 0), (-1, -1), "RIGHT"),
        ("BACKGROUND", (0, -1), (-1, -1), colors.HexColor("#fff7e6")),
        ("FONTNAME", (0, -1), (-1, -1), "Helvetica-Bold"),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#e8e8e8")),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    elements.append(slab_table)

    # Foreign slabs if any
    if breakdown.foreign_tax.slab_breakdown:
        elements.append(Paragraph("Slab Breakdown (Foreign)", section_style))
        fslab_rows = [["Slab", "Taxable Amount", "Rate", "Tax"]]
        for slab in breakdown.foreign_tax.slab_breakdown:
            fslab_rows.append([
                slab.label,
                _fmt(slab.taxable_in_slab),
                f"{float(slab.rate) * 100:.0f}%",
                _fmt(slab.tax),
            ])
        fslab_rows.append(["Total", "", "", _fmt(breakdown.foreign_tax.tax)])
        fslab_table = Table(fslab_rows, colWidths=[200, 140, 70, 140])
        fslab_table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#fafafa")),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 9),
            ("ALIGN", (1, 0), (-1, -1), "RIGHT"),
            ("BACKGROUND", (0, -1), (-1, -1), colors.HexColor("#fff7e6")),
            ("FONTNAME", (0, -1), (-1, -1), "Helvetica-Bold"),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#e8e8e8")),
            ("TOPPADDING", (0, 0), (-1, -1), 4),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ]))
        elements.append(fslab_table)

    # ── Footer ──
    elements.append(Spacer(1, 16))
    elements.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#d9d9d9")))
    elements.append(Spacer(1, 4))
    elements.append(Paragraph(
        "Generated by SL Tax Calculator · All amounts in LKR · This is not an official document",
        note_style,
    ))

    doc.build(elements)
    buffer.seek(0)
    return buffer
