// src/app/(dashboard)/loans/new/page.tsx
'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useCreateLoan } from '@/hooks/useLoans';
import { useMembers } from '@/hooks/useMembers';
import { useBranches } from '@/hooks/useBranches';
import { useLoanOfficers } from '@/hooks/useLoanOfficers';
import { LocationSelector } from '@/components/forms/LocationSelector';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { toast } from 'sonner';

const loanSchema = z.object({
  loan_number: z.string().min(1, 'Loan number is required'),
  member: z.string().min(1, 'Member is required'),
  branch: z.string().optional(),
  loan_officer: z.string().optional(),
  product_type: z.string().min(1, 'Product type is required'),
  disbursement_date: z.string().min(1, 'Disbursement date is required'),
  status: z.enum(['ACT', 'CLS', 'DEF', 'PND']),
  water_component: z.boolean(),
  interest_rate: z.string().min(1, 'Interest rate is required'),
  loan_term: z.number().min(1, 'Loan term is required'),
  loan_amount: z.string().min(1, 'Loan amount is required'),
  repaid_amount: z.string().default('0'),
  // ✅ outstanding_amount removed — Django auto-calculates it
});

type LoanFormData = z.infer<typeof loanSchema>;

export default function NewLoanPage() {
  const [selectedRegion, setSelectedRegion] = useState<string>('');
  const [selectedDistrict, setSelectedDistrict] = useState<string>('');
  const [selectedWard, setSelectedWard] = useState<string>('');
  const [selectedStreet, setSelectedStreet] = useState<string>('');

  const createLoan = useCreateLoan();
  const { data: members } = useMembers();
  const { data: branches } = useBranches();
  const { data: loanOfficers } = useLoanOfficers();

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<LoanFormData>({
    resolver: zodResolver(loanSchema),
    defaultValues: {
      status: 'PND',
      water_component: false,
      repaid_amount: '0',
      // ✅ outstanding_amount removed
    },
  });

  const handleLocationChange = (field: string, value: string) => {
    switch (field) {
      case 'region':
        setSelectedRegion(value);
        setSelectedDistrict('');
        setSelectedWard('');
        setSelectedStreet('');
        setValue('branch', '');
        break;
      case 'district':
        setSelectedDistrict(value);
        setSelectedWard('');
        setSelectedStreet('');
        setValue('branch', '');
        break;
      case 'ward':
        setSelectedWard(value);
        setSelectedStreet('');
        setValue('branch', '');
        break;
      case 'street':
        setSelectedStreet(value);
        const streetBranch = branches?.results?.find(b => b.street === parseInt(value));
        if (streetBranch) {
          setValue('branch', streetBranch.id.toString());
        }
        break;
    }
  };

  const onSubmit = async (data: LoanFormData) => {
    try {
      await createLoan.mutateAsync({
        ...data,
        member: parseInt(data.member),
        branch: data.branch ? parseInt(data.branch) : null,
        loan_officer: data.loan_officer ? parseInt(data.loan_officer) : null, // ✅ Fixed typo
        interest_rate: data.interest_rate,    // ✅ Keep as string
        loan_amount: data.loan_amount,        // ✅ Keep as string
        repaid_amount: data.repaid_amount,    // ✅ Keep as string
        // ✅ outstanding_amount removed — Django auto-calculates it
      });
      toast.success('Loan created successfully!');
    } catch (error) {
      toast.error('Failed to create loan'); // ✅ Fixed typo
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Create New Loan</h1>
        <p className="text-gray-600">Create a new loan record for a member</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Loan Number</label>
            <Input {...register('loan_number')} placeholder="Enter loan number" />
            {errors.loan_number && (
              <p className="mt-1 text-sm text-red-600">{errors.loan_number.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Member</label>
            <Select onValueChange={(value) => setValue('member', value)}>
              <SelectTrigger>
                <SelectValue placeholder="Select member" />
              </SelectTrigger>
              <SelectContent>
                {members?.results?.map((member) => (
                  <SelectItem key={member.id} value={member.id.toString()}>
                    {member.name} (ID: {member.member_id})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.member && (
              <p className="mt-1 text-sm text-red-600">{errors.member.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Product Type</label>
            <Input {...register('product_type')} placeholder="Enter product type" />
            {errors.product_type && (
              <p className="mt-1 text-sm text-red-600">{errors.product_type.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Disbursement Date</label>
            <Input type="date" {...register('disbursement_date')} />
            {errors.disbursement_date && (
              <p className="mt-1 text-sm text-red-600">{errors.disbursement_date.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
            <Select onValueChange={(value) => setValue('status', value as any)} defaultValue="PND">
              <SelectTrigger>
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ACT">Active</SelectItem>
                <SelectItem value="CLS">Closed</SelectItem>
                <SelectItem value="DEF">Defaulted</SelectItem>
                <SelectItem value="PND">Pending</SelectItem>
              </SelectContent>
            </Select>
            {errors.status && (
              <p className="mt-1 text-sm text-red-600">{errors.status.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Interest Rate (%)</label>
            <Input
              type="number"
              step="0.01"
              placeholder="Enter interest rate"
              {...register('interest_rate')}
            />
            {errors.interest_rate && (
              <p className="mt-1 text-sm text-red-600">{errors.interest_rate.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Loan Term (months)</label>
            <Input
              type="number"
              placeholder="Enter loan term"
              {...register('loan_term', { valueAsNumber: true })}
            />
            {errors.loan_term && (
              <p className="mt-1 text-sm text-red-600">{errors.loan_term.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Loan Amount</label>
            <Input
              type="number"
              step="0.01"
              placeholder="Enter loan amount"
              {...register('loan_amount')}
            />
            {errors.loan_amount && (
              <p className="mt-1 text-sm text-red-600">{errors.loan_amount.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Repaid Amount</label>
            <Input
              type="number"
              step="0.01"
              placeholder="Enter repaid amount"
              {...register('repaid_amount')}
            />
          </div>

          {/* ✅ Outstanding Amount field removed — auto-calculated by Django */}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Loan Officer</label>
            <Select onValueChange={(value) => setValue('loan_officer', value)}>
              <SelectTrigger>
                <SelectValue placeholder="Select loan officer" />
              </SelectTrigger>
              <SelectContent>
                {loanOfficers?.results?.map((officer) => (
                  <SelectItem key={officer.id} value={officer.id.toString()}>
                    {officer.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="border-t pt-6">
          <h2 className="text-lg font-semibold mb-4">Location Information</h2>
          <LocationSelector onLocationChange={handleLocationChange} />
        </div>

        <div className="flex justify-end space-x-4">
          <Button type="button" variant="outline" onClick={() => window.history.back()}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Creating...' : 'Create Loan'}
          </Button>
        </div>
      </form>
    </div>
  );
}
