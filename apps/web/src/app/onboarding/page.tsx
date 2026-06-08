import { authOptions } from '@/lib/auth';
import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { OnboardingClient } from './OnboardingClient';

export default async function OnboardingPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/login');

  return <OnboardingClient username={session.user?.name ?? 'there'} />;
}
