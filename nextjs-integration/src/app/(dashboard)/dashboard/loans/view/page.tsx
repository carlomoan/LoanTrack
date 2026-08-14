// src/app/(dashboard)/loans/view/page.tsx
'use client';

import { useState } from 'react'; // ✅ Removed 'use' — not available in React 18
import { useQuery } from '@tanstack/react-query';
import { api } from '@/api/client'; // ✅ Named import
import { motion, AnimatePresence } from 'framer-motion';
import { DollarSign, AlertTriangle, CheckCircle, Clock, Calendar } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import type { Loan, RepaymentSchedule, LoanAdjustment } from '@/types';

// Helper to display adjustment type labels
const adjustmentTypeLabels: Record<string, string> = {
  PRD: 'Principal Reduction',
  INW: 'Interest Waiver',
  WRO: 'Write Off',
  PEN: 'Penalty',
  REV: 'Reversal',
  OTH: 'Other',
};

export default function LoanDetailPage({ params }: { params: { id: string } }) {
  const [activeTab, setActiveTab] = useState('overview');

  const { data: loan, isLoading } = useQuery({
    queryKey: ['loan', params.id],
    // ✅ Fixed: Use tenant API endpoint
    queryFn: () => api.get(`/tenant/loans/${params.id}/`).then(res => res.data as Loan),
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!loan) {
    return <div className="p-8 text-center text-gray-500">Loan not found.</div>;
  }

  const tabs = ['overview', 'schedule', 'adjustments'];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{loan.loan_number}</h1>
          {/* ✅ Fixed: Use flat member_name instead of loan.member.name */}
          <p className="text-gray-500">{loan.member_name || 'Unknown Member'} • {loan.product_type}</p>
        </div>
        <div className={`px-4 py-2 rounded-lg font-medium text-sm ${
          loan.status === 'ACT' ? 'bg-emerald-100 text-emerald-700' :
          loan.status === 'CLS' ? 'bg-gray-100 text-gray-700' :
          loan.status === 'DEF' ? 'bg-red-100 text-red-700' :
          'bg-yellow-100 text-yellow-700'
        }`}>
          {loan.status === 'ACT' ? 'Active' :
           loan.status === 'CLS' ? 'Closed' :
           loan.status === 'DEF' ? 'Defaulted' : 'Pending'}
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatBox icon={DollarSign} label="Loan Amount" value={`$${parseFloat(loan.loan_amount || '0').toLocaleString()}`} color="text-blue-600 bg-blue-50" />
        <StatBox icon={AlertTriangle} label="Outstanding" value={`$${parseFloat(loan.outstanding_amount || '0').toLocaleString()}`} color="text-red-600 bg-red-50" />
        <StatBox icon={CheckCircle} label="Repaid" value={`$${parseFloat(loan.repaid_amount || '0').toLocaleString()}`} color="text-emerald-600 bg-emerald-50" />
        <StatBox
          icon={Calendar}
          label="Next Due"
          value={loan.schedule?.find((s) => !s.is_paid)?.due_date || 'N/A'}
          color="text-purple-600 bg-purple-50"
        />
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-6">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`pb-4 text-sm font-medium capitalize transition-colors relative ${
                activeTab === tab ? 'text-blue-600' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab}
              {activeTab === tab && (
                <motion.div
                  layoutId="activeTab"
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600"
                />
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          {activeTab === 'overview' && (
            <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
              <h3 className="text-lg font-semibold mb-4">Loan Terms</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><span className="text-gray-500">Interest Rate:</span> <span className="font-medium">{loan.interest_rate}%</span></div>
                <div><span className="text-gray-500">Term:</span> <span className="font-medium">{loan.loan_term} months</span></div>
                <div><span className="text-gray-500">Disbursement Date:</span> <span className="font-medium">{loan.disbursement_date}</span></div>
                <div><span className="text-gray-500">Water Component:</span> <span className="font-medium">{loan.water_component ? 'Yes' : 'No'}</span></div>
                <div><span className="text-gray-500">Branch:</span> <span className="font-medium">{loan.branch_name || 'N/A'}</span></div>
                <div><span className="text-gray-500">Loan Officer:</span> <span className="font-medium">{loan.loan_officer_name || 'N/A'}</span></div>
              </div>
            </div>
          )}

          {activeTab === 'schedule' && (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              {(!loan.schedule || loan.schedule.length === 0) ? (
                <div className="p-8 text-center text-gray-500">No repayment schedule generated yet.</div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-gray-50/50 text-gray-500 text-xs uppercase">
                    <tr>
                      <th className="px-6 py-3 text-left">#</th>
                      <th className="px-6 py-3 text-left">Due Date</th>
                      <th className="px-6 py-3 text-left">Expected</th>
                      <th className="px-6 py-3 text-left">Paid</th>
                      <th className="px-6 py-3 text-left">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {loan.schedule.map((s: RepaymentSchedule) => (
                      <tr key={s.id} className={s.days_overdue > 0 && !s.is_paid ? 'bg-red-50/30' : ''}>
                        <td className="px-6 py-4">{s.installment_number}</td>
                        <td className="px-6 py-4">{s.due_date}</td>
                        <td className="px-6 py-4">${parseFloat(s.expected_total || '0').toLocaleString()}</td>
                        <td className="px-6 py-4 text-emerald-600">${parseFloat(s.actual_paid || '0').toLocaleString()}</td>
                        <td className="px-6 py-4">
                          {s.is_paid ? (
                            <span className="text-emerald-600 flex items-center gap-1"><CheckCircle className="w-4 h-4" /> Paid</span>
                          ) : s.days_overdue > 0 ? (
                            <span className="text-red-600 flex items-center gap-1"><AlertTriangle className="w-4 h-4" /> {s.days_overdue}d late</span>
                          ) : (
                            <span className="text-gray-500 flex items-center gap-1"><Clock className="w-4 h-4" /> Pending</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {activeTab === 'adjustments' && (
            <div className="space-y-4">
              {(!loan.adjustments || loan.adjustments.length === 0) ? (
                <div className="bg-white p-8 rounded-xl border border-gray-100 text-center text-gray-500">
                  No adjustments recorded.
                </div>
              ) : (
                loan.adjustments.map((adj: LoanAdjustment) => (
                  <div key={adj.id} className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex justify-between items-center">
                    <div>
                      <p className="font-medium text-gray-900">
                        ${parseFloat(adj.amount || '0').toLocaleString()} — {adjustmentTypeLabels[adj.adjustment_type] || adj.adjustment_type}
                      </p>
                      {/* ✅ Fixed: Use adj.reason, not adj.description */}
                      <p className="text-sm text-gray-500">{adj.reason}</p>
                      <p className="text-xs text-gray-400 mt-1">
                        {adj.is_approved ? `Approved by ${adj.approved_by_name || 'Admin'}` : 'Pending approval'}
                      </p>
                    </div>
                    {/* ✅ Fixed: Use adj.supporting_document_url, not adj.attachment_url */}
                    {adj.supporting_document_url && (
                      <a href={adj.supporting_document_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 text-sm hover:underline">
                        View Receipt
                      </a>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function StatBox({ icon: Icon, label, value, color }: {
  icon: any;
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
      <div className="flex items-center gap-2 mb-2">
        <div className={`p-1.5 rounded-lg ${color}`}>
          <Icon className="w-4 h-4" />
        </div>
        <span className="text-xs text-gray-500">{label}</span>
      </div>
      <p className="text-xl font-bold text-gray-900">{value}</p>
    </div>
  );
}
