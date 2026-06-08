'use client';

import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  trend?: { value: number; positive: boolean };
  className?: string;
}

export function MetricCard({ title, value, subtitle, icon: Icon, trend, className }: MetricCardProps) {
  return (
    <div
      className={cn(
        'rounded-xl border border-surface-border bg-white p-5 shadow-sm transition-shadow hover:shadow-md',
        className,
      )}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">{title}</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{value}</p>
          {subtitle && <p className="mt-0.5 text-xs text-slate-400">{subtitle}</p>}
        </div>
        <div className="rounded-lg bg-brand-50 p-2.5">
          <Icon className="h-5 w-5 text-brand-600" />
        </div>
      </div>
      {trend && (
        <p
          className={cn(
            'mt-3 text-xs font-medium',
            trend.positive ? 'text-emerald-600' : 'text-red-500',
          )}
        >
          {trend.positive ? '↑' : '↓'} {Math.abs(trend.value)}% vs last period
        </p>
      )}
    </div>
  );
}
