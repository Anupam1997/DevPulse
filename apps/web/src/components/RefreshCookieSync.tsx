'use client';

import { useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';

/** Syncs the refresh token from NextAuth session into an httpOnly browser cookie. */
export function RefreshCookieSync() {
  const { data: session, status } = useSession();
  const synced = useRef(false);

  useEffect(() => {
    if (status !== 'authenticated' || !session?.refreshToken || synced.current) return;

    synced.current = true;
    void fetch('/api/auth/set-refresh', {
      method: 'POST',
      credentials: 'include',
    });
  }, [session?.refreshToken, status]);

  return null;
}
