import { create } from 'zustand';
import type { QueryParams } from '@/types';

interface DateRange {
  from: string;
  to: string;
}

interface ReportFiltersState {
  dateRange: DateRange | null;
  status: string[];
  productTypes: string[];
  branches: number[];
  loanOfficers: number[];
  waterComponent: boolean | null;
  search: string;

  page: number;
  pageSize: number;

  setDateRange: (range: DateRange | null) => void;
  setStatus: (status: string[]) => void;
  setProductTypes: (types: string[]) => void;
  setBranches: (branches: number[]) => void;
  setLoanOfficers: (officers: number[]) => void;
  setWaterComponent: (value: boolean | null) => void;
  setSearch: (search: string) => void;

  setPage: (page: number) => void;
  setPageSize: (pageSize: number) => void;

  toggleStatus: (status: string) => void;
  toggleProductType: (productType: string) => void;
  toggleBranch: (branchId: number) => void;
  toggleLoanOfficer: (officerId: number) => void;

  resetFilters: () => void;
  hasActiveFilters: () => boolean;

  getQueryParams: () => QueryParams;
  getPaginationParams: () => QueryParams;
}

const initialState = {
  dateRange: null,
  status: [],
  productTypes: [],
  branches: [],
  loanOfficers: [],
  waterComponent: null,
  search: '',
  page: 1,
  pageSize: 50,
};

function toggleValue<T>(values: T[], value: T): T[] {
  return values.includes(value)
    ? values.filter((item) => item !== value)
    : [...values, value];
}

export const useReportFilters = create<ReportFiltersState>((set, get) => ({
  ...initialState,

  setDateRange: (dateRange) => set({ dateRange, page: 1 }),
  setStatus: (status) => set({ status, page: 1 }),
  setProductTypes: (productTypes) => set({ productTypes, page: 1 }),
  setBranches: (branches) => set({ branches, page: 1 }),
  setLoanOfficers: (loanOfficers) => set({ loanOfficers, page: 1 }),
  setWaterComponent: (waterComponent) => set({ waterComponent, page: 1 }),
  setSearch: (search) => set({ search, page: 1 }),

  setPage: (page) => set({ page }),
  setPageSize: (pageSize) => set({ pageSize, page: 1 }),

  toggleStatus: (status) =>
    set((state) => ({
      status: toggleValue(state.status, status),
      page: 1,
    })),

  toggleProductType: (productType) =>
    set((state) => ({
      productTypes: toggleValue(state.productTypes, productType),
      page: 1,
    })),

  toggleBranch: (branchId) =>
    set((state) => ({
      branches: toggleValue(state.branches, branchId),
      page: 1,
    })),

  toggleLoanOfficer: (officerId) =>
    set((state) => ({
      loanOfficers: toggleValue(state.loanOfficers, officerId),
      page: 1,
    })),

  resetFilters: () => set({ ...initialState }),

  hasActiveFilters: () => {
    const state = get();

    return Boolean(
      state.dateRange ||
        state.status.length > 0 ||
        state.productTypes.length > 0 ||
        state.branches.length > 0 ||
        state.loanOfficers.length > 0 ||
        state.waterComponent !== null ||
        state.search.trim().length > 0
    );
  },

  getQueryParams: () => {
    const state = get();
    const params: QueryParams = {};

    if (state.dateRange?.from) {
      params.disbursement_date__gte = state.dateRange.from;
    }

    if (state.dateRange?.to) {
      params.disbursement_date__lte = state.dateRange.to;
    }

    if (state.status.length > 0) {
      params.status = state.status.join(',');
    }

    if (state.productTypes.length > 0) {
      params.product_type = state.productTypes.join(',');
    }

    if (state.branches.length > 0) {
      params.branch = state.branches.join(',');
    }

    if (state.loanOfficers.length > 0) {
      params.loan_officer = state.loanOfficers.join(',');
    }

    if (state.waterComponent !== null) {
      params.water_component = state.waterComponent;
    }

    if (state.search.trim()) {
      params.search = state.search.trim();
    }

    return params;
  },

  getPaginationParams: () => {
    const state = get();

    return {
      page: state.page,
      page_size: state.pageSize,
    };
  },
}));
