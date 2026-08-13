'use client';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion, AnimatePresence } from 'framer-motion';
import api from '@/api/client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2 } from 'lucide-react';

const schema = z.object({
  name: z.string().min(3, 'Name must be at least 3 characters'),
  gender: z.enum(['M', 'F', 'O']),
  beneficiaries: z.number().min(1, 'Must have at least 1 beneficiary'),
});

type FormData = z.infer<typeof schema>;

export function CreateMemberForm() {
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: FormData) => {
    try {
      await api.post('/members/', data);
      toast.success('Member created successfully!');
    } catch (err) {
      toast.error('Failed to create member.');
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 max-w-md">
      <div>
        <label className="text-sm font-medium text-gray-700 mb-1.5 block">Full Name</label>
        <Input {...register('name')} placeholder="John Doe" />
        <AnimatePresence>
          {errors.name && (
            <motion.p
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="text-red-500 text-xs mt-1"
            >
              {errors.name.message}
            </motion.p>
          )}
        </AnimatePresence>
      </div>

      <div>
        <label className="text-sm font-medium text-gray-700 mb-1.5 block">Gender</label>
        <select {...register('gender')} className="w-full h-11 px-3 rounded-md border border-gray-200">
          <option value="M">Male</option>
          <option value="F">Female</option>
          <option value="O">Other</option>
        </select>
      </div>

      <div>
        <label className="text-sm font-medium text-gray-700 mb-1.5 block">Beneficiaries</label>
        <Input type="number" {...register('beneficiaries', { valueAsNumber: true })} placeholder="1" />
      </div>

      <Button type="submit" disabled={isSubmitting} className="w-full">
        {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create Member'}
      </Button>
    </form>
  );
}
