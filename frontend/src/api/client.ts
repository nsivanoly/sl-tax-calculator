import axios from 'axios';
import type {
  IncomeEntry,
  IncomeCreate,
  IncomeSummary,
  TaxConfig,
  TaxSlab,
  TaxBreakdown,
  OptimizationResult,
  Payment,
  PaymentCreate,
  TaxAdjustment,
  AdjustmentCreate,
  AuthUser,
  UserCreate,
  UserUpdate,
  FiscalYearEntry,
  FiscalYearCreate,
  FiscalYearUpdate,
  TaxFiling,
  FilingCreate,
  UserDashboard,
} from '../types';

const apiClient = axios.create({
  baseURL: '/api',
});

export default apiClient;

// ---- Users CRUD ----

export async function getUsers(): Promise<AuthUser[]> {
  const response = await apiClient.get<AuthUser[]>('/users/');
  return response.data;
}

export async function createUser(data: UserCreate): Promise<AuthUser> {
  const response = await apiClient.post<AuthUser>('/users/', data);
  return response.data;
}

export async function updateUser(id: string, data: UserUpdate): Promise<AuthUser> {
  const response = await apiClient.put<AuthUser>(`/users/${id}`, data);
  return response.data;
}

export async function deleteUser(id: string): Promise<void> {
  await apiClient.delete(`/users/${id}`);
}

// ---- Fiscal Years CRUD ----

export async function getFiscalYears(): Promise<FiscalYearEntry[]> {
  const response = await apiClient.get<FiscalYearEntry[]>('/fiscal-years/');
  return response.data;
}

export async function createFiscalYear(data: FiscalYearCreate): Promise<FiscalYearEntry> {
  const response = await apiClient.post<FiscalYearEntry>('/fiscal-years/', data);
  return response.data;
}

export async function updateFiscalYear(id: string, data: FiscalYearUpdate): Promise<FiscalYearEntry> {
  const response = await apiClient.put<FiscalYearEntry>(`/fiscal-years/${id}`, data);
  return response.data;
}

export async function deleteFiscalYear(id: string): Promise<void> {
  await apiClient.delete(`/fiscal-years/${id}`);
}

// ---- Tax Filings CRUD ----

export async function getFilings(): Promise<TaxFiling[]> {
  const response = await apiClient.get<TaxFiling[]>('/filings/');
  return response.data;
}

export async function createFiling(data: FilingCreate): Promise<TaxFiling> {
  const response = await apiClient.post<TaxFiling>('/filings/', data);
  return response.data;
}

export async function getFiling(filingId: string): Promise<TaxFiling> {
  const response = await apiClient.get<TaxFiling>(`/filings/${filingId}`);
  return response.data;
}

export async function updateFiling(filingId: string, data: { status?: string }): Promise<TaxFiling> {
  const response = await apiClient.put<TaxFiling>(`/filings/${filingId}`, data);
  return response.data;
}

export async function deleteFiling(filingId: string): Promise<void> {
  await apiClient.delete(`/filings/${filingId}`);
}

// ---- Income (scoped to filing) ----

export async function getIncome(
  filingId: string,
  category?: string
): Promise<IncomeEntry[]> {
  const params: Record<string, string> = {};
  if (category) params.category = category;
  const response = await apiClient.get<IncomeEntry[]>(`/filings/${filingId}/income/`, { params });
  return response.data;
}

export async function createIncome(
  filingId: string,
  data: IncomeCreate
): Promise<IncomeEntry> {
  const response = await apiClient.post<IncomeEntry>(`/filings/${filingId}/income/`, data);
  return response.data;
}

export async function updateIncome(
  filingId: string,
  id: string,
  data: Partial<IncomeCreate>
): Promise<IncomeEntry> {
  const response = await apiClient.put<IncomeEntry>(`/filings/${filingId}/income/${id}`, data);
  return response.data;
}

export async function deleteIncome(filingId: string, id: string): Promise<void> {
  await apiClient.delete(`/filings/${filingId}/income/${id}`);
}

export async function toggleIncome(filingId: string, incomeId: string): Promise<IncomeEntry> {
  const response = await apiClient.patch<IncomeEntry>(`/filings/${filingId}/income/${incomeId}/toggle`);
  return response.data;
}

export async function bulkToggleIncome(
  filingId: string,
  ids: string[],
  active: boolean
): Promise<{ updated: number }> {
  const response = await apiClient.post<{ updated: number }>(
    `/filings/${filingId}/income/bulk-toggle`,
    { ids, active }
  );
  return response.data;
}

export async function bulkDeleteIncome(
  filingId: string,
  ids: string[]
): Promise<{ deleted: number }> {
  const response = await apiClient.post<{ deleted: number }>(
    `/filings/${filingId}/income/bulk-delete`,
    { ids }
  );
  return response.data;
}

export async function uploadCsv(
  filingId: string,
  file: File
): Promise<{ created: number; errors: any[] }> {
  const formData = new FormData();
  formData.append('file', file);
  const response = await apiClient.post<{ created: number; errors: any[] }>(
    `/filings/${filingId}/income/bulk-csv`,
    formData,
    {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    }
  );
  return response.data;
}

export async function getIncomeSummary(filingId: string): Promise<IncomeSummary> {
  const response = await apiClient.get<IncomeSummary>(`/filings/${filingId}/income/summary`);
  return response.data;
}

// ---- Payments (scoped to filing) ----

export async function getPayments(filingId: string): Promise<Payment[]> {
  const response = await apiClient.get<Payment[]>(`/filings/${filingId}/payments/`);
  return response.data;
}

export async function createPayment(
  filingId: string,
  data: PaymentCreate
): Promise<Payment> {
  const response = await apiClient.post<Payment>(`/filings/${filingId}/payments/`, data);
  return response.data;
}

// ---- Tax Config ----

export async function getTaxConfig(fiscalYear?: string): Promise<TaxConfig> {
  const response = await apiClient.get<TaxConfig>('/tax-config/', {
    params: fiscalYear ? { fiscal_year: fiscalYear } : undefined,
  });
  return response.data;
}

export async function updateTaxConfig(
  data: Partial<TaxConfig>
): Promise<TaxConfig> {
  const response = await apiClient.put<TaxConfig>('/tax-config/', data);
  return response.data;
}

export async function copyTaxConfig(
  targetFiscalYear: string,
  sourceFiscalYear: string
): Promise<TaxConfig> {
  const response = await apiClient.post<TaxConfig>(
    '/tax-config/copy-from',
    { source_fiscal_year: sourceFiscalYear },
    { params: { fiscal_year: targetFiscalYear } }
  );
  return response.data;
}

export async function updateSlabs(
  localSlabs: TaxSlab[],
  foreignSlabs: TaxSlab[],
  fiscalYear?: string
): Promise<{ local_slabs: TaxSlab[]; foreign_slabs: TaxSlab[] }> {
  const response = await apiClient.put<{ local_slabs: TaxSlab[]; foreign_slabs: TaxSlab[] }>(
    '/tax-config/slabs',
    { local_slabs: localSlabs, foreign_slabs: foreignSlabs },
    { params: fiscalYear ? { fiscal_year: fiscalYear } : undefined }
  );
  return response.data;
}

// ---- Tax Calculation (scoped to filing) ----

export async function calculateTax(
  filingId: string,
  exemptIds?: string[],
  reliefOn?: string
): Promise<TaxBreakdown> {
  const response = await apiClient.post<TaxBreakdown>(`/filings/${filingId}/calculate/`, {
    exempt_entry_ids: exemptIds,
    relief_on: reliefOn || 'local',
  });
  return response.data;
}

export async function optimizeTax(filingId: string): Promise<OptimizationResult> {
  const response = await apiClient.post<OptimizationResult>(
    `/filings/${filingId}/calculate/optimize`
  );
  return response.data;
}

export async function compareTax(
  filingId: string
): Promise<{
  local: TaxBreakdown;
  foreign: TaxBreakdown;
}> {
  const response = await apiClient.post<{
    local: TaxBreakdown;
    foreign: TaxBreakdown;
  }>(`/filings/${filingId}/calculate/compare`);
  return response.data;
}

// ---- Adjustments (scoped to filing) ----

export async function getAdjustments(filingId: string): Promise<TaxAdjustment[]> {
  const response = await apiClient.get<TaxAdjustment[]>(`/filings/${filingId}/adjustments/`);
  return response.data;
}

export async function createAdjustment(
  filingId: string,
  data: AdjustmentCreate
): Promise<TaxAdjustment> {
  const response = await apiClient.post<TaxAdjustment>(`/filings/${filingId}/adjustments/`, data);
  return response.data;
}

export async function updateAdjustment(
  filingId: string,
  id: string,
  data: Partial<AdjustmentCreate>
): Promise<TaxAdjustment> {
  const response = await apiClient.put<TaxAdjustment>(`/filings/${filingId}/adjustments/${id}`, data);
  return response.data;
}

export async function deleteAdjustment(filingId: string, id: string): Promise<void> {
  await apiClient.delete(`/filings/${filingId}/adjustments/${id}`);
}

export async function toggleAdjustment(filingId: string, adjustmentId: string): Promise<TaxAdjustment> {
  const response = await apiClient.patch<TaxAdjustment>(`/filings/${filingId}/adjustments/${adjustmentId}/toggle`);
  return response.data;
}

// ---- User Dashboard ----

export async function getUserDashboard(userId: string): Promise<UserDashboard> {
  const response = await apiClient.get<UserDashboard>(`/users/${userId}/dashboard/`);
  return response.data;
}

export async function exportTaxHistoryPdf(userId: string): Promise<void> {
  const response = await apiClient.get(`/users/${userId}/dashboard/export-history-pdf`, {
    responseType: 'blob',
  });
  const url = window.URL.createObjectURL(new Blob([response.data]));
  const link = document.createElement('a');
  link.href = url;
  const disposition = response.headers['content-disposition'] || '';
  const match = disposition.match(/filename="(.+?)"/);
  link.setAttribute('download', match ? match[1] : 'tax_history.pdf');
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

// ---- Export ----

export async function exportIncomeCsv(filingId: string): Promise<void> {
  const response = await apiClient.get(`/filings/${filingId}/export/income-csv`, {
    responseType: 'blob',
  });
  const url = window.URL.createObjectURL(new Blob([response.data]));
  const link = document.createElement('a');
  link.href = url;
  const disposition = response.headers['content-disposition'] || '';
  const match = disposition.match(/filename="(.+?)"/);
  link.setAttribute('download', match ? match[1] : 'income_export.csv');
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

export async function exportFilingVisualPdf(filingId: string): Promise<void> {
  const response = await apiClient.get(`/filings/${filingId}/export/filing-visual-pdf`, {
    responseType: 'blob',
  });
  const url = window.URL.createObjectURL(new Blob([response.data]));
  const link = document.createElement('a');
  link.href = url;
  const disposition = response.headers['content-disposition'] || '';
  const match = disposition.match(/filename="(.+?)"/);
  link.setAttribute('download', match ? match[1] : 'filing_visual.pdf');
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

export async function exportTaxSummaryPdf(filingId: string): Promise<void> {
  const response = await apiClient.get(`/filings/${filingId}/export/tax-summary-pdf`, {
    responseType: 'blob',
  });
  const url = window.URL.createObjectURL(new Blob([response.data]));
  const link = document.createElement('a');
  link.href = url;
  const disposition = response.headers['content-disposition'] || '';
  const match = disposition.match(/filename="(.+?)"/);
  link.setAttribute('download', match ? match[1] : 'tax_summary.pdf');
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

export async function exportTaxSummaryXlsx(filingId: string): Promise<void> {
  const response = await apiClient.get(`/filings/${filingId}/export/tax-summary-xlsx`, {
    responseType: 'blob',
  });
  const url = window.URL.createObjectURL(new Blob([response.data]));
  const link = document.createElement('a');
  link.href = url;
  const disposition = response.headers['content-disposition'] || '';
  const match = disposition.match(/filename="(.+?)"/);
  link.setAttribute('download', match ? match[1] : 'tax_summary.xlsx');
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

export async function exportTaxSummaryCsv(filingId: string): Promise<void> {
  const response = await apiClient.get(`/filings/${filingId}/export/tax-summary-csv`, {
    responseType: 'blob',
  });
  const url = window.URL.createObjectURL(new Blob([response.data]));
  const link = document.createElement('a');
  link.href = url;
  const disposition = response.headers['content-disposition'] || '';
  const match = disposition.match(/filename="(.+?)"/);
  link.setAttribute('download', match ? match[1] : 'tax_summary.csv');
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}
