import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import env from '@/config/env';

const API_URL = env.apiUrl || 'http://localhost:4000';
const REFRESH_COOKIE_NAME = 'devpulse_refresh';

export async function POST() {
  const refreshToken = cookies().get(REFRESH_COOKIE_NAME)?.value;

  if (!refreshToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const backendRes = await fetch(`${API_URL}/auth/refresh`, {
    method: 'POST',
    headers: {
      Cookie: `${REFRESH_COOKIE_NAME}=${refreshToken}`,
    },
  });

  if (!backendRes.ok) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = (await backendRes.json()) as { token: string };
  return NextResponse.json({ token: body.token });
}
