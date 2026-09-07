export interface IncomeEntry {
  id: string;
  filing_id: string;
  category: 'salary' | 'interest' | 'foreign_employment' | 'other';
  source_name: string | null;
  account_number: string | null;
  amount_lkr: number;
  amount_foreign: number | null;
  foreign_currency: string | null;
  exchange_rate: number | null;
  received_date: string | null;
  wht_deducted: number;
  paye_deducted: number;
  is_active: boolean;
  description: string | null;
  created_at: string;
}

export interface IncomeCreate {
  category: 'salary' | 'interest' | 'foreign_employment' | 'other';
  source_name: string | null;
  account_number: string | null;
  amount_lkr: number;
  amount_foreign: number | null;
  foreign_currency: string | null;
  exchange_rate: number | null;
  received_date: string | null;
  wht_deducted: number;
  paye_deducted: number;
  description: string | null;
}

export interface IncomeSummary {
  salary_total: number;
  interest_total: number;
  foreign_total: number;
  other_total: number;
  grand_total: number;
  total_wht: number;
  total_paye: number;
}

export interface TaxSlab {
  slab_order: number;
  lower_bound: number;
  upper_bound: number | null;
  rate: number;
  label: string;
  slab_type: string;
}

export interface TaxConfig {
  fiscal_year: string;
  tax_free_threshold: number;
  interest_exemption_limit: number;
  wht_rate_resident: number;
  has_foreign_tax: boolean;
  local_slabs: TaxSlab[];
  foreign_slabs: TaxSlab[];
}

export interface GrossIncome {
  salary: number;
  interest: number;
  foreign_employment: number;
  other: number;
  total: number;
}

export interface ExemptionDetail {
  interest_exempt_amount: number;
  exempt_entry_ids: string[];
}

export interface SlabDetail {
  label: string;
  taxable_in_slab: number;
  tax: number;
  rate: number;
}

export interface DomesticTaxDetail {
  domestic_income: number;
  relief_applied: number;
  taxable_income: number;
  slab_breakdown: SlabDetail[];
  tax: number;
}

export interface ForeignTaxDetail {
  foreign_income: number;
  relief_applied: number;
  taxable_income: number;
  slab_breakdown: SlabDetail[];
  tax: number;
}

export interface AdjustmentDetail {
  label: string;
  adjustment_type: string;
  amount: number;
}

export interface Credits {
  wht_on_interest: number;
  paye_deducted: number;
  self_assessment_paid: number;
  adjustments: AdjustmentDetail[];
  total_credits: number;
}

export interface WhtWarning {
  entry_id: string;
  source_name: string | null;
  account_number: string | null;
  amount_lkr: number;
  wht_deducted: number;
  expected_wht: number;
  expected_rate_pct: number;
  message: string;
}

export interface TaxBreakdown {
  gross_income: GrossIncome;
  exemptions: ExemptionDetail;
  relief_applied_to: string;
  tax_free_allowance: number;
  domestic_tax: DomesticTaxDetail;
  foreign_tax: ForeignTaxDetail;
  gross_tax: number;
  credits: Credits;
  net_tax_payable: number;
  effective_rate_pct: number;
  wht_warnings: WhtWarning[];
}

export interface OptimizationResult {
  recommended_exempt_entry_ids: string[];
  recommended_relief_on: string;
  partial_exemption_entry_id: string | null;
  partial_exempt_amount: number | null;
  baseline: TaxBreakdown;
  optimized: TaxBreakdown;
  tax_savings: number;
}

export interface Payment {
  id: string;
  filing_id: string;
  quarter: string;
  amount: number;
  paid_date: string | null;
}

export interface PaymentCreate {
  quarter: string;
  amount: number;
  paid_date: string | null;
}

export interface TaxAdjustment {
  id: string;
  filing_id: string;
  label: string;
  adjustment_type: string;
  quarter: string | null;
  amount: number;
  description: string | null;
  is_active: boolean;
  created_at: string;
}

export interface AdjustmentCreate {
  label: string;
  adjustment_type: string;
  quarter: string | null;
  amount: number;
  description: string | null;
}

// User type (from /api/users)
export interface AuthUser {
  id: string;
  name: string;
  email: string | null;
  fiscal_year: string;
}

export interface UserCreate {
  name: string;
  email?: string | null;
  fiscal_year?: string;
}

export interface UserUpdate {
  name?: string;
  email?: string | null;
  fiscal_year?: string;
}

// Fiscal Year type (from /api/fiscal-years)
export interface FiscalYearEntry {
  id: string;
  year_code: string;
  start_date: string;
  end_date: string;
  is_active: boolean;
  is_default: boolean;
}

export interface FiscalYearCreate {
  year_code: string;
  start_date: string;
  end_date: string;
  is_active?: boolean;
  is_default?: boolean;
}

export interface FiscalYearUpdate {
  year_code?: string;
  start_date?: string;
  end_date?: string;
  is_active?: boolean;
  is_default?: boolean;
}

// Tax Filing (user + fiscal year pair)
export interface TaxFiling {
  id: string;
  user_id: string;
  user_name: string;
  fiscal_year: string;
  status: string;
  gross_income: number | null;
  gross_tax: number | null;
  total_credits: number | null;
  wht_credits: number | null;             // WHT + PAYE (deducted at source)
  self_assessment_paid: number | null;     // quarterly self-assessment payments
  net_tax_payable: number | null;
  effective_rate_pct: number | null;
}

export interface FilingCreate {
  user_id: string;
  fiscal_year: string;
}

// Per-user dashboard types
export interface FilingSnapshot {
  filing_id: string;
  fiscal_year: string;
  status: string;
  gross_income: number;
  net_tax_payable: number;
  effective_rate_pct: number;
  total_credits: number;
  gross_tax: number;
  salary: number;
  interest: number;
  foreign_employment: number;
  other: number;
}

export interface UserDashboard {
  user_id: string;
  user_name: string;
  filings: FilingSnapshot[];
  total_tax_paid: number;
  total_income_earned: number;
  avg_effective_rate: number;
}
