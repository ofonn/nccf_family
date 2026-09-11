import { describe, expect, it } from 'vitest';
import { DEFAULT_PARTICIPANT_NAMES, DEFAULT_ROSTERS } from '@/lib/constants';
import { generateFairRoster, getSlotEligibility } from '@/lib/fairRoster';
import { getCurrentSundayISO } from '@/lib/rosterCalendar';

const five = DEFAULT_PARTICIPANT_NAMES.slice(0, 5).map((name, index) => ({
  id: `elig-m${index + 1}`,
  name,
}));

const weekStart = getCurrentSundayISO();

function generatedFiveSeeded() {
  return generateFairRoster({
    rosters: structuredClone(DEFAULT_ROSTERS),
    members: five,
    weekStart,
    mode: 'weighted',
    priorBalances: {},
    seed: 'eligibility-test-seed',
    generatedAt: new Date().toISOString(),
  });
}

describe('getSlotEligibility', () => {
  it('marks the current occupant eligible on a fresh draft', () => {
    const result = generatedFiveSeeded();
    const mondayPrayerIndex = result.rosters.prayer_roster.rows.findIndex(
      (row) => row.day === 'Monday' && row.event === 'Morning Prayer',
    );
    const eligibility = getSlotEligibility({
      rosters: result.rosters,
      members: five,
      weekStart,
      mode: 'weighted',
      rosterId: 'prayer_roster',
      rowIndex: mondayPrayerIndex,
    });
    expect(eligibility).not.toBeNull();
    expect(eligibility).toHaveLength(5);
    const currentName = result.rosters.prayer_roster.rows[mondayPrayerIndex]!.person;
    const current = eligibility!.find((entry) => entry.name === currentName);
    expect(current?.eligible).toBe(true);
  });

  it('marks both cooks eligible for their own pair slot', () => {
    const result = generatedFiveSeeded();
    const mondayCookIndex = result.rosters.cooking_roster.rows.findIndex(
      (row) => row.day === 'Monday',
    );
    const eligibility = getSlotEligibility({
      rosters: result.rosters,
      members: five,
      weekStart,
      mode: 'weighted',
      rosterId: 'cooking_roster',
      rowIndex: mondayCookIndex,
    });
    expect(eligibility).not.toBeNull();
    const occupants = (result.rosters.cooking_roster.rows[mondayCookIndex]!.person ?? '')
      .split('&')
      .map((name) => name.trim());
    expect(occupants).toHaveLength(2);
    for (const name of occupants) {
      expect(eligibility!.find((entry) => entry.name === name)?.eligible).toBe(true);
    }
  });

  it('blocks same-day double duty with a reason', () => {
    const result = generatedFiveSeeded();
    const mondayCookIndex = result.rosters.cooking_roster.rows.findIndex(
      (row) => row.day === 'Monday',
    );
    const mondayCook = (result.rosters.cooking_roster.rows[mondayCookIndex]!.person ?? '')
      .split('&')
      .map((name) => name.trim())[0]!;
    const mondayPrayerIndex = result.rosters.prayer_roster.rows.findIndex(
      (row) => row.day === 'Monday' && row.event === 'Morning Prayer',
    );
    const eligibility = getSlotEligibility({
      rosters: result.rosters,
      members: five,
      weekStart,
      mode: 'weighted',
      rosterId: 'prayer_roster',
      rowIndex: mondayPrayerIndex,
    });
    const cook = eligibility!.find((entry) => entry.name === mondayCook)!;
    expect(cook.eligible).toBe(false);
    expect(cook.reason).toBe('Already on duty that day');
  });

  it('blocks consecutive-day duties with a rest-day reason', () => {
    const result = generatedFiveSeeded();
    const rosters = structuredClone(result.rosters);
    const mondayPrayer = rosters.prayer_roster.rows.find(
      (row) => row.day === 'Monday' && row.event === 'Morning Prayer',
    )!;
    const mondayCook = mondayPrayer.person!;
    const others = five.map((member) => member.name).filter((name) => name !== mondayCook);

    // Clear every Tuesday duty for the Monday occupant; keep counts parseable.
    rosters.prayer_roster.rows
      .filter((row) => row.day === 'Tuesday')
      .forEach((row, index) => { row.person = others[index % others.length]; });
    rosters.cleaning_roster.rows
      .filter((row) => row.day === 'Tuesday')
      .forEach((row) => { row.person = others[0]; });
    rosters.cooking_roster.rows
      .filter((row) => row.day === 'Tuesday')
      .forEach((row) => { row.person = `${others[1]} & ${others[2]}`; });

    const tuesdayPrayerIndex = rosters.prayer_roster.rows.findIndex(
      (row) => row.day === 'Tuesday' && row.event === 'Morning Prayer',
    );
    const prayerEligibility = getSlotEligibility({
      rosters,
      members: five,
      weekStart,
      mode: 'weighted',
      rosterId: 'prayer_roster',
      rowIndex: tuesdayPrayerIndex,
    });
    const prayerCandidate = prayerEligibility!.find((entry) => entry.name === mondayCook)!;
    expect(prayerCandidate.eligible).toBe(false);
    expect(prayerCandidate.reason).toBe('Needs a rest day between duties');

    const tuesdayCookIndex = rosters.cooking_roster.rows.findIndex(
      (row) => row.day === 'Tuesday',
    );
    const cookEligibility = getSlotEligibility({
      rosters,
      members: five,
      weekStart,
      mode: 'weighted',
      rosterId: 'cooking_roster',
      rowIndex: tuesdayCookIndex,
    });
    const cookCandidate = cookEligibility!.find((entry) => entry.name === mondayCook);
    // The Monday occupant may or may not cook Monday; only assert when they do.
    const cooksMonday = result.rosters.cooking_roster.rows
      .filter((row) => row.day === 'Monday')
      .some((row) => (row.person ?? '').split('&').map((name) => name.trim()).includes(mondayCook));
    if (cooksMonday) {
      expect(cookCandidate!.eligible).toBe(false);
      expect(cookCandidate!.reason).toBe('Needs a rest day between duties');
    }
  });

  it('returns null for Glorious Service rows the allocator never touches', () => {
    const result = generatedFiveSeeded();
    expect(getSlotEligibility({
      rosters: result.rosters,
      members: five,
      weekStart,
      mode: 'weighted',
      rosterId: 'glorious_service',
      rowIndex: 0,
    })).toBeNull();
  });

  it('returns null when cells hold names outside the available list', () => {
    const result = generatedFiveSeeded();
    const rosters = structuredClone(result.rosters);
    rosters.prayer_roster.rows[0]!.person = 'Mystery Guest';
    const mondayPrayerIndex = 0;
    expect(getSlotEligibility({
      rosters,
      members: five,
      weekStart,
      mode: 'weighted',
      rosterId: 'prayer_roster',
      rowIndex: mondayPrayerIndex,
    })).toBeNull();
  });
});
