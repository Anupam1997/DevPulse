import { createHmac, randomBytes, timingSafeEqual } from 'crypto';
import {
  format,
  subDays,
  startOfDay,
  endOfDay,
  eachDayOfInterval,
  differenceInHours,
} from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';

export {
  encrypt,
  decrypt,
  encryptToString,
  decryptFromString,
  type EncryptedPayload,
} from './encryption';

export function generateWebhookSecret(): string {
  return randomBytes(32).toString('hex');
}

export function verifyGitHubSignature(
  payload: string | Buffer,
  signature: string,
  secret: string,
): boolean {
  if (!signature?.startsWith('sha256=')) return false;
  const expected = createHmac('sha256', secret).update(payload).digest('hex');
  const received = signature.slice(7);
  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(received));
  } catch {
    return false;
  }
}

export { startOfDay, endOfDay } from 'date-fns';

export function formatDate(date: Date | string): string {
  return format(new Date(date), 'yyyy-MM-dd');
}

/** UTC date key for metrics bucketing (yyyy-MM-dd). */
export function formatDateUTC(date: Date | string): string {
  return formatInTimeZone(new Date(date), 'UTC', 'yyyy-MM-dd');
}

export function getDateRange(from: string, to: string): Date[] {
  return eachDayOfInterval({
    start: startOfDay(new Date(from)),
    end: endOfDay(new Date(to)),
  });
}

export function getPeriodStart(period: 'week' | 'month' | 'quarter'): Date {
  const now = new Date();
  switch (period) {
    case 'week':
      return subDays(now, 7);
    case 'month':
      return subDays(now, 30);
    case 'quarter':
      return subDays(now, 90);
    default:
      return subDays(now, 7);
  }
}

export function calculateIdealBurndown(
  goalPoints: number,
  startDate: Date,
  endDate: Date,
): Array<{ date: string; ideal: number }> {
  if (goalPoints === 0) {
    const days = eachDayOfInterval({ start: startDate, end: endDate });
    return days.map((day) => ({ date: formatDate(day), ideal: 0 }));
  }

  const days = eachDayOfInterval({ start: startDate, end: endDate });
  const totalDays = days.length;
  const divisor = Math.max(totalDays - 1, 1);
  const dailyDrop = goalPoints / divisor;

  return days.map((day, index) => ({
    date: formatDate(day),
    ideal: Math.max(0, goalPoints - dailyDrop * index),
  }));
}

export function hoursBetween(start: Date, end: Date): number {
  return differenceInHours(end, start);
}

export function isPrismaError(err: unknown, code: string): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code: string }).code === code
  );
}

export function structuredLog(
  level: 'info' | 'warn' | 'error',
  message: string,
  meta?: Record<string, unknown>,
): void {
  console.log(
    JSON.stringify({
      level,
      message,
      timestamp: new Date().toISOString(),
      ...meta,
    }),
  );
}
