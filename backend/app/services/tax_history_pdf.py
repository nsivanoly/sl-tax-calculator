"""PDF generation for Tax History — multi-year summary with charts for a single taxpayer."""
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
from reportlab.graphics.shapes import Drawing, String, Line
from reportlab.graphics.charts.barcharts import VerticalBarChart
from reportlab.graphics.charts.lineplots import LinePlot
from reportlab.graphics.charts.piecharts import Pie
from reportlab.graphics.charts.legends import Legend
from reportlab.graphics.widgets.markers import makeMarker

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
GREY = colors.HexColor("#8c8c8c")
GREY_LIGHT = colors.HexColor("#d9d9d9")


def _fmt(v: float | Decimal) -> str:
    return f"LKR {float(v):,.0f}"


def _fmt_short(v: float | Decimal) -> str:
    return f"{float(v):,.0f}"


def _fmt_compact(v: float) -> str:
    """Compact number for chart labels."""
    if abs(v) >= 1_000_000:
        return f"{v / 1_000_000:.1f}M"
    if abs(v) >= 1_000:
        return f"{v / 1_000:.0f}K"
    return f"{v:.0f}"


def _pct(v: float | Decimal) -> str:
    return f"{float(v):.1f}%"


class FilingData:
    """Container for one filing's data used in the history PDF."""
    def __init__(self, fiscal_year: str, status: str, breakdown: TaxBreakdown):
        self.fiscal_year = fiscal_year
        self.status = status
        self.breakdown = breakdown


def _build_income_vs_tax_chart(filings: list[FilingData], width: float = 700, height: float = 220) -> Drawing:
    """Grouped bar chart: Gross Income vs Gross Tax vs Net Payable per FY."""
    d = Drawing(width, height)

    chart = VerticalBarChart()
    chart.x = 70
    chart.y = 35
    chart.width = width - 120
    chart.height = height - 75

    chart.data = [
        [float(f.breakdown.gross_income.total) for f in filings],
        [float(f.breakdown.gross_tax) for f in filings],
        [float(f.breakdown.net_tax_payable) for f in filings],
    ]
    chart.categoryAxis.categoryNames = [f"FY {f.fiscal_year}" for f in filings]
    chart.categoryAxis.labels.fontName = "Helvetica"
    chart.categoryAxis.labels.fontSize = 9

    chart.valueAxis.valueMin = 0
    chart.valueAxis.labels.fontName = "Helvetica"
    chart.valueAxis.labels.fontSize = 8
    chart.valueAxis.labelTextFormat = lambda v: _fmt_compact(v)
    chart.valueAxis.gridStrokeColor = GREY_LIGHT

    chart.bars[0].fillColor = GREEN_LIGHT
    chart.bars[0].strokeColor = GREEN
    chart.bars[1].fillColor = RED_LIGHT
    chart.bars[1].strokeColor = RED
    chart.bars[2].fillColor = ORANGE
    chart.bars[2].strokeColor = colors.HexColor("#d48806")

    chart.barWidth = 20
    chart.groupSpacing = 25
    chart.barSpacing = 3

    d.add(chart)

    # Title
    d.add(String(width / 2, height - 10, "Income vs Tax by Fiscal Year",
                 textAnchor="middle", fontName="Helvetica-Bold", fontSize=12, fillColor=colors.HexColor("#1a1a2e")))

    # Legend — positioned below title, left of center to avoid chart area
    legend = Legend()
    legend.x = width - 180
    legend.y = height - 30
    legend.fontName = "Helvetica"
    legend.fontSize = 8
    legend.alignment = "right"
    legend.columnMaximum = 1
    legend.colorNamePairs = [
        (GREEN_LIGHT, "Gross Income"),
        (RED_LIGHT, "Gross Tax"),
        (ORANGE, "Net Payable"),
    ]
    d.add(legend)

    return d


def _build_income_composition_chart(filings: list[FilingData], width: float = 700, height: float = 220) -> Drawing:
    """Stacked bar chart: income composition (salary, interest, foreign, other) per FY."""
    d = Drawing(width, height)

    chart = VerticalBarChart()
    chart.x = 70
    chart.y = 35
    chart.width = width - 120
    chart.height = height - 75

    chart.data = [
        [float(f.breakdown.gross_income.salary) for f in filings],
        [float(f.breakdown.gross_income.interest) for f in filings],
        [float(f.breakdown.gross_income.foreign_employment) for f in filings],
        [float(f.breakdown.gross_income.other) for f in filings],
    ]
    chart.categoryAxis.categoryNames = [f"FY {f.fiscal_year}" for f in filings]
    chart.categoryAxis.labels.fontName = "Helvetica"
    chart.categoryAxis.labels.fontSize = 9
    chart.categoryAxis.style = "stacked"

    chart.valueAxis.valueMin = 0
    chart.valueAxis.labels.fontName = "Helvetica"
    chart.valueAxis.labels.fontSize = 8
    chart.valueAxis.labelTextFormat = lambda v: _fmt_compact(v)
    chart.valueAxis.gridStrokeColor = GREY_LIGHT

    bar_colors = [
        colors.HexColor("#52c41a"),  # salary - green
        colors.HexColor("#1890ff"),  # interest - blue
        colors.HexColor("#722ed1"),  # foreign - purple
        colors.HexColor("#fa8c16"),  # other - orange
    ]
    for i, c in enumerate(bar_colors):
        chart.bars[i].fillColor = c
        chart.bars[i].strokeColor = None

    chart.barWidth = 50
    chart.groupSpacing = 30

    d.add(chart)

    # Title
    d.add(String(width / 2, height - 10, "Income Composition by Source",
                 textAnchor="middle", fontName="Helvetica-Bold", fontSize=12, fillColor=colors.HexColor("#1a1a2e")))

    # Legend — horizontal, below title
    legend = Legend()
    legend.x = width - 200
    legend.y = height - 30
    legend.fontName = "Helvetica"
    legend.fontSize = 8
    legend.alignment = "right"
    legend.columnMaximum = 1
    legend.colorNamePairs = [
        (bar_colors[0], "Salary"),
        (bar_colors[1], "Interest"),
        (bar_colors[2], "Foreign"),
        (bar_colors[3], "Other"),
    ]
    d.add(legend)

    return d


def _build_effective_rate_chart(filings: list[FilingData], width: float = 700, height: float = 200) -> Drawing:
    """Line chart: effective tax rate trend over fiscal years."""
    d = Drawing(width, height)

    rates = [float(f.breakdown.effective_rate_pct) for f in filings]
    max_rate = max(rates) if rates else 30

    chart = LinePlot()
    chart.x = 70
    chart.y = 35
    chart.width = width - 120
    chart.height = height - 70

    chart.data = [[(i, r) for i, r in enumerate(rates)]]

    chart.xValueAxis.valueMin = -0.3
    chart.xValueAxis.valueMax = len(filings) - 0.7
    chart.xValueAxis.valueSteps = list(range(len(filings)))
    chart.xValueAxis.labelTextFormat = lambda v: f"FY {filings[int(v)].fiscal_year}" if 0 <= int(v) < len(filings) else ""
    chart.xValueAxis.labels.fontName = "Helvetica"
    chart.xValueAxis.labels.fontSize = 9

    chart.yValueAxis.valueMin = 0
    chart.yValueAxis.valueMax = max_rate * 1.3
    chart.yValueAxis.labels.fontName = "Helvetica"
    chart.yValueAxis.labels.fontSize = 8
    chart.yValueAxis.labelTextFormat = lambda v: f"{v:.0f}%"
    chart.yValueAxis.gridStrokeColor = GREY_LIGHT

    chart.lines[0].strokeColor = PURPLE
    chart.lines[0].strokeWidth = 3
    chart.lines[0].symbol = makeMarker("FilledCircle")
    chart.lines[0].symbol.size = 8
    chart.lines[0].symbol.fillColor = PURPLE

    d.add(chart)

    # Add rate labels on each point — offset first label right to avoid y-axis overlap
    for i, rate in enumerate(rates):
        x_pos = chart.x + (i / max(len(filings) - 1, 1)) * chart.width if len(filings) > 1 else chart.x + chart.width / 2
        y_pos = chart.y + (rate / (max_rate * 1.3)) * chart.height
        anchor = "start" if i == 0 else "middle"
        x_offset = 10 if i == 0 else 0
        d.add(String(x_pos + x_offset, y_pos + 10, f"{rate:.1f}%",
                     textAnchor=anchor, fontName="Helvetica-Bold", fontSize=9, fillColor=PURPLE))

    # Title
    d.add(String(width / 2, height - 10, "Effective Tax Rate Trend",
                 textAnchor="middle", fontName="Helvetica-Bold", fontSize=12, fillColor=colors.HexColor("#1a1a2e")))

    return d


def _build_credits_breakdown_chart(filings: list[FilingData], width: float = 700, height: float = 200) -> Drawing:
    """Stacked bar chart: credits breakdown (WHT, PAYE, Self-Assessment) per FY."""
    d = Drawing(width, height)

    chart = VerticalBarChart()
    chart.x = 70
    chart.y = 35
    chart.width = width - 120
    chart.height = height - 70

    chart.data = [
        [float(f.breakdown.credits.wht_on_interest) for f in filings],
        [float(f.breakdown.credits.paye_deducted) for f in filings],
        [float(f.breakdown.credits.self_assessment_paid) for f in filings],
    ]
    chart.categoryAxis.categoryNames = [f"FY {f.fiscal_year}" for f in filings]
    chart.categoryAxis.labels.fontName = "Helvetica"
    chart.categoryAxis.labels.fontSize = 9
    chart.categoryAxis.style = "stacked"

    chart.valueAxis.valueMin = 0
    chart.valueAxis.labels.fontName = "Helvetica"
    chart.valueAxis.labels.fontSize = 8
    chart.valueAxis.labelTextFormat = lambda v: _fmt_compact(v)
    chart.valueAxis.gridStrokeColor = GREY_LIGHT

    credit_colors = [
        colors.HexColor("#1890ff"),  # WHT - blue
        colors.HexColor("#13c2c2"),  # PAYE - cyan
        colors.HexColor("#fa8c16"),  # Self-assessment - orange
    ]
    for i, c in enumerate(credit_colors):
        chart.bars[i].fillColor = c
        chart.bars[i].strokeColor = None

    chart.barWidth = 50
    chart.groupSpacing = 30

    d.add(chart)

    # Title
    d.add(String(width / 2, height - 10, "Credits & Deductions Breakdown",
                 textAnchor="middle", fontName="Helvetica-Bold", fontSize=12, fillColor=colors.HexColor("#1a1a2e")))

    # Legend — horizontal row below title
    legend = Legend()
    legend.x = width - 220
    legend.y = height - 30
    legend.fontName = "Helvetica"
    legend.fontSize = 8
    legend.alignment = "right"
    legend.columnMaximum = 1
    legend.colorNamePairs = [
        (credit_colors[0], "WHT"),
        (credit_colors[1], "PAYE"),
        (credit_colors[2], "Self-Assmt"),
    ]
    d.add(legend)

    return d


def generate_tax_history_pdf(
    taxpayer_name: str,
    filings: list[FilingData],
) -> io.BytesIO:
    """Generate a Tax History PDF with charts across multiple fiscal years."""
    buffer = io.BytesIO()
    pdf_title = f"Tax History — {taxpayer_name}"
    doc = SimpleDocTemplate(
        buffer,
        pagesize=landscape(A4),
        topMargin=18 * mm,
        bottomMargin=12 * mm,
        leftMargin=15 * mm,
        rightMargin=15 * mm,
        title=pdf_title,
        author=taxpayer_name,
        subject="Multi-Year Tax History Report",
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
    elements.append(Paragraph("Tax History Report", title_style))
    elements.append(Spacer(1, 4))
    fy_range = filings[0].fiscal_year if len(filings) == 1 else f"{filings[0].fiscal_year} – {filings[-1].fiscal_year}"
    elements.append(Paragraph(f"{taxpayer_name} — {fy_range}", subtitle_style))
    elements.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor("#1a7a3a")))
    elements.append(Spacer(1, 8))

    # ── Summary Metrics ──
    total_income = sum(float(f.breakdown.gross_income.total) for f in filings)
    total_gross_tax = sum(float(f.breakdown.gross_tax) for f in filings)
    total_net = sum(float(f.breakdown.net_tax_payable) for f in filings)
    total_wht = sum(float(f.breakdown.credits.wht_on_interest + f.breakdown.credits.paye_deducted) for f in filings)
    total_sa = sum(float(f.breakdown.credits.self_assessment_paid) for f in filings)
    avg_rate = (total_gross_tax / total_income * 100) if total_income > 0 else 0

    summary_data = [
        ["Gross Income", "Gross Tax", "Gross Payment", "Gross Credits", "Net Payable", "Avg. Rate"],
        ["Total from all sources", "Tax before credits", "Self-assessment + balance", "WHT + PAYE at source", "After all credits", "Gross tax ÷ income"],
        [
            _fmt(total_income),
            _fmt(total_gross_tax),
            _fmt(total_sa + max(total_net, 0)),
            _fmt(total_wht),
            _fmt(total_net),
            _pct(avg_rate),
        ],
    ]
    summary_table = Table(summary_data, colWidths=[130, 120, 130, 130, 120, 90])
    summary_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#e6f7ed")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.HexColor("#1a5c2a")),
        ("FONTSIZE", (0, 0), (-1, 0), 9),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("TEXTCOLOR", (0, 1), (-1, 1), colors.HexColor("#999999")),
        ("FONTSIZE", (0, 1), (-1, 1), 7),
        ("FONTSIZE", (0, 2), (-1, 2), 12),
        ("FONTNAME", (0, 2), (-1, 2), "Helvetica-Bold"),
        ("TEXTCOLOR", (0, 2), (0, 2), colors.HexColor("#1a7a3a")),
        ("TEXTCOLOR", (1, 2), (1, 2), RED),
        ("TEXTCOLOR", (2, 2), (2, 2), ORANGE),
        ("TEXTCOLOR", (3, 2), (3, 2), BLUE),
        ("TEXTCOLOR", (4, 2), (4, 2), RED if total_net > 0 else GREEN),
        ("TEXTCOLOR", (5, 2), (5, 2), PURPLE),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#d9d9d9")),
        ("BOX", (0, 0), (-1, -1), 1, GREEN),
    ]))
    elements.append(summary_table)
    elements.append(Spacer(1, 6))

    # ── Charts — full width, vertical stack ──
    elements.append(Paragraph("Visual Analysis", section_style))

    # Available width inside margins ≈ 267mm ≈ 757pt for landscape A4
    chart_w = 750
    chart1 = _build_income_vs_tax_chart(filings, chart_w, 220)
    chart2 = _build_income_composition_chart(filings, chart_w, 220)
    elements.append(chart1)
    elements.append(Spacer(1, 12))
    elements.append(chart2)

    # Page break before second pair of charts + table
    elements.append(PageBreak())

    chart3 = _build_effective_rate_chart(filings, chart_w, 200)
    chart4 = _build_credits_breakdown_chart(filings, chart_w, 200)
    elements.append(chart3)
    elements.append(Spacer(1, 12))
    elements.append(chart4)
    elements.append(Spacer(1, 16))

    # ── Year-by-Year Comparison Table ──
    elements.append(Paragraph("Year-by-Year Comparison", section_style))

    header = ["", *[f"FY {f.fiscal_year}" for f in filings]]
    status_row = ["Status", *[f.status.upper() for f in filings]]

    rows = [
        header,
        status_row,
        ["Salary", *[_fmt_short(f.breakdown.gross_income.salary) for f in filings]],
        ["Interest", *[_fmt_short(f.breakdown.gross_income.interest) for f in filings]],
        ["Foreign Income", *[_fmt_short(f.breakdown.gross_income.foreign_employment) for f in filings]],
        ["Other", *[_fmt_short(f.breakdown.gross_income.other) for f in filings]],
        ["Gross Income", *[_fmt_short(f.breakdown.gross_income.total) for f in filings]],
        ["Interest Exemption", *[_fmt_short(f.breakdown.exemptions.interest_exempt_amount) for f in filings]],
        ["Tax-Free Allowance", *[_fmt_short(f.breakdown.tax_free_allowance) for f in filings]],
        ["Gross Tax", *[_fmt_short(f.breakdown.gross_tax) for f in filings]],
        ["WHT on Interest", *[_fmt_short(f.breakdown.credits.wht_on_interest) for f in filings]],
        ["PAYE Deducted", *[_fmt_short(f.breakdown.credits.paye_deducted) for f in filings]],
        ["Self-Assessment", *[_fmt_short(f.breakdown.credits.self_assessment_paid) for f in filings]],
        ["Total Credits", *[_fmt_short(f.breakdown.credits.total_credits) for f in filings]],
        ["Net Tax Payable", *[_fmt_short(f.breakdown.net_tax_payable) for f in filings]],
        ["Effective Rate", *[_pct(f.breakdown.effective_rate_pct) for f in filings]],
    ]

    label_w = 130
    fy_w = max(90, min(140, (700 - label_w) // max(len(filings), 1)))
    col_widths = [label_w] + [fy_w] * len(filings)

    comparison_table = Table(rows, colWidths=col_widths)

    gross_income_row, gross_tax_row = 6, 9
    total_credits_row, net_row, rate_row = 13, 14, 15

    comparison_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1a5c2a")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, 0), 10),
        ("BACKGROUND", (0, 1), (-1, 1), colors.HexColor("#f5f5f5")),
        ("FONTSIZE", (0, 1), (-1, 1), 8),
        ("TEXTCOLOR", (0, 1), (-1, 1), GREY),
        ("FONTSIZE", (0, 2), (-1, -1), 9),
        ("ALIGN", (1, 0), (-1, -1), "RIGHT"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("LEFTPADDING", (0, 0), (0, -1), 8),
        ("RIGHTPADDING", (1, 0), (-1, -1), 8),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#e8e8e8")),
        ("BOX", (0, 0), (-1, -1), 1, colors.HexColor("#d9d9d9")),
        ("BACKGROUND", (0, gross_income_row), (-1, gross_income_row), colors.HexColor("#e6f7ed")),
        ("FONTNAME", (0, gross_income_row), (-1, gross_income_row), "Helvetica-Bold"),
        ("BACKGROUND", (0, gross_tax_row), (-1, gross_tax_row), colors.HexColor("#fff2f0")),
        ("FONTNAME", (0, gross_tax_row), (-1, gross_tax_row), "Helvetica-Bold"),
        ("BACKGROUND", (0, total_credits_row), (-1, total_credits_row), colors.HexColor("#e6f4ff")),
        ("FONTNAME", (0, total_credits_row), (-1, total_credits_row), "Helvetica-Bold"),
        ("BACKGROUND", (0, net_row), (-1, net_row), colors.HexColor("#f0f0f0")),
        ("FONTNAME", (0, net_row), (-1, net_row), "Helvetica-Bold"),
        ("FONTSIZE", (0, net_row), (-1, net_row), 11),
        ("BACKGROUND", (0, rate_row), (-1, rate_row), colors.HexColor("#f9f0ff")),
        ("FONTNAME", (0, rate_row), (-1, rate_row), "Helvetica-Bold"),
    ]))
    elements.append(comparison_table)

    # ── Per-FY Slab Breakdown ──
    for filing_data in filings:
        bd = filing_data.breakdown
        elements.append(Paragraph(f"FY {filing_data.fiscal_year} — Slab Breakdown", section_style))

        slab_rows = [["Slab", "Taxable Amount", "Rate", "Tax"]]
        for slab in bd.domestic_tax.slab_breakdown:
            slab_rows.append([
                slab.label,
                _fmt(slab.taxable_in_slab),
                f"{float(slab.rate) * 100:.0f}%",
                _fmt(slab.tax),
            ])
        slab_rows.append(["Total", "", "", _fmt(bd.gross_tax)])

        slab_table = Table(slab_rows, colWidths=[180, 130, 60, 130])
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
