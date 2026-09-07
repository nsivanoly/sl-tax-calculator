"""PDF generation for tax summary — visual layout using reportlab."""
import io
from decimal import Decimal

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
    HRFlowable,
)

from app.schemas.calculation import TaxBreakdown


def _fmt(v: float | Decimal) -> str:
    """Format a number as LKR with commas and 2 decimal places."""
    return f"LKR {float(v):,.2f}"


def _pct(v: float | Decimal) -> str:
    return f"{float(v):.2f}%"


def generate_tax_summary_pdf(
    breakdown: TaxBreakdown,
    fiscal_year: str,
    taxpayer_name: str,
    savings: float = 0.0,
    recommended_relief: str = "local",
) -> io.BytesIO:
    """Generate a visual PDF tax summary and return as a BytesIO buffer."""
    buffer = io.BytesIO()
    pdf_title = f"Tax Summary — {taxpayer_name} — FY {fiscal_year}"
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        topMargin=20 * mm,
        bottomMargin=15 * mm,
        leftMargin=20 * mm,
        rightMargin=20 * mm,
        title=pdf_title,
        author=taxpayer_name,
        subject=f"Income Tax Summary for FY {fiscal_year}",
        creator="SL Tax Calculator",
    )

    styles = getSampleStyleSheet()

    # Custom styles
    title_style = ParagraphStyle(
        "CustomTitle",
        parent=styles["Title"],
        fontSize=22,
        textColor=colors.HexColor("#1a5c2a"),
        spaceAfter=4,
    )
    subtitle_style = ParagraphStyle(
        "CustomSubtitle",
        parent=styles["Normal"],
        fontSize=11,
        textColor=colors.grey,
        spaceAfter=12,
    )
    section_style = ParagraphStyle(
        "Section",
        parent=styles["Heading2"],
        fontSize=14,
        textColor=colors.HexColor("#1a7a3a"),
        spaceBefore=16,
        spaceAfter=6,
    )
    note_style = ParagraphStyle(
        "Note",
        parent=styles["Normal"],
        fontSize=9,
        textColor=colors.grey,
    )

    elements = []

    # --- Title ---
    elements.append(Paragraph("Sri Lanka Income Tax Summary", title_style))
    elements.append(Spacer(1, 6))
    elements.append(Paragraph(f"Fiscal Year {fiscal_year} — {taxpayer_name}", subtitle_style))
    elements.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#1a7a3a")))
    elements.append(Spacer(1, 8))

    # --- Hero Stats ---
    hero_data = [
        ["Gross Income", "Gross Tax", "Already Paid / Deducted", "Net Tax Payable"],
        [
            _fmt(breakdown.gross_income.total),
            _fmt(breakdown.gross_tax),
            _fmt(breakdown.credits.total_credits),
            _fmt(breakdown.net_tax_payable),
        ],
    ]
    hero_table = Table(hero_data, colWidths=[120, 115, 135, 120])
    hero_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#e6f7ed")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.HexColor("#1a5c2a")),
        ("FONTSIZE", (0, 0), (-1, 0), 8),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 1), (-1, 1), 11),
        ("FONTNAME", (0, 1), (-1, 1), "Helvetica-Bold"),
        ("TEXTCOLOR", (2, 1), (2, 1), colors.HexColor("#1890ff")),
        ("TEXTCOLOR", (3, 1), (3, 1), colors.HexColor("#cf1322") if float(breakdown.net_tax_payable) > 0 else colors.HexColor("#1a7a3a")),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#d9d9d9")),
        ("BOX", (0, 0), (-1, -1), 1, colors.HexColor("#1a7a3a")),
    ]))
    elements.append(hero_table)
    elements.append(Spacer(1, 6))

    # --- Gross Income Breakdown ---
    elements.append(Paragraph("Income Breakdown", section_style))
    income_data = [
        ["Category", "Amount (LKR)"],
        ["Salary", _fmt(breakdown.gross_income.salary)],
        ["Interest", _fmt(breakdown.gross_income.interest)],
        ["Foreign Currency Income", _fmt(breakdown.gross_income.foreign_employment)],
        ["Other", _fmt(breakdown.gross_income.other)],
        ["Total", _fmt(breakdown.gross_income.total)],
    ]
    income_table = Table(income_data, colWidths=[250, 200])
    income_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#fafafa")),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 10),
        ("ALIGN", (1, 0), (1, -1), "RIGHT"),
        ("BACKGROUND", (0, -1), (-1, -1), colors.HexColor("#e6f7ed")),
        ("FONTNAME", (0, -1), (-1, -1), "Helvetica-Bold"),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#e8e8e8")),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ]))
    elements.append(income_table)

    # --- Exemptions & Relief ---
    elements.append(Paragraph("Exemptions &amp; Relief", section_style))
    relief_data = [
        ["Item", "Value"],
        ["Interest Exemption", _fmt(breakdown.exemptions.interest_exempt_amount)],
        ["Tax-Free Allowance", _fmt(breakdown.tax_free_allowance)],
    ]
    relief_table = Table(relief_data, colWidths=[250, 200])
    relief_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#fafafa")),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 10),
        ("ALIGN", (1, 0), (1, -1), "RIGHT"),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#e8e8e8")),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ]))
    elements.append(relief_table)

    # --- Slab Breakdown ---
    elements.append(Paragraph("Tax Slab Breakdown (Domestic)", section_style))
    slab_data = [["Slab", "Taxable Amount", "Rate", "Tax"]]
    for slab in breakdown.domestic_tax.slab_breakdown:
        slab_data.append([
            slab.label,
            _fmt(slab.taxable_in_slab),
            f"{float(slab.rate) * 100:.0f}%",
            _fmt(slab.tax),
        ])
    slab_data.append(["Total Domestic Tax", "", "", _fmt(breakdown.domestic_tax.tax)])
    slab_table = Table(slab_data, colWidths=[160, 120, 60, 120])
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

    # Foreign slabs (if any)
    if breakdown.foreign_tax.slab_breakdown:
        elements.append(Spacer(1, 4))
        elements.append(Paragraph("Tax Slab Breakdown (Foreign)", section_style))
        fslab_data = [["Slab", "Taxable Amount", "Rate", "Tax"]]
        for slab in breakdown.foreign_tax.slab_breakdown:
            fslab_data.append([
                slab.label,
                _fmt(slab.taxable_in_slab),
                f"{float(slab.rate) * 100:.0f}%",
                _fmt(slab.tax),
            ])
        fslab_data.append(["Total Foreign Tax", "", "", _fmt(breakdown.foreign_tax.tax)])
        fslab_table = Table(fslab_data, colWidths=[160, 120, 60, 120])
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

    # --- Credits ---
    elements.append(Paragraph("Credits &amp; Deductions", section_style))
    credit_data = [["Item", "Amount (LKR)"]]
    credit_data.append(["WHT on Interest", _fmt(breakdown.credits.wht_on_interest)])
    credit_data.append(["PAYE Deducted", _fmt(breakdown.credits.paye_deducted)])
    if breakdown.credits.self_assessment_paid:
        credit_data.append(["Self-Assessment Paid", _fmt(breakdown.credits.self_assessment_paid)])
    for adj in breakdown.credits.adjustments:
        credit_data.append([adj.label, _fmt(adj.amount)])
    credit_data.append(["Total Credits", _fmt(breakdown.credits.total_credits)])
    credit_table = Table(credit_data, colWidths=[300, 150])
    credit_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#fafafa")),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 10),
        ("ALIGN", (1, 0), (1, -1), "RIGHT"),
        ("BACKGROUND", (0, -1), (-1, -1), colors.HexColor("#e6f4ff")),
        ("FONTNAME", (0, -1), (-1, -1), "Helvetica-Bold"),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#e8e8e8")),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ]))
    elements.append(credit_table)

    # --- Final Summary ---
    elements.append(Spacer(1, 10))
    elements.append(HRFlowable(width="100%", thickness=2, color=colors.HexColor("#1a7a3a")))
    elements.append(Spacer(1, 6))
    final_data = [
        ["Gross Tax", _fmt(breakdown.gross_tax)],
        ["Total Credits", f"− {_fmt(breakdown.credits.total_credits)}"],
        ["Net Tax Payable", _fmt(breakdown.net_tax_payable)],
    ]
    final_table = Table(final_data, colWidths=[300, 150])
    net_color = colors.HexColor("#cf1322") if float(breakdown.net_tax_payable) > 0 else colors.HexColor("#1a7a3a")
    final_table.setStyle(TableStyle([
        ("FONTSIZE", (0, 0), (-1, -1), 11),
        ("ALIGN", (1, 0), (1, -1), "RIGHT"),
        ("FONTNAME", (0, -1), (-1, -1), "Helvetica-Bold"),
        ("FONTSIZE", (0, -1), (-1, -1), 14),
        ("TEXTCOLOR", (1, -1), (1, -1), net_color),
        ("BACKGROUND", (0, -1), (-1, -1), colors.HexColor("#f0f0f0")),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("LINEBELOW", (0, -2), (-1, -2), 0.5, colors.HexColor("#d9d9d9")),
    ]))
    elements.append(final_table)

    doc.build(elements)
    buffer.seek(0)
    return buffer
