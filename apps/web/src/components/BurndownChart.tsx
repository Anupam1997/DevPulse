'use client';

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

interface BurndownChartProps {
  data: Array<{ date: string; ideal: number; actual: number }>;
  sprintName?: string;
}

export function BurndownChart({ data, sprintName }: BurndownChartProps) {
  const formatted = data.map((d) => ({
    ...d,
    label: new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
  }));

  return (
    <div className="rounded-xl border border-surface-border bg-white p-5 shadow-sm">
      <h3 className="mb-4 text-sm font-semibold text-slate-900">
        Sprint Burndown{sprintName ? ` — ${sprintName}` : ''}
      </h3>
      {formatted.length === 0 ? (
        <div className="flex h-[280px] items-center justify-center text-sm text-slate-400">
          No active sprint — create one to see burndown
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={formatted}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94a3b8' }} />
            <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} />
            <Tooltip
              contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Line
              type="monotone"
              dataKey="ideal"
              stroke="#94a3b8"
              strokeDasharray="5 5"
              strokeWidth={2}
              dot={false}
              name="Ideal"
            />
            <Line
              type="monotone"
              dataKey="actual"
              stroke="#0ea5e9"
              strokeWidth={2}
              dot={{ r: 3 }}
              name="Actual"
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
