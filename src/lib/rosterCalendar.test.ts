import { describe, expect, it } from 'vitest';
import { DEFAULT_ROSTERS } from './constants';
import {
  applyWeeklyActivityRules,
  getFridayISO,
  getWeekLabel,
  isLastFridayOfMonth,
  normalizeToSundayISO,
} from './rosterCalendar';

describe('roster calendar rules', () => {
  it('normalizes any date to the Sunday beginning its week', () => {
    expect(normalizeToSundayISO('2026-08-16')).toBe('2026-08-16');
    expect(normalizeToSundayISO('2026-08-19')).toBe('2026-08-16');
    expect(normalizeToSundayISO('2026-08-22')).toBe('2026-08-16');
    expect(getFridayISO('2026-08-19')).toBe('2026-08-21');
  });

  it('rejects malformed and impossible dates', () => {
    expect(() => normalizeToSundayISO('2026-02-30')).toThrow('Invalid date');
    expect(() => normalizeToSundayISO('16-08-2026')).toThrow('Invalid date');
  });

  it('detects the calendar month last Friday from the target week', () => {
    expect(isLastFridayOfMonth('2026-08-16')).toBe(false);
    expect(isLastFridayOfMonth('2026-08-23')).toBe(true);
    expect(isLastFridayOfMonth('2026-08-30')).toBe(false);
  });

  it('turns only the last Friday into Game Night and keeps it weight-independent', () => {
    const normalWeek = applyWeeklyActivityRules(DEFAULT_ROSTERS, '2026-08-16');
    const gameWeek = applyWeeklyActivityRules(DEFAULT_ROSTERS, '2026-08-23');
    const normalFriday = normalWeek.prayer_roster.rows.find(
      (row) => row.day === 'Friday' && row.event !== 'Morning Prayer',
    );
    const gameFriday = gameWeek.prayer_roster.rows.find(
      (row) => row.day === 'Friday' && row.event !== 'Morning Prayer',
    );

    expect(normalFriday).toMatchObject({
      event: 'Discussion Night',
      time: '08:30 PM – 09:00 PM',
    });
    expect(gameFriday).toMatchObject({
      event: 'Game Night',
      time: '09:00 PM – 11:00 PM',
    });
    expect(gameWeek.prayer_roster.rows.find(
      (row) => row.day === 'Saturday' && row.event !== 'Morning Prayer',
    )?.event).toBe('Praise Night');
    expect(gameWeek.glorious_service).toEqual(DEFAULT_ROSTERS.glorious_service);
    expect(DEFAULT_ROSTERS.prayer_roster.rows[9].event).toBe('Discussion Night');
  });

  it('produces a readable Sunday-to-Saturday label', () => {
    expect(getWeekLabel('2026-08-19')).toBe('16 Aug 2026 – 22 Aug 2026');
  });
});
