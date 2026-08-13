import { LucideIcon } from 'lucide-react';
import { clsx } from 'clsx';
import { motion } from 'framer-motion';

interface StatCardProps {
  title: string;
  value: number | string;
  prefix?: string;
  suffix?: string;
  icon: LucideIcon;
  color: string;
}

export function StatCard({ title, value, prefix, suffix, icon: Icon, color }: StatCardProps) {
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="fuse-card p-6 flex items-start justify-between">
      <div>
        <p className="text-sm font-medium text-slate-500">{title}</p>
        <h4 className="text-2xl font-bold text-slate-900 mt-2">
          {prefix}{typeof value === 'number' ? value.toLocaleString() : value}{suffix}
        </h4>
      </div>
      <div className={clsx('p-3 rounded-xl', color)}>
        <Icon className="h-6 w-6" />
      </div>
    </motion.div>
  );
}
