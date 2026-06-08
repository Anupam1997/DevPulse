'use client';

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

interface VelocityChartProps {
  data: Array<{ date: string; commits: number; mergedPRs: number }>;
}

export function VelocityChart({ data }: VelocityChartProps) {
  const isEmpty =
    data.length === 0 || data.every((d) => d.commits === 0 && d.mergedPRs === 0);

  const formatted = data.map((d) => ({
    ...d,
    label: new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
  }));

  return (
    <div className="rounded-xl border border-surface-border bg-white p-5 shadow-sm">
      <h3 className="mb-4 text-sm font-semibold text-slate-900">Team Velocity</h3>
      {isEmpty ? (
        <div className="flex h-[280px] items-center justify-center px-6 text-center text-sm text-slate-400">
          No activity in this period. Push some commits or open a PR.
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={280}>
        <AreaChart data={formatted}>
          <defs>
            <linearGradient id="commitsGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="prsGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94a3b8' }} />
          <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} />
          <Tooltip
            contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Area
            type="monotone"
            dataKey="commits"
            stroke="#0ea5e9"
            fill="url(#commitsGrad)"
            strokeWidth={2}
            name="Commits"
          />
          <Area
            type="monotone"
            dataKey="mergedPRs"
            stroke="#8b5cf6"
            fill="url(#prsGrad)"
            strokeWidth={2}
            name="PRs Merged"
          />
        </AreaChart>
      </ResponsiveContainer>
      )}
    </div>
  );
}
