import Link from 'next/link';
import { Activity, GitBranch, BarChart3, Zap } from 'lucide-react';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-brand-900 to-slate-900">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-500">
            <Activity className="h-5 w-5 text-white" />
          </div>
          <span className="text-xl font-bold text-white">DevPulse</span>
        </div>
        <Link
          href="/login"
          className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-slate-900 hover:bg-slate-100"
        >
          Sign in with GitHub
        </Link>
      </nav>

      <main className="mx-auto max-w-6xl px-6 py-20 text-center">
        <h1 className="text-5xl font-bold tracking-tight text-white sm:text-6xl">
          Engineering activity,
          <br />
          <span className="text-brand-400">at a glance</span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-300">
          DevPulse aggregates GitHub commits, PRs, reviews, and issues into team velocity metrics,
          sprint burndown views, and contributor leaderboards — with real-time updates.
        </p>
        <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
          <Link
            href="/login"
            className="rounded-xl bg-brand-500 px-8 py-3.5 text-base font-semibold text-white shadow-lg shadow-brand-500/25 hover:bg-brand-400"
          >
            Get started free
          </Link>
        </div>

        <div className="mt-24 grid gap-6 sm:grid-cols-3">
          {[
            { icon: BarChart3, title: 'Velocity Metrics', desc: 'Track commits and PR merges over time' },
            { icon: GitBranch, title: 'Sprint Burndown', desc: 'Ideal vs actual burndown per sprint' },
            { icon: Zap, title: 'Real-time Updates', desc: 'Live activity feed via GitHub webhooks' },
          ].map((feature) => (
            <div
              key={feature.title}
              className="rounded-2xl border border-white/10 bg-white/5 p-6 text-left backdrop-blur-sm"
            >
              <feature.icon className="h-8 w-8 text-brand-400" />
              <h3 className="mt-4 text-lg font-semibold text-white">{feature.title}</h3>
              <p className="mt-2 text-sm text-slate-400">{feature.desc}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
