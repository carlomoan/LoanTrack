'use client';
import { useState, useEffect } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import api from '@/api/client';
import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, Search, ArrowUpDown } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export function LoansDataTable() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Sync state with URL search params (allows bookmarkable/sharable views)
  const page = parseInt(searchParams.get('page') || '1');
  const search = searchParams.get('search') || '';
  const [debouncedSearch, setDebouncedSearch] = useState(search);

  // Debounce search input (300ms delay)
  useEffect(() => {
    const timer = setTimeout(() => {
      const params = new URLSearchParams(searchParams);
      if (debouncedSearch) {
        params.set('search', debouncedSearch);
      } else {
        params.delete('search');
      }
      params.delete('page'); // Reset to page 1 on new search
      router.replace(`${pathname}?${params.toString()}`);
    }, 300);
    return () => clearTimeout(timer);
  }, [debouncedSearch]);

  // Fetch data with TanStack Query (Server-side)
  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['loans', page, search],
    queryFn: () => api.get(`/loans/?page=${page}&search=${search}`).then(res => res.data),
    placeholderData: keepPreviousData, // Keeps old data visible while fetching new data (smooth UX)
  });

  const loans = data?.results || [];
  const totalPages = Math.ceil((data?.count || 0) / 10);

  const handlePageChange = (newPage: number) => {
    const params = new URLSearchParams(searchParams);
    params.set('page', String(newPage));
    router.replace(`${pathname}?${params.toString()}`);
  };

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="p-4 border-b border-gray-100 flex justify-between items-center">
        <h2 className="text-xl font-semibold text-gray-900">All Loans</h2>
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Search loan no, member..."
            value={debouncedSearch}
            onChange={(e) => setDebouncedSearch(e.target.value)}
            className="pl-9 h-10"
          />
        </div>
      </div>

      <div className="relative">
        {/* Loading Overlay for background refetches */}
        {isFetching && (
          <div className="absolute inset-0 bg-white/50 backdrop-blur-sm z-10 flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        )}

        <table className="w-full text-sm">
          <thead className="bg-gray-50/50 text-gray-500 text-xs uppercase tracking-wider">
            <tr>
              <th className="px-6 py-4 text-left font-medium flex items-center gap-1 cursor-pointer hover:text-gray-700">
                Loan # <ArrowUpDown className="w-3 h-3" />
              </th>
              <th className="px-6 py-4 text-left font-medium">Member</th>
              <th className="px-6 py-4 text-left font-medium">Outstanding</th>
              <th className="px-6 py-4 text-left font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loans.map((loan: any) => {
              const hasOverdue = loan.schedule?.some((s: any) => s.days_overdue > 0);
              return (
                <motion.tr
                  key={loan.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  onClick={() => router.push(`/loans/${loan.id}`)}
                  className={`hover:bg-gray-50/50 cursor-pointer transition-colors ${hasOverdue ? 'bg-red-50/30' : ''}`}
                >
                  <td className="px-6 py-4 font-medium text-gray-900">{loan.loan_number}</td>
                  <td className="px-6 py-4 text-gray-600">{loan.member.name}</td>
                  <td className="px-6 py-4 text-gray-900 font-medium">${loan.outstanding_amount}</td>
                  <td className="px-6 py-4">
                    {hasOverdue ? (
                      <Badge variant="destructive" className="bg-red-100 text-red-700 hover:bg-red-100">Overdue</Badge>
                    ) : (
                      <Badge variant="outline" className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-0">Active</Badge>
                    )}
                  </td>
                </motion.tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      <div className="p-4 border-t border-gray-100 flex items-center justify-between">
        <p className="text-sm text-gray-500">
          Page <span className="font-medium text-gray-900">{page}</span> of {totalPages || 1}
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handlePageChange(page - 1)}
            disabled={page === 1 || isFetching}
          >
            <ChevronLeft className="w-4 h-4 mr-1" /> Prev
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handlePageChange(page + 1)}
            disabled={page >= totalPages || isFetching}
          >
            Next <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      </div>
    </div>
  );
}
