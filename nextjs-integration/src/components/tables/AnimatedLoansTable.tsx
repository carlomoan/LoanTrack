// components/tables/AnimatedLoansTable.tsx
'use client';
import { useQuery } from '@tanstack/react-query';
import api from '@/api/client';
import { motion } from 'framer-motion';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';

export function AnimatedLoansTable() {
  const { data: loans, isLoading } = useQuery({
    queryKey: ['loans'],
    queryFn: () => api.get('/loans/').then(res => res.data),
  });

  // Animation variants for staggered children
  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.05 // 50ms delay between each row
      }
    }
  };

  const rowVariant = {
    hidden: { opacity: 0, y: 10 },
    show: { opacity: 1, y: 0, transition: { duration: 0.3 } }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="p-6 border-b border-gray-100 flex justify-between items-center">
        <h2 className="text-xl font-semibold text-gray-900">Recent Disbursements</h2>
      </div>

      {isLoading ? (
        <div className="p-6 space-y-4">
          {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full rounded-md" />)}
        </div>
      ) : (
        <table className="w-full text-sm">
          <thead className="bg-gray-50/50 text-gray-500 text-xs uppercase tracking-wider">
            <tr>
              <th className="px-6 py-4 text-left font-medium">Loan Number</th>
              <th className="px-6 py-4 text-left font-medium">Member</th>
              <th className="px-6 py-4 text-left font-medium">Amount</th>
              <th className="px-6 py-4 text-left font-medium">Status</th>
            </tr>
          </thead>
          <motion.tbody variants={container} initial="hidden" animate="show" className="divide-y divide-gray-100">
            {loans?.map((loan: any) => {
              const hasOverdue = loan.schedule?.some((s: any) => s.days_overdue > 0);
              return (
                <motion.tr
                  key={loan.id}
                  variants={rowVariant}
                  className={`hover:bg-gray-50/50 transition-colors cursor-pointer ${hasOverdue ? 'bg-red-50/30' : ''}`}
                >
                  <td className="px-6 py-4 font-medium text-gray-900">{loan.loan_number}</td>
                  <td className="px-6 py-4 text-gray-600">{loan.member.name}</td>
                  <td className="px-6 py-4 text-gray-900 font-medium">${loan.loan_amount}</td>
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
          </motion.tbody>
        </table>
      )}
    </div>
  );
}
