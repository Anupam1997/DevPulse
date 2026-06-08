import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

const REFRESH_COOKIE_NAME = 'devpulse_refresh';
const MAX_AGE = 30 * 24 * 60 * 60;

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  const body = (await request.json().catch(() => ({}))) as { refreshToken?: string };
  const refreshToken = body.refreshToken ?? session?.refreshToken;

  if (!refreshToken) {
    return NextResponse.json({ error: 'No refresh token in session' }, { status: 401 });
  }

  const response = NextResponse.json({ success: true });
  response.cookies.set(REFRESH_COOKIE_NAME, refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: MAX_AGE,
  });

  return response;
}
