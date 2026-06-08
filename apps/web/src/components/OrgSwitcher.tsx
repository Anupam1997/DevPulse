'use client';

import { useState } from 'react';
import { ChevronDown, Building2, Check } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { api, setAuthToken, setPreferredOrgId } from '@/lib/api';
import { cn } from '@/lib/utils';

interface OrgSwitcherProps {
  orgs: Array<{ id: string; name: string; role: string }>;
  currentOrgId: string;
}

export function OrgSwitcher({ orgs, currentOrgId }: OrgSwitcherProps) {
  const [open, setOpen] = useState(false);
  const [switching, setSwitching] = useState(false);
  const queryClient = useQueryClient();
  const current = orgs.find((o) => o.id === currentOrgId);

  async function handleSwitch(orgId: string) {
    if (orgId === currentOrgId) {
      setOpen(false);
      return;
    }
    setSwitching(true);
    try {
      const { token, refreshToken } = await api.switchOrg(orgId);
      setAuthToken(token);
      setPreferredOrgId(orgId);

      if (refreshToken) {
        await fetch('/api/auth/set-refresh', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ refreshToken }),
        });
      }

      queryClient.clear();
      window.location.reload();
    } catch (err) {
      console.error('Failed to switch org:', err);
    } finally {
      setSwitching(false);
    }
  }

  if (orgs.length <= 1) {
    return (
      <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
        <Building2 className="h-4 w-4 text-slate-400" />
        {current?.name ?? 'Organization'}
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        disabled={switching}
        className="flex items-center gap-2 rounded-lg border border-surface-border bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50"
      >
        <Building2 className="h-4 w-4 text-slate-400" />
        {current?.name ?? 'Select org'}
        <ChevronDown className={cn('h-4 w-4 text-slate-400', open && 'rotate-180')} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 z-20 mt-1 w-56 rounded-lg border border-surface-border bg-white py-1 shadow-lg">
            {orgs.map((org) => (
              <button
                key={org.id}
                onClick={() => handleSwitch(org.id)}
                className="flex w-full items-center justify-between px-4 py-2 text-left text-sm hover:bg-slate-50"
              >
                <span className="text-slate-700">{org.name}</span>
                {org.id === currentOrgId && <Check className="h-4 w-4 text-brand-600" />}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
