from pydantic import BaseModel


class GrossIncome(BaseModel):
    salary: float
    interest: float
    foreign_employment: float
    other: float
    total: float


class ExemptionDetail(BaseModel):
    interest_exempt_amount: float
    exempt_entry_ids: list[str]


class SlabDetail(BaseModel):
    label: str
    taxable_in_slab: float
    tax: float
    rate: float


class ForeignTaxDetail(BaseModel):
    foreign_income: float
    relief_applied: float
    taxable_income: float
    slab_breakdown: list[SlabDetail]
    tax: float


class DomesticTaxDetail(BaseModel):
    domestic_income: float
    relief_applied: float
    taxable_income: float
    slab_breakdown: list[SlabDetail]
    tax: float


class AdjustmentDetail(BaseModel):
    label: str
    adjustment_type: str
    amount: float


class Credits(BaseModel):
    wht_on_interest: float
    paye_deducted: float
    self_assessment_paid: float
    adjustments: list[AdjustmentDetail]
    total_credits: float


class WhtWarning(BaseModel):
    entry_id: str
    source_name: str | None
    account_number: str | None
    amount_lkr: float
    wht_deducted: float
    expected_wht: float
    expected_rate_pct: float
    message: str


class TaxBreakdown(BaseModel):
    gross_income: GrossIncome
    exemptions: ExemptionDetail
    relief_applied_to: str  # 'local' or 'foreign'
    tax_free_allowance: float
    domestic_tax: DomesticTaxDetail
    foreign_tax: ForeignTaxDetail
    gross_tax: float
    credits: Credits
    net_tax_payable: float
    effective_rate_pct: float
    wht_warnings: list[WhtWarning] = []


class OptimizationResult(BaseModel):
    recommended_exempt_entry_ids: list[str]
    recommended_relief_on: str  # 'local' or 'foreign'
    partial_exemption_entry_id: str | None
    partial_exempt_amount: float | None
    baseline: TaxBreakdown
    optimized: TaxBreakdown
    tax_savings: float
