'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { SignOutButton } from './SignOutButton';
import {
  Menu,
  X,
  Activity,
  LayoutDashboard,
  GitBranch,
  Trophy,
  Calendar,
  Settings,
} from 'lucide-react';
import { useState } from 'react';
import { OrgSwitcher } from './OrgSwitcher';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/dashboard/repos', label: 'Repositories', icon: GitBranch },
  { href: '/dashboard/leaderboard', label: 'Leaderboard', icon: Trophy },
  { href: '/dashboard/sprints', label: 'Sprints', icon: Calendar },
  { href: '/dashboard/settings', label: 'Settings', icon: Settings },
];

interface DashboardLayoutProps {
  children: React.ReactNode;
  orgs: Array<{ id: string; name: string; role: string }>;
  currentOrgId: string;
}

export function DashboardLayout({ children, orgs, currentOrgId }: DashboardLayoutProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-surface-border bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-4">
            <button
              className="lg:hidden rounded-lg p-1.5 hover:bg-slate-100"
              onClick={() => setMobileOpen(!mobileOpen)}
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
            <Link href="/dashboard" className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600">
                <Activity className="h-4 w-4 text-white" />
              </div>
              <span className="text-lg font-bold text-slate-900">DevPulse</span>
            </Link>
            <div className="hidden sm:block">
              <OrgSwitcher orgs={orgs} currentOrgId={currentOrgId} />
            </div>
          </div>
          <SignOutButton />
        </div>
      </header>

      <div className="mx-auto flex max-w-7xl">
        <nav
          className={cn(
            'fixed inset-y-0 left-0 z-20 w-56 transform border-r border-surface-border bg-white pt-14 transition-transform lg:static lg:translate-x-0',
            mobileOpen ? 'translate-x-0' : '-translate-x-full',
          )}
        >
          <div className="flex flex-col gap-1 p-3">
            <div className="mb-2 px-1 sm:hidden">
              <OrgSwitcher orgs={orgs} currentOrgId={currentOrgId} />
            </div>
            {NAV_ITEMS.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                    active
                      ? 'bg-brand-50 text-brand-700'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900',
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </div>
        </nav>

        {mobileOpen && (
          <div
            className="fixed inset-0 z-10 bg-black/20 lg:hidden"
            onClick={() => setMobileOpen(false)}
          />
        )}

        <main className="flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
