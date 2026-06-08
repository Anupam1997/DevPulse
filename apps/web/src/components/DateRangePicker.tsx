'use client';

import { useState } from 'react';
import { Calendar, ChevronDown } from 'lucide-react';
import { format, subDays } from 'date-fns';
import { cn } from '@/lib/utils';

interface DateRangePickerProps {
  from: string;
  to: string;
  onChange: (from: string, to: string) => void;
}

const PRESETS = [
  { label: 'Last 7 days', days: 7 },
  { label: 'Last 30 days', days: 30 },
  { label: 'Last 90 days', days: 90 },
];

export function DateRangePicker({ from, to, onChange }: DateRangePickerProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 rounded-lg border border-surface-border bg-white px-3 py-2 text-sm text-slate-700 shadow-sm hover:bg-slate-50"
      >
        <Calendar className="h-4 w-4 text-slate-400" />
        <span>
          {format(new Date(from), 'MMM d')} – {format(new Date(to), 'MMM d, yyyy')}
        </span>
        <ChevronDown className={cn('h-4 w-4 text-slate-400 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-20 mt-1 w-48 rounded-lg border border-surface-border bg-white py-1 shadow-lg">
            {PRESETS.map((preset) => (
              <button
                key={preset.days}
                onClick={() => {
                  const toDate = new Date();
                  const fromDate = subDays(toDate, preset.days);
                  onChange(format(fromDate, 'yyyy-MM-dd'), format(toDate, 'yyyy-MM-dd'));
                  setOpen(false);
                }}
                className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
              >
                {preset.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
