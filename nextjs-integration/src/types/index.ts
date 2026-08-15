// =============================================================================
// Global Utility Types
// =============================================================================

export type QueryParams = Record<string, any>;

export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface ApiError {
  detail?: string;
  non_field_errors?: string[];
  [key: string]: any;
}

export interface TokenResponse {
  access: string;
  refresh: string;
}

export interface LoginForm {
  username: string;
  password: string;
}

export interface UserProfile {
  user: GlobalUser;
  permissions: string[];
}

// =============================================================================
// Shared Types (Public Schema)
// =============================================================================

export type UserRole =
  | 'SUPER_ADMIN'
  | 'AOM_STAFF'
  | 'DONOR_STAFF'
  | 'MFI_ADMIN'
  | 'MFI_MANAGER'
  | 'LOAN_OFFICER';

export interface Donor {
  id: number;
  name: string;
  contact_email: string;
  contact_phone: string;
  address: string;
  base_currency: string;
  created_at: string;
  updated_at: string;
}

export interface AoM {
  id: number;
  name: string;
  code: string;
  donor: number | null;
  donor_name?: string;
  contact_email: string;
  contact_phone: string;
  address: string;
  created_at: string;
  updated_at: string;
  mfi_count?: number;
}

export interface GlobalUser {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  role: UserRole;

  aom: number | null;
  aom_name?: string;

  donor: number | null;
  donor_name?: string;

  mfi: number | null;
  mfi_name?: string;
  mfi_code?: string;
  mfi_schema?: string;

  branch?: number | null;

  tenant_subdomain?: string;

  is_staff: boolean;
  is_active: boolean;
  date_joined: string;
  last_login: string | null;
}

export interface MFI {
  id: number;
  name: string;
  code: string;
  schema_name: string;
  registration_number: string;
  license_number: string;
  email: string;
  phone: string;
  address: string;
  local_currency: string;

  aom: number | null;
  aom_name?: string;

  donor: number | null;
  donor_name?: string;

  is_active: boolean;
  is_onboarded: boolean;

  created_at: string;
  updated_at: string;

  domains?: Domain[];
  reports?: MFIReport[];
}

export type MFIForm = Omit<
  MFI,
  | 'id'
  | 'schema_name'
  | 'created_at'
  | 'updated_at'
  | 'domains'
  | 'reports'
  | 'aom_name'
  | 'donor_name'
>;

export interface Domain {
  id: number;
  domain: string;
  tenant: number;
  tenant_name?: string;
  is_primary: boolean;
  created_at: string;
  updated_at: string;
}

export interface ExchangeRate {
  id: number;
  from_currency: string;
  to_currency: string;
  rate: string;
  date: string;
  source: string;
  created_at: string;
  updated_at: string;
}

export type ExchangeRateForm = Omit<
  ExchangeRate,
  'id' | 'created_at' | 'updated_at'
>;

// =============================================================================
// Report Types (Public Schema)
// =============================================================================

export type ReportStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'APPROVED'
  | 'REJECTED'
  | 'GENERATED';

// =============================================================================
// Fund flow: Donor -> AoM -> MFI
// =============================================================================

export interface DonorContribution {
  id: number;
  donor: number;
  donor_name?: string;
  aom: number;
  aom_name?: string;
  amount: string;
  currency: string;
  contribution_date: string;
  reference?: string;
  notes?: string;
  recorded_by: number | null;
  recorded_by_name?: string;
  created_at?: string;
  updated_at?: string;
}

export type DisbursementStatus = 'PND' | 'ACT' | 'RPD' | 'DEF' | 'CAN';

export interface MFIDisbursement {
  id: number;
  aom: number;
  aom_name?: string;
  mfi: number;
  mfi_name?: string;
  principal_amount: string;
  currency: string;
  interest_rate: string;
  term_months: number;
  disbursement_date: string;
  status: DisbursementStatus;
  repaid_amount: string;
  outstanding_amount: string;
  notes?: string;
  created_by: number | null;
  created_by_name?: string;
  created_at?: string;
  updated_at?: string;
  schedule?: MFIDisbursementRepayment[];
}

export interface MFIDisbursementRepayment {
  id: number;
  disbursement: number;
  installment_number: number;
  due_date: string;
  expected_principal: string;
  expected_interest: string;
  expected_total: string;
  actual_paid: string;
  is_paid: boolean;
  days_overdue: number;
  paid_date: string | null;
  remaining_amount?: string;
  is_overdue?: boolean;
}

export interface MFIReport {
  id: number;
  mfi: number;
  mfi_name?: string;
  period: string;
  status: ReportStatus;
  payload: MFIReportPayload;

  local_currency: string;
  base_currency: string;
  exchange_rate: string;

  generated_by: number | null;
  generated_by_name?: string;
  generated_at: string;

  submitted_at: string | null;

  approved_by: number | null;
  approved_by_name?: string;
  approved_at: string | null;

  created_at?: string;
  updated_at?: string;
}

export interface AoMReport {
  id: number;
  aom: number;
  aom_name?: string;
  period: string;
  status: ReportStatus;
  payload: AoMReportPayload;

  base_currency: string;

  generated_by: number | null;
  generated_by_name?: string;
  generated_at: string;

  approved_by: number | null;
  approved_by_name?: string;
  approved_at: string | null;

  created_at?: string;
  updated_at?: string;
}

export interface DonorReport {
  id: number;
  donor: number;
  donor_name?: string;
  period: string;
  status: ReportStatus;
  payload: DonorReportPayload;

  base_currency: string;

  generated_by: number | null;
  generated_by_name?: string;
  generated_at: string;

  approved_by: number | null;
  approved_by_name?: string;
  approved_at: string | null;

  created_at?: string;
  updated_at?: string;
}

// =============================================================================
// Report Payload Types
// =============================================================================

export interface MFIReportPayload {
  portfolio: PortfolioSummary;
  status_breakdown: StatusBreakdown[];
  product_breakdown: ProductBreakdown[];
  gender_distribution: GenderDistribution[];
  borrower_type_distribution: BorrowerTypeDistribution[];
  wss_loans: WSSLoans;
  geographic_breakdown: GeographicBreakdown[];
  par_30: PAR30;
  generated_at: string;
}

export interface AoMReportPayload {
  total_mfis: number;
  mfis: MFIReportSummary[];
  aggregated: AggregatedMetrics;
}

export interface DonorReportPayload {
  total_aoms: number;
  total_mfis: number;
  aoms: AoMReportSummary[];
  aggregated: AggregatedMetrics;
}

export interface MFIReportSummary {
  mfi_name: string;
  mfi_code: string;
  schema_name: string;
  local_currency: string;
  exchange_rate: number;

  portfolio: PortfolioSummary;
  status_breakdown: StatusBreakdown[];
  product_breakdown: ProductBreakdown[];
  gender_distribution: GenderDistribution[];
  borrower_type_distribution: BorrowerTypeDistribution[];
  wss_loans: WSSLoans;
  geographic_breakdown: GeographicBreakdown[];
  par_30: PAR30;
}

export interface AoMReportSummary {
  aom_name: string;
  aom_code: string;
  payload: AoMReportPayload;
}

export interface AggregatedMetrics {
  total_loans: number;
  total_disbursed: number;
  total_repaid: number;
  total_outstanding: number;

  active_loans: number;
  defaulted_loans: number;
  water_loans: number;

  male_beneficiaries: number;
  female_beneficiaries: number;

  regions_served: string[];
}

export interface PortfolioSummary {
  total_loans: number;
  total_disbursed: number | string | null;
  total_repaid: number | string | null;
  total_outstanding: number | string | null;
}

export interface StatusBreakdown {
  status: string;
  count: number;
  amount: number | string | null;
  outstanding: number | string | null;
}

export interface ProductBreakdown {
  product_type: string;
  count: number;
  amount: number | string | null;
  outstanding?: number | string | null;
}

export interface GenderDistribution {
  gender: string;
  count: number;
}

export interface BorrowerTypeDistribution {
  borrower_type: string;
  count: number;
}

export interface WSSLoans {
  count: number;
  amount?: number | string | null;
  total_disbursed?: number | string | null;
  total_outstanding?: number | string | null;
  outstanding?: number | string | null;
}

export interface GeographicBreakdown {
  'street__ward__district__region__name': string | null;
  'street__ward__district__name': string | null;
  'street__ward__name': string | null;

  member_count: number;
  loan_count: number;

  total_disbursed: number | string | null;
  total_outstanding?: number | string | null;
}

export interface PAR30 {
  count: number;
  amount: number | string | null;
}

// =============================================================================
// Tenant Dashboard / Report Response Types
// =============================================================================

export interface BranchPerformance {
  name: string;
  loan_count: number;
  total_disbursed: number | string | null;
  total_outstanding: number | string | null;
  member_count: number;
}

export interface OfficerPerformance {
  name: string;
  loan_count: number;
  total_disbursed: number | string | null;
  total_outstanding: number | string | null;
  member_count: number;
}

export interface TenantPortfolioSummaryResponse {
  portfolio: PortfolioSummary;
  status_breakdown: StatusBreakdown[];
  product_breakdown: ProductBreakdown[];
  branch_performance?: BranchPerformance[];
  officer_performance?: OfficerPerformance[];
  geographic_breakdown: GeographicBreakdown[];
  wss_loans: WSSLoans;
  gender_distribution: GenderDistribution[];
  borrower_type_distribution: BorrowerTypeDistribution[];
  par_30: PAR30;
}

export interface MonthlyDisbursementPoint {
  month: string;
  count: number;
  total_amount: number | string | null;
}

export interface MonthlyRepaymentPoint {
  month: string;
  total_paid: number | string | null;
}

export interface MonthlyTrends {
  monthly_disbursements: MonthlyDisbursementPoint[];
  monthly_repayments: MonthlyRepaymentPoint[];
}

export interface LoanSummaryPortfolio {
  total_loans: number;
  total_amount: number | string | null;
  total_repaid: number | string | null;
  total_outstanding: number | string | null;

  active_count: number;
  closed_count: number;
  defaulted_count: number;
  pending_count: number;
}

export interface LoanSummaryByProduct {
  product_type: string;
  count: number;
  total_amount: number | string | null;
  outstanding: number | string | null;
}

export interface LoanSummaryByStatus {
  status: LoanStatus;
  count: number;
  total_amount: number | string | null;
  outstanding: number | string | null;
}

export interface LoanSummaryResponse {
  portfolio: LoanSummaryPortfolio;
  by_product: LoanSummaryByProduct[];
  by_status: LoanSummaryByStatus[];
  water_component: WSSLoans;
}

// =============================================================================
// Tenant Types (Isolated Schema)
// =============================================================================

export interface Region {
  id: number;
  name: string;
  code: string;
  created_at: string;
  updated_at: string;
  district_count?: number;
}

export interface District {
  id: number;
  name: string;
  code: string;
  region: number;
  region_name?: string;
  created_at: string;
  updated_at: string;
  ward_count?: number;
}

export type GeoType =
  | 'URB'
  | 'RUR'
  | 'PER'
  | 'URBAN'
  | 'RURAL'
  | 'PERI_URBAN';

export interface Ward {
  id: number;
  name: string;
  code: string;
  district: number;
  district_name?: string;
  region_name?: string;
  geo_type: GeoType;
  created_at: string;
  updated_at: string;
  street_count?: number;
}

export interface Street {
  id: number;
  name: string;
  code: string;
  ward: number;
  ward_name?: string;
  district_name?: string;
  region_name?: string;
  created_at: string;
  updated_at: string;
  member_count?: number;
  branch_count?: number;
}

export interface Branch {
  id: number;
  name: string;
  code: string;

  street: number | null;
  street_name?: string;
  ward_name?: string;
  district_name?: string;
  region_name?: string;

  phone: string;
  email: string;
  manager_name: string;

  is_active: boolean;

  created_at: string;
  updated_at: string;

  loan_officer_count?: number;
  member_count?: number;
  loan_count?: number;
}

export interface LoanOfficer {
  id: number;
  name: string;
  phone: string;
  email: string;
  employee_id: string | null;

  branch: number | null;
  branch_name?: string;

  is_active: boolean;

  created_at: string;
  updated_at: string;

  member_count?: number;
  loan_count?: number;
}

export type Gender = 'M' | 'F' | 'O';
export type BorrowerType = 'IND' | 'GRP';

export interface Member {
  id: number;
  member_id: string;
  name: string;

  gender: Gender;
  borrower_type: BorrowerType;

  phone: string;
  email: string;
  national_id: string;

  street: number | null;
  street_name?: string;
  ward_name?: string;
  district_name?: string;
  region_name?: string;

  region_1: string;
  region_2: string;
  ward: string;
  geo_type: string;

  beneficiaries: number;

  branch: number | null;
  branch_name?: string;

  loan_officer: number | null;
  loan_officer_name?: string;

  is_active: boolean;
  joined_date: string | null;

  created_at: string;
  updated_at: string;

  loan_count?: number;
  total_loan_amount?: number | string;
  total_outstanding?: number | string;

  full_address?: string;
}

export interface MemberForm {
  member_id: string;
  name: string;
  gender: Gender;
  borrower_type: BorrowerType;

  phone?: string;
  email?: string;
  national_id?: string;

  street?: number | null;

  region_1?: string;
  region_2?: string;
  ward?: string;
  street_name?: string;
  geo_type?: string;

  beneficiaries?: number;

  branch?: number | null;
  loan_officer?: number | null;

  is_active?: boolean;
  joined_date?: string | null;
}

export type LoanStatus = 'ACT' | 'CLS' | 'DEF' | 'PND';

export interface Loan {
  id: number;
  loan_number: string;

  member: number;
  member_name?: string;
  member_id?: string;

  branch: number | null;
  branch_name?: string;

  loan_officer: number | null;
  loan_officer_name?: string;

  product_type: string;
  disbursement_date: string;
  status: LoanStatus;
  water_component: boolean;

  interest_rate: string;
  loan_term: number;

  loan_amount: string;
  repaid_amount: string;
  outstanding_amount: string;

  last_report_date: string | null;

  created_at: string;
  updated_at: string;

  is_deleted: boolean;
  deleted_at: string | null;

  member_street?: string;
  member_ward?: string;
  member_district?: string;
  member_region?: string;

  schedule?: RepaymentSchedule[];
  adjustments?: LoanAdjustment[];
  documents?: LoanDocument[];
}

export interface LoanForm {
  loan_number: string;
  member: number;

  branch?: number | null;
  loan_officer?: number | null;

  product_type: string;
  disbursement_date: string;
  status: LoanStatus;
  water_component: boolean;

  interest_rate: string;
  loan_term: number;

  loan_amount: string;
  repaid_amount?: string;

  last_report_date?: string | null;
}

export interface RepaymentSchedule {
  id: number;
  loan: number;

  loan_number?: string;
  member_name?: string;

  installment_number: number;
  due_date: string;

  expected_principal: string;
  expected_interest: string;
  expected_total: string;

  actual_paid: string;
  is_paid: boolean;
  days_overdue: number;
  paid_date: string | null;

  created_at?: string;
  updated_at?: string;

  is_overdue?: boolean;
  remaining_amount?: string | number;
}

export type AdjustmentType =
  | 'PRD'
  | 'INW'
  | 'WRO'
  | 'PEN'
  | 'REV'
  | 'OTH';

export interface LoanAdjustment {
  id: number;
  loan: number;

  loan_number?: string;

  adjustment_type: AdjustmentType;
  amount: string;
  reason: string;
  reference_number: string;

  supporting_document: string | null;
  supporting_document_url?: string;

  created_by: number | null;
  created_by_name?: string;

  approved_by: number | null;
  approved_by_name?: string;
  approved_at: string | null;

  is_approved: boolean;

  created_at: string;
  updated_at?: string;
}

export interface AdjustmentForm {
  loan: number;
  adjustment_type: AdjustmentType;
  amount: string;
  reason: string;
  reference_number?: string;
  supporting_document?: File | null;
}

export type DocumentType = 'RCT' | 'AGR' | 'IDD' | 'COL' | 'OTH';

export interface LoanDocument {
  id: number;
  loan: number;

  loan_number?: string;

  document_type: DocumentType;
  file: string;
  file_url?: string;

  description: string;

  uploaded_by: number | null;
  uploaded_by_name?: string;
  uploaded_at: string;
}

export interface DocumentForm {
  loan: number;
  document_type: DocumentType;
  file: File;
  description?: string;
}

export type LoanHistoryRecord = Record<string, any>;

// =============================================================================
// Chart Data Types
// =============================================================================

export interface ChartDataPoint {
  name: string;
  value: number;
  [key: string]: string | number;
}

export interface TimeSeriesDataPoint {
  date: string;
  value: number;
  [key: string]: string | number;
}

export interface PortfolioChartData {
  labels: string[];
  datasets: {
    label: string;
    data: number[];
    backgroundColor?: string | string[];
    borderColor?: string | string[];
  }[];
}

export interface BranchPerformance {
  name: string;
  loan_count: number;
  total_disbursed: number | string | null;
  total_outstanding: number | string | null;
  member_count: number;
}

export interface OfficerPerformance {
  name: string;
  loan_count: number;
  total_disbursed: number | string | null;
  total_outstanding: number | string | null;
  member_count: number;
}

export interface TenantPortfolioSummaryResponse {
  portfolio: PortfolioSummary;
  status_breakdown: StatusBreakdown[];
  product_breakdown: ProductBreakdown[];
  branch_performance?: BranchPerformance[];
  officer_performance?: OfficerPerformance[];
  geographic_breakdown: GeographicBreakdown[];
  wss_loans: WSSLoans;
  gender_distribution: GenderDistribution[];
  borrower_type_distribution: BorrowerTypeDistribution[];
  par_30: PAR30;
}

export interface MonthlyDisbursementPoint {
  month: string;
  count: number;
  total_amount: number | string | null;
}

export interface MonthlyRepaymentPoint {
  month: string;
  total_paid: number | string | null;
}

export interface MonthlyTrends {
  monthly_disbursements: MonthlyDisbursementPoint[];
  monthly_repayments: MonthlyRepaymentPoint[];
}
