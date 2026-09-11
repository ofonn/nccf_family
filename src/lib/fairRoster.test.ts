import { describe, expect, it } from 'vitest';
import { DEFAULT_ROSTERS } from './constants';
import {
  DEFAULT_FAIR_ROSTER_WEIGHTS,
  FairRosterError,
  generateFairRoster,
  reconcileFairRosterMetadata,
  resolveFridayNight,
  type FairRosterBalance,
  type FairRosterMember,
} from './fairRoster';
import type { RostersMap } from './types';

const MEMBERS: FairRosterMember[] = [
  'Chidera',
  'Christopher',
  'Judith',
  'Mimi',
  'Ofonime',
  'Ola',
  'Olayinka',
  'Oluchi',
  'Opeyemi',
  'Prince',
  'Segun',
  'Wale',
].map((name) => ({ id: name.toLocaleLowerCase(), name }));

function emptyAssignableRosters(): RostersMap {
  const rosters = structuredClone(DEFAULT_ROSTERS);
  rosters.prayer_roster.rows = [];
  rosters.cleaning_roster.rows = [];
  rosters.cooking_roster.rows = [];
  return rosters;
}

function zeroBalance(overrides: Partial<FairRosterBalance> = {}): FairRosterBalance {
  return { workload: 0, cooking: 0, cleaning: 0, ...overrides };
}

const WEEK_DAY_INDEX: Record<string, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

function assertFairRosterSpacing(result: ReturnType<typeof generateFairRoster>) {
  const assignmentsByCategory = new Map<string, typeof result.metadata.assignments>();

  result.metadata.assignments.forEach((assignment) => {
    const assignments = assignmentsByCategory.get(assignment.category) ?? [];
    assignments.push(assignment);
    assignmentsByCategory.set(assignment.category, assignments);
  });

  assignmentsByCategory.forEach((assignments, category) => {
    const dutyDaysByMember = new Map<string, Set<number>>();
    assignments.forEach((assignment) => {
      const dayIndex = WEEK_DAY_INDEX[assignment.day.toLocaleLowerCase()];
      expect(dayIndex).toBeDefined();
      assignment.memberIds.forEach((memberId) => {
        const days = dutyDaysByMember.get(memberId) ?? new Set<number>();
        days.add(dayIndex);
        dutyDaysByMember.set(memberId, days);
      });
    });

    dutyDaysByMember.forEach((days, memberId) => {
      [...days].forEach((day) => {
        expect(
          days.has(day + 1),
          `${memberId} was assigned ${category} on consecutive days`,
        ).toBe(false);
      });
    });
  });
}

describe('generateFairRoster', () => {
  it('obeys cooking cardinality, availability, Friday, service, and clash invariants', () => {
    const source = structuredClone(DEFAULT_ROSTERS);
    const gloriousBefore = structuredClone(source.glorious_service);
    const result = generateFairRoster({
      rosters: source,
      members: MEMBERS,
      weekStart: '2026-08-23',
      seed: 'complete-invariants',
      attempts: 12,
    });

    const cooking = result.metadata.assignments.filter(
      (assignment) => assignment.category === 'cooking',
    );
    const sunday = cooking.find((assignment) => assignment.day === 'Sunday');
    const mondayToSaturday = cooking.filter((assignment) => assignment.day !== 'Sunday');

    expect(sunday?.memberIds).toHaveLength(1);
    expect(mondayToSaturday).toHaveLength(6);
    mondayToSaturday.forEach((assignment) => {
      expect(assignment.memberIds).toHaveLength(2);
      expect(new Set(assignment.memberIds).size).toBe(2);
      expect(result.rosters.cooking_roster.rows[assignment.rowIndex].person)
        .toBe(assignment.memberNames.join(' & '));
    });

    const selectedIds = new Set(MEMBERS.map((member) => member.id));
    result.metadata.assignments.forEach((assignment) => {
      assignment.memberIds.forEach((memberId) => expect(selectedIds.has(memberId)).toBe(true));
    });

    cooking.forEach((cookingAssignment) => {
      const otherDutiesThatDay = result.metadata.assignments.filter(
        (assignment) => assignment.day === cookingAssignment.day
          && assignment.category !== 'cooking',
      );
      cookingAssignment.memberIds.forEach((cookId) => {
        expect(otherDutiesThatDay.some((assignment) => assignment.memberIds.includes(cookId)))
          .toBe(false);
      });
    });

    const gameNight = result.metadata.assignments.find(
      (assignment) => assignment.day === 'Friday' && assignment.event === 'Game Night',
    );
    expect(gameNight).toMatchObject({
      pointsPerMember: 0,
      time: '09:00 PM – 11:00 PM',
    });
    expect(result.rosters.prayer_roster.rows[9]).toMatchObject({
      event: 'Game Night',
      time: '09:00 PM – 11:00 PM',
    });

    expect(result.rosters.glorious_service).toEqual(gloriousBefore);
    expect(source.glorious_service).toEqual(gloriousBefore);
    expect(source.prayer_roster.rows[9].event).toBe('Discussion Night');
    expect(result.fairness.loadRange).toBeLessThanOrEqual(1);
    expect(result.fairness.jainIndex).toBeGreaterThan(0.99);
  });

  it('gives Discussion Night and Game Night exactly zero weight', () => {
    const normalWeek = generateFairRoster({
      rosters: DEFAULT_ROSTERS,
      members: MEMBERS.slice(0, 8),
      weekStart: '2026-08-16',
      seed: 'discussion-week',
      attempts: 4,
    });
    const gameWeek = generateFairRoster({
      rosters: DEFAULT_ROSTERS,
      members: MEMBERS.slice(0, 8),
      weekStart: '2026-08-23',
      seed: 'game-week',
      attempts: 4,
    });

    expect(normalWeek.metadata.assignments.find(
      (assignment) => assignment.event === 'Discussion Night',
    )?.pointsPerMember).toBe(0);
    expect(gameWeek.metadata.assignments.find(
      (assignment) => assignment.event === 'Game Night',
    )?.pointsPerMember).toBe(0);
  });

  it('canonicalizes Friday and Saturday activities before allocating their weight', () => {
    const source = structuredClone(DEFAULT_ROSTERS);
    source.prayer_roster.rows[9].event = 'Custom Friday Event';
    source.prayer_roster.rows[9].time = '01:00 PM – 03:00 PM';
    source.prayer_roster.rows[11].event = 'Praise & Worship';

    const result = generateFairRoster({
      rosters: source,
      members: MEMBERS.slice(0, 8),
      weekStart: '2026-08-23',
      seed: 'calendar-canonicalization',
      attempts: 4,
    });

    expect(result.rosters.prayer_roster.rows[9]).toMatchObject({
      event: 'Game Night',
      time: '09:00 PM – 11:00 PM',
    });
    expect(result.rosters.prayer_roster.rows[11].event).toBe('Praise Night');
    expect(result.metadata.assignments.find(
      (assignment) => assignment.taskId === 'prayer_roster:9',
    )?.pointsPerMember).toBe(0);
  });

  it('is reproducible for the same seed and exposes internally consistent metrics', () => {
    const input = {
      rosters: DEFAULT_ROSTERS,
      members: MEMBERS.slice(0, 10),
      weekStart: '2026-08-16',
      seed: 'reproducible-seed',
      attempts: 8,
    } as const;

    const first = generateFairRoster(input);
    const second = generateFairRoster(input);

    expect(second).toEqual(first);
    const summaryTotal = first.memberSummaries.reduce(
      (total, summary) => total + summary.weeklyPoints,
      0,
    );
    const loads = first.memberSummaries.map((summary) => summary.weeklyPoints);
    expect(first.fairness.totalPoints).toBeCloseTo(summaryTotal, 6);
    expect(first.fairness.targetPerMember).toBeCloseTo(summaryTotal / MEMBERS.slice(0, 10).length, 6);
    expect(first.fairness.minimumLoad).toBe(Math.min(...loads));
    expect(first.fairness.maximumLoad).toBe(Math.max(...loads));
    expect(first.fairness.loadRange).toBeCloseTo(Math.max(...loads) - Math.min(...loads), 6);
    expect(first.fairness.jainIndex).toBeGreaterThan(0);
    expect(first.fairness.jainIndex).toBeLessThanOrEqual(1);
    expect(first.metadata.availableMembers).toEqual(MEMBERS.slice(0, 10).map(({ name }) => name));
    expect(first.metadata.availableMemberIds).toEqual(MEMBERS.slice(0, 10).map(({ id }) => id));
    expect(first.metadata.mode).toBe('weighted');
    expect(first.metadata.memberLoads).toEqual(Object.fromEntries(
      first.memberSummaries.map((summary) => [summary.memberId, summary]),
    ));
  });

  it.each([5, 6, 9, 12])(
    'remains valid and highly weighted-fair with %i currently available members',
    (memberCount) => {
      const available = MEMBERS.slice(0, memberCount);
      const result = generateFairRoster({
        rosters: DEFAULT_ROSTERS,
        members: available,
        weekStart: '2026-08-16',
        seed: `variable-group-${memberCount}`,
        attempts: 4,
      });
      const selectedIds = new Set(available.map((member) => member.id));

      expect(result.metadata.assignments).toHaveLength(26);
      expect(result.fairness.totalPoints).toBe(45.5);
      expect(result.fairness.jainIndex).toBeGreaterThan(0.98);
      result.metadata.assignments.forEach((assignment) => {
        assignment.memberIds.forEach((memberId) => expect(selectedIds.has(memberId)).toBe(true));
      });
    },
  );

  it('rotates cleaning and cooking toward members with less category credit', () => {
    const [Ada, Bola] = [
      { id: 'ada', name: 'Ada' },
      { id: 'bola', name: 'Bola' },
    ];
    const cleaningOnly = emptyAssignableRosters();
    cleaningOnly.cleaning_roster.rows = [{ day: 'Sunday', person: 'Ada' }];
    const cookingOnly = emptyAssignableRosters();
    cookingOnly.cooking_roster.rows = [{
      day: 'Sunday',
      person: 'Ada',
      breakfast: 'Rice',
      dinner: 'Stew',
    }];

    const priorBalances = {
      ada: zeroBalance({ cleaning: 1, cooking: 1 }),
      bola: zeroBalance({ cleaning: -1, cooking: -1 }),
    };
    const cleaning = generateFairRoster({
      rosters: cleaningOnly,
      members: [Ada, Bola],
      weekStart: '2026-08-16',
      priorBalances,
      seed: 'cleaning-carry-over',
      attempts: 4,
    });
    const cooking = generateFairRoster({
      rosters: cookingOnly,
      members: [Ada, Bola],
      weekStart: '2026-08-16',
      priorBalances,
      seed: 'cooking-carry-over',
      attempts: 4,
    });

    expect(cleaning.metadata.assignments[0].memberIds).toEqual(['bola']);
    expect(cooking.metadata.assignments[0].memberIds).toEqual(['bola']);
  });

  it('freezes absent balances and only charges the actually available group', () => {
    const rosters = emptyAssignableRosters();
    rosters.cleaning_roster.rows = [{ day: 'Sunday' }];
    const priorBalances = {
      ada: zeroBalance(),
      bola: zeroBalance(),
      absent: { workload: 3.25, cooking: -0.75, cleaning: 1.5 },
    };
    const result = generateFairRoster({
      rosters,
      members: [
        { id: 'ada', name: 'Ada' },
        { id: 'bola', name: 'Bola' },
      ],
      weekStart: '2026-08-16',
      priorBalances,
      seed: 'availability-aware',
      attempts: 2,
    });

    expect(result.metadata.nextBalances.absent).toEqual(priorBalances.absent);
    expect(
      result.metadata.nextBalances.ada.workload
      + result.metadata.nextBalances.bola.workload,
    ).toBeCloseTo(0, 6);
    expect(
      result.metadata.nextBalances.ada.cleaning
      + result.metadata.nextBalances.bola.cleaning,
    ).toBeCloseTo(0, 6);
  });

  it.each([2, 3, 4])(
    'reports an explicit infeasibility when %i people cannot cover the required cooking rotation',
    (memberCount) => {
      expect(() => generateFairRoster({
        rosters: DEFAULT_ROSTERS,
        members: MEMBERS.slice(0, memberCount),
        weekStart: '2026-08-16',
        seed: `too-small-${memberCount}`,
      })).toThrowError(expect.objectContaining({
        name: 'FairRosterError',
        code: 'NOT_ENOUGH_AVAILABLE_MEMBERS',
        details: { available: memberCount, required: 5 },
      }));
    },
  );

  it('uses half of the original cooking burden per partner while keeping Sunday solo high', () => {
    expect(DEFAULT_FAIR_ROSTER_WEIGHTS.cookingSundaySolo).toBe(4);
    expect(DEFAULT_FAIR_ROSTER_WEIGHTS.cookingPairedRegular).toBe(2);
    expect(DEFAULT_FAIR_ROSTER_WEIGHTS.cookingPairedFasting).toBe(1.625);
  });

  it('can balance purely by appearance count without effort weights', () => {
    const result = generateFairRoster({
      rosters: DEFAULT_ROSTERS,
      members: MEMBERS,
      weekStart: '2026-08-23',
      mode: 'appearances',
      seed: 'equal-appearances',
      attempts: 8,
    });

    expect(result.metadata.mode).toBe('appearances');
    expect(result.fairness.totalPoints).toBe(32);
    expect(result.fairness.loadRange).toBeLessThanOrEqual(1);
    // With 32 indivisible positions across 12 people, the mathematical
    // optimum is eight people on 3 and four people on 2 appearances.
    expect(result.fairness.jainIndex).toBeGreaterThan(0.96);
    result.metadata.assignments.forEach((assignment) => {
      expect(assignment.pointsPerMember).toBe(1);
      expect(assignment.totalPoints).toBe(assignment.memberIds.length);
    });
    result.memberSummaries.forEach((summary) => {
      expect(summary.weeklyPoints).toBe(summary.assignmentCount);
    });
    expect(result.metadata.assignments.find(
      (assignment) => assignment.event === 'Game Night',
    )?.pointsPerMember).toBe(1);
  });

  it.each([5, 6, 9, 12])(
    'keeps raw appearance totals within one position for %i available members',
    (memberCount) => {
      const result = generateFairRoster({
        rosters: DEFAULT_ROSTERS,
        members: MEMBERS.slice(0, memberCount),
        weekStart: '2026-08-16',
        mode: 'appearances',
        seed: `appearance-group-${memberCount}`,
        attempts: 4,
      });

      expect(result.fairness.totalPoints).toBe(32);
      expect(result.fairness.loadRange).toBeLessThanOrEqual(1);
    },
  );

  it.each(['weighted', 'appearances'] as const)(
    'never repeats a Monday–Saturday cooking pair in %s mode',
    (mode) => {
      const result = generateFairRoster({
        rosters: DEFAULT_ROSTERS,
        members: MEMBERS,
        weekStart: '2026-08-16',
        mode,
        seed: `unique-cooking-pairs-${mode}`,
        attempts: 12,
      });
      const pairs = result.metadata.assignments
        .filter((assignment) => assignment.category === 'cooking' && assignment.day !== 'Sunday')
        .map((assignment) => [...assignment.memberIds].sort().join(':'));

      expect(pairs).toHaveLength(6);
      expect(new Set(pairs).size).toBe(pairs.length);
    },
  );

  it.each(['weighted', 'appearances'] as const)(
    'keeps each person’s duties at least one calendar day apart within each category in %s mode',
    (mode) => {
      const result = generateFairRoster({
        rosters: DEFAULT_ROSTERS,
        members: MEMBERS,
        weekStart: '2026-08-16',
        mode,
        seed: `category-day-spacing-${mode}`,
        attempts: 12,
      });

      // Categories are deliberately independent: prayer today and cooking
      // tomorrow is allowed; cooking today and cooking tomorrow is not.
      assertFairRosterSpacing(result);
    },
  );

  it('reconciles manual appearance-mode drafts without converting them to weights', () => {
    const generated = generateFairRoster({
      rosters: DEFAULT_ROSTERS,
      members: MEMBERS.slice(0, 8),
      weekStart: '2026-08-16',
      mode: 'appearances',
      seed: 'appearance-reconciliation',
      attempts: 4,
    });
    const reconciled = reconcileFairRosterMetadata({
      rosters: generated.rosters,
      members: MEMBERS.slice(0, 8),
      weekStart: '2026-08-16',
      mode: 'appearances',
      balancesBefore: generated.metadata.balancesBefore,
      seed: generated.metadata.seed,
      weights: generated.metadata.weightConfiguration,
    });

    expect(reconciled.metadata.mode).toBe('appearances');
    expect(reconciled.fairness.totalPoints).toBe(32);
    expect(reconciled.memberSummaries.every(
      (summary) => summary.weeklyPoints === summary.assignmentCount,
    )).toBe(true);
  });
});

describe('calendar and reconciliation helpers', () => {
  it('recognizes the calendar last Friday and exact 9 PM–11 PM Game Night window', () => {
    expect(resolveFridayNight('2026-08-19')).toEqual({
      fridayDate: '2026-08-21',
      isLastFriday: false,
      event: 'Discussion Night',
      time: '08:30 PM – 09:00 PM',
    });
    expect(resolveFridayNight('2026-08-23')).toEqual({
      fridayDate: '2026-08-28',
      isLastFriday: true,
      event: 'Game Night',
      time: '09:00 PM – 11:00 PM',
    });
  });

  it('recomputes metadata from manual edits and rejects stale invalid edits', () => {
    const generated = generateFairRoster({
      rosters: DEFAULT_ROSTERS,
      members: MEMBERS.slice(0, 8),
      weekStart: '2026-08-16',
      seed: 'manual-edit',
      attempts: 4,
    });
    const edited = structuredClone(generated.rosters);
    const mondayCook = generated.metadata.assignments.find(
      (assignment) => assignment.category === 'cooking' && assignment.day === 'Monday',
    );
    const mondayPrayer = generated.metadata.assignments.find(
      (assignment) => assignment.category === 'prayer' && assignment.day === 'Monday',
    );
    expect(mondayCook).toBeDefined();
    expect(mondayPrayer).toBeDefined();

    const validEdit = structuredClone(generated.rosters);
    const mondayCookIds = new Set(mondayCook!.memberIds);
    const adjacentPrayerIds = new Set(generated.metadata.assignments
      .filter((assignment) => assignment.category === 'prayer'
        && (assignment.day === 'Sunday' || assignment.day === 'Tuesday'))
      .flatMap((assignment) => assignment.memberIds));
    const replacement = MEMBERS.slice(0, 8).find(
      (member) => !mondayCookIds.has(member.id)
        && !adjacentPrayerIds.has(member.id),
    );
    expect(replacement).toBeDefined();
    validEdit.prayer_roster.rows[mondayPrayer!.rowIndex].person = replacement!.name;
    const reconciled = reconcileFairRosterMetadata({
      rosters: validEdit,
      members: MEMBERS.slice(0, 8),
      weekStart: '2026-08-16',
      balancesBefore: generated.metadata.previousBalances,
      seed: generated.metadata.seed,
      weights: generated.metadata.weightConfiguration,
    });
    expect(reconciled.metadata.assignments.find(
      (assignment) => assignment.taskId === mondayPrayer!.taskId,
    )?.memberIds).toEqual([replacement!.id]);
    expect(reconciled.metadata.nextBalances).not.toEqual(generated.metadata.nextBalances);

    edited.prayer_roster.rows[mondayPrayer!.rowIndex].person = mondayCook!.memberNames[0];
    expect(() => reconcileFairRosterMetadata({
      rosters: edited,
      members: MEMBERS.slice(0, 8),
      weekStart: '2026-08-16',
      balancesBefore: generated.metadata.previousBalances,
      seed: generated.metadata.seed,
      weights: generated.metadata.weightConfiguration,
    })).toThrowError(expect.objectContaining({
      name: 'FairRosterError',
      code: 'INVALID_ASSIGNMENT',
    }));

    const missingPartner = structuredClone(generated.rosters);
    missingPartner.cooking_roster.rows[mondayCook!.rowIndex].person = mondayCook!.memberNames[0];
    expect(() => reconcileFairRosterMetadata({
      rosters: missingPartner,
      members: MEMBERS.slice(0, 8),
      weekStart: '2026-08-16',
      balancesBefore: generated.metadata.previousBalances,
      seed: generated.metadata.seed,
      weights: generated.metadata.weightConfiguration,
    })).toThrow(FairRosterError);
  });
});
