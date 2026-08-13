'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useCreateMember } from '@/hooks/useMembers';
import { useBranches } from '@/hooks/useBranches';
import { useLoanOfficers } from '@/hooks/useLoanOfficers';
import { LocationSelector } from '@/components/forms/LocationSelector';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { toast } from 'sonner';

const memberSchema = z.object({
  member_id: z.string().min(1, 'Member ID is required'),
  name: z.string().min(1, 'Name is required'),
  gender: z.enum(['M', 'F', 'O']),
  borrower_type: z.enum(['IND', 'GRP']),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  national_id: z.string().optional(),
  street: z.string().optional(),
  beneficiaries: z.number().min(1, 'At least 1 beneficiary required'),
  branch: z.string().optional(),
  loan_officer: z.string().optional(),
  is_active: z.boolean().default(true),
  joined_date: z.string().optional(),
});

type MemberFormData = z.infer<typeof memberSchema>;

export default function NewMemberPage() {
  const [selectedRegion, setSelectedRegion] = useState<string>('');
  const [selectedDistrict, setSelectedDistrict] = useState<string>('');
  const [selectedWard, setSelectedWard] = useState<string>('');
  const [selectedStreet, setSelectedStreet] = useState<string>('');

  const createMember = useCreateMember();
  const { data: branches } = useBranches();
  const { data: loanOfficers } = useLoanOfficers();

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<MemberFormData>({
    resolver: zodResolver(memberSchema),
    defaultValues: {
      gender: 'M',
      borrower_type: 'IND',
      is_active: true,
      beneficiaries: 1,
    },
  });

  const handleLocationChange = (field: string, value: string) => {
    switch (field) {
      case 'region':
        setSelectedRegion(value);
        setSelectedDistrict('');
        setSelectedWard('');
        setSelectedStreet('');
        setValue('street', '');
        setValue('branch', '');
        break;
      case 'district':
        setSelectedDistrict(value);
        setSelectedWard('');
        setSelectedStreet('');
        setValue('street', '');
        setValue('branch', '');
        break;
      case 'ward':
        setSelectedWard(value);
        setSelectedStreet('');
        setValue('street', '');
        setValue('branch', '');
        break;
      case 'street':
        setSelectedStreet(value);
        // Find branch for this street
        const streetBranch = branches?.results?.find(b => b.street === parseInt(value));
        if (streetBranch) {
          setValue('branch', streetBranch.id.toString());
        }
        break;
    }
  };

  const onSubmit = async (data: MemberFormData) => {
    try {
      await createMember.mutateAsync({
        ...data,
        street: data.street ? parseInt(data.street) : null,
        branch: data.branch ? parseInt(data.branch) : null,
        loan_officer: data.loan_officer ? parseInt(data.loan_officer) : null,
        joined_date: data.joined_date || null,
      });
      toast.success('Member created successfully!');
    } catch (error) {
      toast.error('Failed to create member');
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Create New Member</h1>
        <p className="text-gray-600">Add a new borrower/member to the system</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Member ID
            </label>
            <Input
              {...register('member_id')}
              placeholder="Enter member ID"
            />
            {errors.member_id && (
              <p className="mt-1 text-sm text-red-600">{errors.member_id.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Full Name
            </label>
            <Input
              {...register('name')}
              placeholder="Enter full name"
            />
            {errors.name && (
              <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Gender
            </label>
            <Select
              onValueChange={(value) => setValue('gender', value as any)}
              defaultValue="M"
            >
              <SelectTrigger>
                <SelectValue placeholder="Select gender" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="M">Male</SelectItem>
                <SelectItem value="F">Female</SelectItem>
                <SelectItem value="O">Other</SelectItem>
              </SelectContent>
            </Select>
            {errors.gender && (
              <p className="mt-1 text-sm text-red-600">{errors.gender.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Borrower Type
            </label>
            <Select
              onValueChange={(value) => setValue('borrower_type', value as any)}
              defaultValue="IND"
            >
              <SelectTrigger>
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="IND">Individual</SelectItem>
                <SelectItem value="GRP">Group</SelectItem>
              </SelectContent>
            </Select>
            {errors.borrower_type && (
              <p className="mt-1 text-sm text-red-600">{errors.borrower_type.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Phone Number
            </label>
            <Input
              {...register('phone')}
              placeholder="Enter phone number"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Email
            </label>
            <Input
              type="email"
              {...register('email')}
              placeholder="Enter email"
            />
            {errors.email && (
              <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              National ID
            </label>
            <Input
              {...register('national_id')}
              placeholder="Enter national ID"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Beneficiaries
            </label>
            <Input
              type="number"
              {...register('beneficiaries', { valueAsNumber: true })}
              placeholder="Number of beneficiaries"
            />
            {errors.beneficiaries && (
              <p className="mt-1 text-sm text-red-600">{errors.beneficiaries.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Joined Date
            </label>
            <Input
              type="date"
              {...register('joined_date')}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Branch
            </label>
            <Select
              onValueChange={(value) => setValue('branch', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select branch" />
              </SelectTrigger>
              <SelectContent>
                {branches?.results?.map((branch) => (
                  <SelectItem key={branch.id} value={branch.id.toString()}>
                    {branch.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Loan Officer
            </label>
            <Select
              onValueChange={(value) => setValue('loan_officer', value)}
            >
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

        <div className="flex items-center space-x-2">
          <input
            type="checkbox"
            id="is_active"
            {...register('is_active')}
            className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
          />
          <label htmlFor="is_active" className="text-sm font-medium text-gray-700">
            Active member
          </label>
        </div>

        <div className="flex justify-end space-x-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => window.history.back()}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Creating...' : 'Create Member'}
          </Button>
        </div>
      </form>
    </div>
  );
}
