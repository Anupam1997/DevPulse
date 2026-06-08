'use client';

import { Suspense } from 'react';
import LoginPage from './LoginForm';

export default function Page() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" />
        </div>
      }
    >
      <LoginPage />
    </Suspense>
  );
}
