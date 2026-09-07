"""Data export endpoints — CSV downloads for income, tax breakdown, and full filing."""
import csv
import io
import uuid

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.adjustment import TaxAdjustment
from app.models.filing import TaxFiling
from app.models.income import IncomeEntry
from app.services.tax_calculator import calculate_tax
from app.services.tax_optimizer import optimize_exemptions

router = APIRouter(prefix="/api/filings/{filing_id}/export", tags=["export"])


def _csv_response(buffer: io.StringIO, filename: str) -> StreamingResponse:
    buffer.seek(0)
    return StreamingResponse(
        iter([buffer.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


async def _get_filing_or_404(filing_id: str, db: AsyncSession) -> TaxFiling:
    stmt = (
        select(TaxFiling)
        .options(selectinload(TaxFiling.user))
        .where(TaxFiling.id == uuid.UUID(filing_id))
    )
    result = await db.execute(stmt)
    filing = result.scalar_one_or_none()
    if filing is None:
        raise HTTPException(status_code=404, detail="Filing not found")
    return filing


@router.get("/income-csv")
async def export_income_csv(
    filing_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Export all income entries for a filing as CSV."""
    filing = await _get_filing_or_404(filing_id, db)
    entries_stmt = (
        select(IncomeEntry)
        .where(IncomeEntry.filing_id == uuid.UUID(filing_id))
        .order_by(IncomeEntry.category, IncomeEntry.created_at)
    )
    result = await db.execute(entries_stmt)
    entries = list(result.scalars().all())

    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow([
        "Category", "Source Name", "Account Number", "Amount (LKR)",
        "Amount (Foreign)", "Currency", "Exchange Rate",
        "Received Date", "WHT Deducted", "PAYE Deducted", "Description",
    ])
    for e in entries:
        writer.writerow([
            e.category, e.source_name or "", e.account_number or "",
            float(e.amount_lkr), float(e.amount_foreign) if e.amount_foreign else "",
            e.foreign_currency or "", float(e.exchange_rate) if e.exchange_rate else "",
            str(e.received_date) if e.received_date else "",
            float(e.wht_deducted), float(e.paye_deducted),
            e.description or "",
        ])

    user_name = filing.user.name if filing.user else "unknown"
    filename = f"income_{user_name}_{filing.fiscal_year.replace('/', '-')}.csv"
    return _csv_response(buf, filename)


@router.get("/tax-summary-csv")
async def export_tax_summary_csv(
    filing_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Export the optimized tax breakdown as CSV."""
    filing = await _get_filing_or_404(filing_id, db)

    try:
        opt = await optimize_exemptions(db, filing_id)
        breakdown = opt.optimized
    except Exception:
        breakdown = await calculate_tax(db, filing_id, exempt_entry_ids=[], relief_on="local")

    buf = io.StringIO()
    writer = csv.writer(buf)

    writer.writerow(["Sri Lanka Income Tax Summary"])
    writer.writerow([f"Fiscal Year: {filing.fiscal_year}"])
    user_name = filing.user.name if filing.user else "unknown"
    writer.writerow([f"Taxpayer: {user_name}"])
    writer.writerow([])

    # Gross Income
    writer.writerow(["--- GROSS INCOME ---"])
    writer.writerow(["Salary", float(breakdown.gross_income.salary)])
    writer.writerow(["Interest", float(breakdown.gross_income.interest)])
    writer.writerow(["Foreign Currency Income", float(breakdown.gross_income.foreign_employment)])
    writer.writerow(["Other", float(breakdown.gross_income.other)])
    writer.writerow(["Total Gross Income", float(breakdown.gross_income.total)])
    writer.writerow([])

    # Exemptions
    writer.writerow(["--- EXEMPTIONS & RELIEF ---"])
    writer.writerow(["Interest Exemption", float(breakdown.exemptions.interest_exempt_amount)])
    writer.writerow(["Tax-Free Allowance", float(breakdown.tax_free_allowance)])
    writer.writerow(["Relief Applied To", breakdown.relief_applied_to])
    writer.writerow([])

    # Slab breakdown
    writer.writerow(["--- TAX SLAB BREAKDOWN ---"])
    writer.writerow(["Slab", "Taxable Amount", "Rate", "Tax"])
    for slab in breakdown.domestic_tax.slab_breakdown:
        writer.writerow([slab.label, float(slab.taxable_in_slab), f"{slab.rate*100:.0f}%", float(slab.tax)])
    if breakdown.foreign_tax.slab_breakdown:
        writer.writerow([])
        writer.writerow(["--- FOREIGN TAX ---"])
        for slab in breakdown.foreign_tax.slab_breakdown:
            writer.writerow([slab.label, float(slab.taxable_in_slab), f"{slab.rate*100:.0f}%", float(slab.tax)])
    writer.writerow([])

    # Tax Summary
    writer.writerow(["--- TAX SUMMARY ---"])
    writer.writerow(["Domestic Tax", float(breakdown.domestic_tax.tax)])
    writer.writerow(["Foreign Tax", float(breakdown.foreign_tax.tax)])
    writer.writerow(["Gross Tax", float(breakdown.gross_tax)])
    writer.writerow([])

    # Credits
    writer.writerow(["--- CREDITS ---"])
    writer.writerow(["WHT on Interest", float(breakdown.credits.wht_on_interest)])
    writer.writerow(["PAYE Deducted", float(breakdown.credits.paye_deducted)])
    for adj in breakdown.credits.adjustments:
        prefix = "-" if adj.adjustment_type == "other_deduction" else ""
        writer.writerow([adj.label, f"{prefix}{float(adj.amount)}"])
    writer.writerow(["Total Credits", float(breakdown.credits.total_credits)])
    writer.writerow([])

    # Final
    writer.writerow(["--- FINAL ---"])
    writer.writerow(["Net Tax Payable", float(breakdown.net_tax_payable)])
    writer.writerow(["Effective Rate", f"{breakdown.effective_rate_pct:.2f}%"])

    filename = f"tax_summary_{user_name}_{filing.fiscal_year.replace('/', '-')}.csv"
    return _csv_response(buf, filename)


@router.get("/tax-summary-pdf")
async def export_tax_summary_pdf(
    filing_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Export a visual PDF tax summary."""
    from app.services.pdf_generator import generate_tax_summary_pdf

    filing = await _get_filing_or_404(filing_id, db)
    user_name = filing.user.name if filing.user else "Unknown"

    try:
        opt = await optimize_exemptions(db, filing_id)
        breakdown = opt.optimized
        savings = float(opt.tax_savings)
        recommended = opt.recommended_relief_on
    except Exception:
        breakdown = await calculate_tax(db, filing_id, exempt_entry_ids=[], relief_on="local")
        savings = 0.0
        recommended = "local"

    pdf_buffer = generate_tax_summary_pdf(
        breakdown=breakdown,
        fiscal_year=filing.fiscal_year,
        taxpayer_name=user_name,
        savings=savings,
        recommended_relief=recommended,
    )

    filename = f"tax_summary_{user_name}_{filing.fiscal_year.replace('/', '-')}.pdf"
    return StreamingResponse(
        pdf_buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/filing-visual-pdf")
async def export_filing_visual_pdf(
    filing_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Export a visual filing summary PDF with charts."""
    from app.services.filing_visual_pdf import generate_filing_visual_pdf

    filing = await _get_filing_or_404(filing_id, db)
    user_name = filing.user.name if filing.user else "Unknown"

    try:
        opt = await optimize_exemptions(db, filing_id)
        breakdown = opt.optimized
    except Exception:
        breakdown = await calculate_tax(db, filing_id, exempt_entry_ids=[], relief_on="local")

    pdf_buffer = generate_filing_visual_pdf(
        breakdown=breakdown,
        fiscal_year=filing.fiscal_year,
        taxpayer_name=user_name,
        filing_status=filing.status,
    )

    filename = f"filing_visual_{user_name}_{filing.fiscal_year.replace('/', '-')}.pdf"
    return StreamingResponse(
        pdf_buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/tax-summary-xlsx")
async def export_tax_summary_xlsx(
    filing_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Export a RAMIS-ready Excel (.xlsx) tax summary."""
    from app.services.excel_generator import generate_tax_summary_xlsx

    filing = await _get_filing_or_404(filing_id, db)
    user_name = filing.user.name if filing.user else "Unknown"

    try:
        opt = await optimize_exemptions(db, filing_id)
        breakdown = opt.optimized
        savings = float(opt.tax_savings)
        recommended = opt.recommended_relief_on
    except Exception:
        breakdown = await calculate_tax(db, filing_id, exempt_entry_ids=[], relief_on="local")
        savings = 0.0
        recommended = "local"

    xlsx_buffer = generate_tax_summary_xlsx(
        breakdown=breakdown,
        fiscal_year=filing.fiscal_year,
        taxpayer_name=user_name,
        savings=savings,
        recommended_relief=recommended,
    )

    filename = f"tax_summary_{user_name}_{filing.fiscal_year.replace('/', '-')}.xlsx"
    return StreamingResponse(
        xlsx_buffer,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
