'use client';

import { signOut } from 'next-auth/react';
import { LogOut } from 'lucide-react';
import { setAuthToken } from '@/lib/api';

interface SignOutButtonProps {
  className?: string;
  label?: string;
}

export function SignOutButton({ className, label = 'Sign out' }: SignOutButtonProps) {
  function handleSignOut() {
    setAuthToken(null);
    signOut({ callbackUrl: '/login' });
  }

  return (
    <button
      onClick={handleSignOut}
      className={
        className ??
        'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-slate-500 hover:bg-slate-100 hover:text-slate-700'
      }
    >
      <LogOut className="h-4 w-4" />
      {label}
    </button>
  );
}
