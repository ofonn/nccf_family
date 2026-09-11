import { RostersMap } from './types';

const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

function parseDateOnly(value: string): Date {
  const match = DATE_ONLY_PATTERN.exec(value);
  if (!match) {
    throw new Error(`Invalid date: ${value}`);
  }

  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  const day = Number(match[3]);
  const parsed = new Date(Date.UTC(year, monthIndex, day, 12));

  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== monthIndex ||
    parsed.getUTCDate() !== day
  ) {
    throw new Error(`Invalid date: ${value}`);
  }

  return parsed;
}

function formatDateOnly(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function addUtcDays(date: Date, days: number): Date {
  const result = new Date(date.getTime());
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

export function normalizeToSundayISO(value: string): string {
  const date = parseDateOnly(value);
  return formatDateOnly(addUtcDays(date, -date.getUTCDay()));
}

export function getCurrentSundayISO(now = new Date()): string {
  const lagosParts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Lagos',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);

  const part = (type: Intl.DateTimeFormatPartTypes) =>
    lagosParts.find((item) => item.type === type)?.value;
  const lagosDate = `${part('year')}-${part('month')}-${part('day')}`;
  return normalizeToSundayISO(lagosDate);
}

export function getFridayISO(weekStart: string): string {
  const sunday = parseDateOnly(normalizeToSundayISO(weekStart));
  return formatDateOnly(addUtcDays(sunday, 5));
}

export function isLastFridayOfMonth(weekStart: string): boolean {
  const friday = parseDateOnly(getFridayISO(weekStart));
  return addUtcDays(friday, 7).getUTCMonth() !== friday.getUTCMonth();
}

export function getWeekLabel(weekStart: string): string {
  const sunday = parseDateOnly(normalizeToSundayISO(weekStart));
  const saturday = addUtcDays(sunday, 6);
  const formatter = new Intl.DateTimeFormat('en-NG', {
    timeZone: 'UTC',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  return `${formatter.format(sunday)} – ${formatter.format(saturday)}`;
}

/**
 * Apply calendar-driven activity names without touching Glorious Service.
 * Friday discussion/game duties deliberately remain assignable but carry no
 * workload in the fair allocator.
 */
export function applyWeeklyActivityRules(
  source: RostersMap,
  requestedWeekStart: string,
): RostersMap {
  const rosters = structuredClone(source);
  const isGameWeek = isLastFridayOfMonth(requestedWeekStart);

  const fridayEvening = rosters.prayer_roster.rows.find(
    (row) => row.day === 'Friday' && row.event !== 'Morning Prayer',
  );
  if (fridayEvening) {
    fridayEvening.event = isGameWeek ? 'Game Night' : 'Discussion Night';
    fridayEvening.time = isGameWeek
      ? '09:00 PM – 11:00 PM'
      : '08:30 PM – 09:00 PM';
  }

  const saturdayEvening = rosters.prayer_roster.rows.find(
    (row) => row.day === 'Saturday' && row.event !== 'Morning Prayer',
  );
  if (saturdayEvening) {
    saturdayEvening.event = 'Praise Night';
  }

  return rosters;
}
