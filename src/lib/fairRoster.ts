import type { Roster, RostersMap, WeeklyAllocationMetadata } from './types';
import { applyWeeklyActivityRules } from './rosterCalendar';

export type FairRosterCategory = 'prayer' | 'cleaning' | 'cooking';

export type FairRosterMode = 'weighted' | 'appearances';

export type FairRosterId = Exclude<keyof RostersMap, 'glorious_service'>;

export interface FairRosterMember {
  id: string;
  name: string;
}

/**
 * A positive balance means that the member has already carried more than their
 * fair share. A negative balance means that they can preferentially receive a
 * little more work. Balances only move in weeks in which a member is selected
 * as available.
 */
export interface FairRosterBalance {
  workload: number;
  cooking: number;
  cleaning: number;
}

export interface FairRosterWeights {
  eventWeights: Record<string, number>;
  defaultPrayerEvent: number;
  cleaning: number;
  cookingSundaySolo: number;
  cookingPairedRegular: number;
  cookingPairedFasting: number;
}

export interface FairRosterInput {
  flexible?: boolean;
  rosters: RostersMap;
  /** The members selected in the availability dialog for this week. */
  members: FairRosterMember[];
  /** Any date in the target Sunday-to-Saturday week, in YYYY-MM-DD format. */
  weekStart: string;
  /** Weighted effort is the default; appearances counts every position as one. */
  mode?: FairRosterMode;
  /** May include absent members; absent entries are copied without alteration. */
  priorBalances?: Record<string, FairRosterBalance>;
  seed?: string;
  /** Supplied by the UI boundary; deterministic week start is used if omitted. */
  generatedAt?: string;
  weights?: FairRosterWeights;
  /** Number of deterministic multi-start searches. Defaults to 12. */
  attempts?: number;
}

export interface FairRosterAssignment {
  taskId: string;
  rosterId: FairRosterId;
  rowIndex: number;
  day: string;
  event?: string;
  time?: string;
  category: FairRosterCategory;
  memberIds: string[];
  memberNames: string[];
  pointsPerMember: number;
  totalPoints: number;
}

export interface FairRosterMemberAssignment {
  taskId: string;
  rosterId: FairRosterId;
  rowIndex: number;
  day: string;
  event?: string;
  category: FairRosterCategory;
  points: number;
}

export interface FairRosterMemberSummary {
  memberId: string;
  name: string;
  weeklyPoints: number;
  targetPoints: number;
  deviation: number;
  assignmentCount: number;
  cookingTurns: number;
  cleaningTurns: number;
  assignments: FairRosterMemberAssignment[];
}

export interface FairRosterMetrics {
  totalPoints: number;
  targetPerMember: number;
  minimumLoad: number;
  maximumLoad: number;
  loadRange: number;
  maximumAbsoluteDeviation: number;
  squaredDeviation: number;
  jainIndex: number;
}

export interface FairRosterMetadata extends WeeklyAllocationMetadata {
  version: 1;
  mode: FairRosterMode;
  seed: string;
  weekStart: string;
  /** Human-readable names for history; stable IDs are stored separately below. */
  availableMembers: string[];
  availableMemberIds: string[];
  generatedAt: string;
  weights: Record<string, number>;
  weightConfiguration: FairRosterWeights;
  assignments: FairRosterAssignment[];
  memberLoads: Record<string, FairRosterMemberSummary>;
  fairness: Record<string, number>;
  previousBalances: Record<string, FairRosterBalance>;
  nextBalances: Record<string, FairRosterBalance>;
  balancesBefore: Record<string, FairRosterBalance>;
  balancesAfter: Record<string, FairRosterBalance>;
}

export interface ReconcileFairRosterInput {
  flexible?: boolean;
  rosters: RostersMap;
  /** The same selected-availability list used when the draft was generated. */
  members: FairRosterMember[];
  weekStart: string;
  mode?: FairRosterMode;
  balancesBefore?: Record<string, FairRosterBalance>;
  seed?: string;
  generatedAt?: string;
  weights?: FairRosterWeights;
}

export interface FairRosterResult {
  rosters: RostersMap;
  metadata: FairRosterMetadata;
  memberSummaries: FairRosterMemberSummary[];
  fairness: FairRosterMetrics;
  warnings: string[];
}

export type FairRosterErrorCode =
  | 'DUPLICATE_MEMBER_ID'
  | 'DUPLICATE_MEMBER_NAME'
  | 'INVALID_ATTEMPTS'
  | 'INVALID_ASSIGNMENT'
  | 'INVALID_BALANCE'
  | 'INVALID_GENERATED_AT'
  | 'INVALID_MEMBER'
  | 'INVALID_MODE'
  | 'INVALID_WEEK'
  | 'INVALID_WEIGHT'
  | 'NOT_ENOUGH_AVAILABLE_MEMBERS';

export class FairRosterError extends Error {
  readonly code: FairRosterErrorCode;
  readonly details?: Record<string, unknown>;

  constructor(
    code: FairRosterErrorCode,
    message: string,
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'FairRosterError';
    this.code = code;
    this.details = details;
  }
}

const ZERO_BALANCE: FairRosterBalance = {
  workload: 0,
  cooking: 0,
  cleaning: 0,
};

/**
 * One point is approximately one hour of ordinary effort. Paired cooking is
 * measured per person, so a four-point cooking job shared equally is two points
 * for each cook. These defaults are deliberately data, not allocator logic, so
 * the house can recalibrate them after observing real completion times.
 */
export const DEFAULT_FAIR_ROSTER_WEIGHTS: FairRosterWeights = {
  eventWeights: {
    'morning prayer': 0.75,
    'evening devotional': 0.75,
    'evening devotional: hymns': 0.75,
    'fasting & prayer': 1.25,
    'fasting & prayer meeting': 1.25,
    'theme exposition': 1.25,
    'bible study': 2.5,
    'discussion night': 0,
    'game night': 0,
    'praise night': 1,
  },
  defaultPrayerEvent: 1,
  cleaning: 1,
  cookingSundaySolo: 4,
  cookingPairedRegular: 2,
  cookingPairedFasting: 1.625,
};

export interface FridayNightSchedule {
  fridayDate: string;
  isLastFriday: boolean;
  event: 'Discussion Night' | 'Game Night';
  time: string;
}

interface AllocationTask {
  flexible?: boolean;
  id: string;
  rosterId: FairRosterId;
  rowIndex: number;
  day: string;
  event?: string;
  time?: string;
  category: FairRosterCategory;
  assigneeCount: number;
  pointsPerMember: number;
}

interface ObjectiveScore {
  values: number[];
}

interface AllocationStats {
  loads: number[];
  cookingTurns: number[];
  cleaningTurns: number[];
  assignmentCounts: number[];
}

type AllocationState = number[][];
type RandomSource = () => number;

const EPSILON = 1e-9;
const GAME_NIGHT_TIME = '09:00 PM – 11:00 PM';
const DISCUSSION_NIGHT_TIME = '08:30 PM – 09:00 PM';
const WEEKDAY_INDEX: Record<string, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

function normalizedMode(value: FairRosterMode | undefined): FairRosterMode {
  if (value === undefined) return 'weighted';
  if (value === 'weighted' || value === 'appearances') return value;
  throw new FairRosterError(
    'INVALID_MODE',
    'Roster mode must be either "weighted" or "appearances".',
    { mode: value },
  );
}

function round(value: number, places = 6): number {
  const scale = 10 ** places;
  return Math.round((value + Number.EPSILON) * scale) / scale;
}

function normalizeText(value: string | undefined): string {
  return (value ?? '')
    .trim()
    .toLocaleLowerCase()
    .replace(/\s+/g, ' ');
}

function cloneBalance(balance: FairRosterBalance): FairRosterBalance {
  return {
    workload: balance.workload,
    cooking: balance.cooking,
    cleaning: balance.cleaning,
  };
}

function cloneRosters(rosters: RostersMap): RostersMap {
  const cloneRoster = <T extends Roster>(roster: T): T => ({
    ...roster,
    columns: roster.columns.map((column) => ({ ...column })),
    rows: roster.rows.map((row) => ({ ...row })),
  }) as T;

  return {
    prayer_roster: cloneRoster(rosters.prayer_roster),
    glorious_service: cloneRoster(rosters.glorious_service),
    cleaning_roster: cloneRoster(rosters.cleaning_roster),
    cooking_roster: cloneRoster(rosters.cooking_roster),
  };
}

function utcDateFromIso(value: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    throw new FairRosterError(
      'INVALID_WEEK',
      'weekStart must be a real date in YYYY-MM-DD format.',
      { weekStart: value },
    );
  }

  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, monthIndex, day));

  if (
    date.getUTCFullYear() !== year
    || date.getUTCMonth() !== monthIndex
    || date.getUTCDate() !== day
  ) {
    throw new FairRosterError(
      'INVALID_WEEK',
      'weekStart must be a real date in YYYY-MM-DD format.',
      { weekStart: value },
    );
  }

  return date;
}

function formatUtcDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addUtcDays(date: Date, days: number): Date {
  const result = new Date(date.getTime());
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

/** Resolves the Friday belonging to the supplied Sunday-to-Saturday week. */
export function resolveFridayNight(weekStart: string): FridayNightSchedule {
  const suppliedDate = utcDateFromIso(weekStart);
  const daysFromSunday = suppliedDate.getUTCDay();
  const sunday = addUtcDays(suppliedDate, -daysFromSunday);
  const friday = addUtcDays(sunday, 5);
  const followingFriday = addUtcDays(friday, 7);
  const isLastFriday = followingFriday.getUTCMonth() !== friday.getUTCMonth();

  return {
    fridayDate: formatUtcDate(friday),
    isLastFriday,
    event: isLastFriday ? 'Game Night' : 'Discussion Night',
    time: isLastFriday ? GAME_NIGHT_TIME : DISCUSSION_NIGHT_TIME,
  };
}

function normalizedWeights(weights: FairRosterWeights | undefined): FairRosterWeights {
  const source = weights ?? DEFAULT_FAIR_ROSTER_WEIGHTS;
  const result: FairRosterWeights = {
    eventWeights: Object.fromEntries(
      Object.entries(source.eventWeights).map(([event, points]) => [normalizeText(event), points]),
    ),
    defaultPrayerEvent: source.defaultPrayerEvent,
    cleaning: source.cleaning,
    cookingSundaySolo: source.cookingSundaySolo,
    cookingPairedRegular: source.cookingPairedRegular,
    cookingPairedFasting: source.cookingPairedFasting,
  };

  const entries: Array<[string, number]> = [
    ...Object.entries(result.eventWeights),
    ['defaultPrayerEvent', result.defaultPrayerEvent],
    ['cleaning', result.cleaning],
    ['cookingSundaySolo', result.cookingSundaySolo],
    ['cookingPairedRegular', result.cookingPairedRegular],
    ['cookingPairedFasting', result.cookingPairedFasting],
  ];

  for (const [key, value] of entries) {
    if (!Number.isFinite(value) || value < 0) {
      throw new FairRosterError(
        'INVALID_WEIGHT',
        `The roster weight "${key}" must be a finite number greater than or equal to zero.`,
        { key, value },
      );
    }
  }

  return result;
}

/** Flattened form used by the existing weekly-snapshot JSON contract. */
export function serializeFairRosterWeights(weights: FairRosterWeights): Record<string, number> {
  const normalized = normalizedWeights(weights);
  return {
    ...Object.fromEntries(
      Object.entries(normalized.eventWeights).map(([event, points]) => [`event:${event}`, points]),
    ),
    defaultPrayerEvent: normalized.defaultPrayerEvent,
    cleaning: normalized.cleaning,
    cookingSundaySolo: normalized.cookingSundaySolo,
    cookingPairedRegular: normalized.cookingPairedRegular,
    cookingPairedFasting: normalized.cookingPairedFasting,
  };
}

/** Restores weights stored in WeeklyAllocationMetadata. */
export function deserializeFairRosterWeights(weights: Record<string, number>): FairRosterWeights {
  const eventWeights = Object.fromEntries(
    Object.entries(weights)
      .filter(([key]) => key.startsWith('event:'))
      .map(([key, points]) => [key.slice('event:'.length), points]),
  );
  return normalizedWeights({
    eventWeights,
    defaultPrayerEvent: weights.defaultPrayerEvent,
    cleaning: weights.cleaning,
    cookingSundaySolo: weights.cookingSundaySolo,
    cookingPairedRegular: weights.cookingPairedRegular,
    cookingPairedFasting: weights.cookingPairedFasting,
  });
}

function resolvedGeneratedAt(value: string | undefined, canonicalWeek: string): string {
  if (value === undefined) return `${canonicalWeek}T00:00:00.000Z`;
  if (!value.trim() || !Number.isFinite(Date.parse(value))) {
    throw new FairRosterError(
      'INVALID_GENERATED_AT',
      'generatedAt must be a valid date-time string when provided.',
      { generatedAt: value },
    );
  }
  return value;
}

function prayerEventPoints(event: string | undefined, weights: FairRosterWeights): number {
  const normalizedEvent = normalizeText(event);

  // Friday social nights deliberately carry no work credit, even if callers
  // customize the event-weight map incorrectly.
  if (normalizedEvent === 'discussion night' || normalizedEvent === 'game night') {
    return 0;
  }

  return weights.eventWeights[normalizedEvent] ?? weights.defaultPrayerEvent;
}

function buildTasks(
  rosters: RostersMap,
  weekStart: string,
  weights: FairRosterWeights,
  mode: FairRosterMode,
): AllocationTask[] {
  const calendarRosters = applyWeeklyActivityRules(rosters, weekStart);
  const tasks: AllocationTask[] = [];

  calendarRosters.prayer_roster.rows.forEach((row, rowIndex) => {
    tasks.push({
      id: `prayer_roster:${rowIndex}`,
      rosterId: 'prayer_roster',
      rowIndex,
      day: row.day,
      event: row.event,
      time: row.time,
      category: 'prayer',
      assigneeCount: 1,
      pointsPerMember: mode === 'appearances' ? 1 : prayerEventPoints(row.event, weights),
    });
  });

  rosters.cleaning_roster.rows.forEach((row, rowIndex) => {
    tasks.push({
      id: `cleaning_roster:${rowIndex}`,
      rosterId: 'cleaning_roster',
      rowIndex,
      day: row.day,
      category: 'cleaning',
      assigneeCount: 1,
      pointsPerMember: mode === 'appearances' ? 1 : weights.cleaning,
    });
  });

  rosters.cooking_roster.rows.forEach((row, rowIndex) => {
    const isSunday = normalizeText(row.day) === 'sunday';
    const isFastingDay = normalizeText(row.breakfast).includes('fasting');
    const pointsPerMember = mode === 'appearances'
      ? 1
      : isSunday
        ? weights.cookingSundaySolo
        : isFastingDay
          ? weights.cookingPairedFasting
          : weights.cookingPairedRegular;

    tasks.push({
      id: `cooking_roster:${rowIndex}`,
      rosterId: 'cooking_roster',
      rowIndex,
      day: row.day,
      category: 'cooking',
      assigneeCount: isSunday ? 1 : 2,
      pointsPerMember,
    });
  });

  return tasks;
}

function validateMembers(members: FairRosterMember[]): FairRosterMember[] {
  const validated = members.map((member) => ({
    id: member.id.trim(),
    name: member.name.trim(),
  }));
  const ids = new Set<string>();
  const names = new Set<string>();

  for (const member of validated) {
    if (!member.id || !member.name || normalizeText(member.name) === 'general') {
      throw new FairRosterError(
        'INVALID_MEMBER',
        'Each available member must have a non-empty ID and name; "General" is not a member.',
        { member },
      );
    }

    if (ids.has(member.id)) {
      throw new FairRosterError(
        'DUPLICATE_MEMBER_ID',
        `The available-member list contains the ID "${member.id}" more than once.`,
        { memberId: member.id },
      );
    }

    const normalizedName = normalizeText(member.name);
    if (names.has(normalizedName)) {
      throw new FairRosterError(
        'DUPLICATE_MEMBER_NAME',
        `The available-member list contains the name "${member.name}" more than once.`,
        { memberName: member.name },
      );
    }

    ids.add(member.id);
    names.add(normalizedName);
  }

  return validated;
}

function validateBalances(
  balances: Record<string, FairRosterBalance> | undefined,
): Record<string, FairRosterBalance> {
  const result: Record<string, FairRosterBalance> = {};

  for (const [memberId, balance] of Object.entries(balances ?? {})) {
    if (
      !balance
      || !Number.isFinite(balance.workload)
      || !Number.isFinite(balance.cooking)
      || !Number.isFinite(balance.cleaning)
    ) {
      throw new FairRosterError(
        'INVALID_BALANCE',
        `The saved fairness balance for "${memberId}" is invalid.`,
        { memberId, balance },
      );
    }
    result[memberId] = cloneBalance(balance);
  }

  return result;
}

function minimumRequiredMembers(tasks: AllocationTask[]): number {
  if (tasks.some((task) => task.flexible)) return 3;
  let required = 0;

  for (const task of tasks) {
    if (task.category !== 'cooking') continue;
    const hasAnotherDuty = tasks.some(
      (other) => other.category !== 'cooking' && normalizeText(other.day) === normalizeText(task.day),
    );
    required = Math.max(required, task.assigneeCount + (hasAnotherDuty ? 1 : 0));
  }

  if (tasks.length > 0 && required === 0) required = 1;

  const pairedCookingDays = tasks
    .filter((task) => task.category === 'cooking' && task.assigneeCount === 2)
    .map((task) => weekdayIndex(task.day))
    .filter((index): index is number => index !== undefined);

  if (pairedCookingDays.some((day) => pairedCookingDays.includes(day + 1))) {
    // Consecutive two-person cooking shifts need four distinct people.
    required = Math.max(required, 4);
  }

  if (pairedCookingDays.some(
    (day) => pairedCookingDays.includes(day + 1) && pairedCookingDays.includes(day + 2),
  )) {
    // With only four people, two disjoint pairs must alternate. A third
    // consecutive pair would repeat the first team, which this allocator
    // deliberately forbids.
    required = Math.max(required, 5);
  }

  return required;
}

function weekdayIndex(day: string): number | undefined {
  return WEEKDAY_INDEX[normalizeText(day)];
}

function areConsecutiveRosterDays(firstDay: string, secondDay: string): boolean {
  const first = weekdayIndex(firstDay);
  const second = weekdayIndex(secondDay);
  return first !== undefined && second !== undefined && Math.abs(first - second) === 1;
}

function xmur3(seed: string): () => number {
  let hash = 1779033703 ^ seed.length;
  for (let index = 0; index < seed.length; index += 1) {
    hash = Math.imul(hash ^ seed.charCodeAt(index), 3432918353);
    hash = (hash << 13) | (hash >>> 19);
  }

  return () => {
    hash = Math.imul(hash ^ (hash >>> 16), 2246822507);
    hash = Math.imul(hash ^ (hash >>> 13), 3266489909);
    return (hash ^= hash >>> 16) >>> 0;
  };
}

function mulberry32(seed: number): RandomSource {
  return () => {
    let value = (seed += 0x6d2b79f5);
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function seededRandom(seed: string): RandomSource {
  return mulberry32(xmur3(seed)());
}

function shuffled<T>(values: T[], random: RandomSource): T[] {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

function emptyState(tasks: AllocationTask[]): AllocationState {
  return tasks.map((task) => Array.from({ length: task.assigneeCount }, () => -1));
}

function cloneState(state: AllocationState): AllocationState {
  return state.map((assignees) => [...assignees]);
}

function allocationStats(
  state: AllocationState,
  tasks: AllocationTask[],
  memberCount: number,
): AllocationStats {
  const stats: AllocationStats = {
    loads: Array(memberCount).fill(0),
    cookingTurns: Array(memberCount).fill(0),
    cleaningTurns: Array(memberCount).fill(0),
    assignmentCounts: Array(memberCount).fill(0),
  };

  tasks.forEach((task, taskIndex) => {
    state[taskIndex].forEach((memberIndex) => {
      if (memberIndex < 0) return;
      stats.loads[memberIndex] += task.pointsPerMember;
      stats.assignmentCounts[memberIndex] += 1;
      if (task.category === 'cooking') stats.cookingTurns[memberIndex] += 1;
      if (task.category === 'cleaning') stats.cleaningTurns[memberIndex] += 1;
    });
  });

  return stats;
}

function totalTaskPoints(tasks: AllocationTask[]): number {
  return tasks.reduce(
    (total, task) => total + task.pointsPerMember * task.assigneeCount,
    0,
  );
}

function totalCategoryTurns(tasks: AllocationTask[], category: FairRosterCategory): number {
  return tasks.reduce(
    (total, task) => total + (task.category === category ? task.assigneeCount : 0),
    0,
  );
}

function range(values: number[]): number {
  if (values.length === 0) return 0;
  return Math.max(...values) - Math.min(...values);
}

function maximumAbsolute(values: number[]): number {
  return values.reduce((maximum, value) => Math.max(maximum, Math.abs(value)), 0);
}

function sumOfSquares(values: number[]): number {
  return values.reduce((sum, value) => sum + value * value, 0);
}

function nonCookingSameDayDuplicates(
  state: AllocationState,
  tasks: AllocationTask[],
  memberCount: number,
): number {
  const counts = new Map<string, number>();

  tasks.forEach((task, taskIndex) => {
    if (task.category === 'cooking') return;
    state[taskIndex].forEach((memberIndex) => {
      if (memberIndex < 0 || memberIndex >= memberCount) return;
      const key = `${normalizeText(task.day)}:${memberIndex}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    });
  });

  let duplicates = 0;
  counts.forEach((count) => {
    if (count > 1) duplicates += count - 1;
  });
  return duplicates;
}

// Count each exception once per person/day pair, even when prayer has
// multiple entries that day. The search minimizes these before workload.
function rotationExceptions(
  state: AllocationState,
  tasks: AllocationTask[],
  members?: FairRosterMember[],
): string[] {
  const exceptions = new Set<string>();
  for (let i = 0; i < tasks.length; i += 1) {
    for (let j = i + 1; j < tasks.length; j += 1) {
      const a = tasks[i];
      const b = tasks[j];
      if (a.category !== b.category) continue;
      if (areConsecutiveRosterDays(a.day, b.day)) {
        for (const member of state[i]) {
          if (member >= 0 && state[j].includes(member)) {
            exceptions.add(`${members?.[member]?.name ?? member}: consecutive ${a.category} duties on ${a.day} and ${b.day}.`);
          }
        }
      }
      if (a.category === 'cooking' && state[i].length === 2 && state[j].length === 2
        && state[i].every((member) => member >= 0 && state[j].includes(member))) {
        exceptions.add(`Repeated cooking team on ${a.day} and ${b.day}: ${state[i].map((member) => members?.[member]?.name ?? member).join(' & ')}.`);
      }
    }
  }
  return [...exceptions];
}

function scoreAllocation(
  state: AllocationState,
  tasks: AllocationTask[],
  members: FairRosterMember[],
  priorBalances: Record<string, FairRosterBalance>,
): ObjectiveScore {
  const stats = allocationStats(state, tasks, members.length);
  const targetLoad = totalTaskPoints(tasks) / members.length;
  const cookingTarget = totalCategoryTurns(tasks, 'cooking') / members.length;
  const cleaningTarget = totalCategoryTurns(tasks, 'cleaning') / members.length;
  const weeklyDeviations = stats.loads.map((load) => load - targetLoad);
  const projectedWorkload = members.map(
    (member, index) => (priorBalances[member.id]?.workload ?? 0) + weeklyDeviations[index],
  );
  const projectedCooking = members.map(
    (member, index) => (priorBalances[member.id]?.cooking ?? 0)
      + stats.cookingTurns[index]
      - cookingTarget,
  );
  const projectedCleaning = members.map(
    (member, index) => (priorBalances[member.id]?.cleaning ?? 0)
      + stats.cleaningTurns[index]
      - cleaningTarget,
  );

  return {
    values: [
      ...(tasks.some((task) => task.flexible) ? [rotationExceptions(state, tasks).length] : []),
      maximumAbsolute(weeklyDeviations),
      range(stats.loads),
      sumOfSquares(weeklyDeviations),
      maximumAbsolute(projectedWorkload),
      sumOfSquares(projectedWorkload),
      Math.max(maximumAbsolute(projectedCooking), maximumAbsolute(projectedCleaning)),
      sumOfSquares(projectedCooking) + sumOfSquares(projectedCleaning),
      nonCookingSameDayDuplicates(state, tasks, members.length),
      range(stats.assignmentCounts),
    ],
  };
}

function compareScores(left: ObjectiveScore, right: ObjectiveScore): number {
  for (let index = 0; index < left.values.length; index += 1) {
    const difference = left.values[index] - right.values[index];
    if (Math.abs(difference) > EPSILON) return difference < 0 ? -1 : 1;
  }
  return 0;
}

export type SlotBlockCause =
  | 'DUPLICATE_SLOT'
  | 'SAME_DAY_CONFLICT'
  | 'CONSECUTIVE_DAY'
  | 'REPEATED_PAIR';

const SLOT_BLOCK_REASONS: Record<SlotBlockCause, string> = {
  DUPLICATE_SLOT: 'Already covers this slot',
  SAME_DAY_CONFLICT: 'Already on duty that day',
  CONSECUTIVE_DAY: 'Needs a rest day between duties',
  REPEATED_PAIR: 'That cooking pair already served this week',
};

export function describeSlotBlock(cause: SlotBlockCause): string {
  return SLOT_BLOCK_REASONS[cause];
}

/**
 * Same rule set as isValidMemberAtPosition, but reports which rule blocks the
 * member so the UI can preview eligibility per slot.
 */
function memberPositionBlockCause(
  state: AllocationState,
  tasks: AllocationTask[],
  taskIndex: number,
  position: number,
  memberIndex: number,
): SlotBlockCause | null {
  const task = tasks[taskIndex];

  if (state[taskIndex].some(
    (assignedMember, assignedPosition) => assignedPosition !== position && assignedMember === memberIndex,
  )) {
    return 'DUPLICATE_SLOT';
  }

  for (let otherIndex = 0; otherIndex < tasks.length; otherIndex += 1) {
    if (otherIndex === taskIndex) continue;
    const otherTask = tasks[otherIndex];
    if (normalizeText(otherTask.day) !== normalizeText(task.day)) continue;
    if (task.category !== 'cooking' && otherTask.category !== 'cooking') continue;
    if (state[otherIndex].includes(memberIndex)) return 'SAME_DAY_CONFLICT';
  }

  if (task.flexible) return null;

  for (let otherIndex = 0; otherIndex < tasks.length; otherIndex += 1) {
    if (otherIndex === taskIndex) continue;
    const otherTask = tasks[otherIndex];
    if (otherTask.category !== task.category) continue;
    if (!areConsecutiveRosterDays(task.day, otherTask.day)) continue;
    if (state[otherIndex].includes(memberIndex)) return 'CONSECUTIVE_DAY';
  }

  if (task.category === 'cooking' && task.assigneeCount === 2) {
    const cookingPair = state[taskIndex];
    const hasCompletePair = cookingPair.length === 2 && cookingPair.every((index) => index >= 0);
    if (hasCompletePair) {
      const cookingPairKey = [...cookingPair].sort((left, right) => left - right).join(':');
      for (let otherIndex = 0; otherIndex < tasks.length; otherIndex += 1) {
        if (otherIndex === taskIndex) continue;
        const otherTask = tasks[otherIndex];
        const otherPair = state[otherIndex];
        if (otherTask.category !== 'cooking' || otherTask.assigneeCount !== 2) continue;
        if (otherPair.length !== 2 || otherPair.some((index) => index < 0)) continue;
        const otherPairKey = [...otherPair].sort((left, right) => left - right).join(':');
        if (otherPairKey === cookingPairKey) return 'REPEATED_PAIR';
      }
    }
  }

  return null;
}

function isValidMemberAtPosition(
  state: AllocationState,
  tasks: AllocationTask[],
  taskIndex: number,
  position: number,
  memberIndex: number,
): boolean {
  return memberPositionBlockCause(state, tasks, taskIndex, position, memberIndex) === null;
}

function stateIsCompleteAndValid(
  state: AllocationState,
  tasks: AllocationTask[],
  memberCount: number,
): boolean {
  for (let taskIndex = 0; taskIndex < tasks.length; taskIndex += 1) {
    for (let position = 0; position < state[taskIndex].length; position += 1) {
      const memberIndex = state[taskIndex][position];
      if (memberIndex < 0 || memberIndex >= memberCount) return false;
      if (!isValidMemberAtPosition(state, tasks, taskIndex, position, memberIndex)) return false;
    }
  }
  return true;
}

function partialCandidateScore(
  state: AllocationState,
  tasks: AllocationTask[],
  members: FairRosterMember[],
  priorBalances: Record<string, FairRosterBalance>,
): number[] {
  const stats = allocationStats(state, tasks, members.length);
  const assignedPoints = stats.loads.reduce((sum, load) => sum + load, 0);
  const assignedCooking = stats.cookingTurns.reduce((sum, turns) => sum + turns, 0);
  const assignedCleaning = stats.cleaningTurns.reduce((sum, turns) => sum + turns, 0);
  const loadTarget = assignedPoints / members.length;
  const cookingTarget = assignedCooking / members.length;
  const cleaningTarget = assignedCleaning / members.length;
  const workload = members.map(
    (member, index) => (priorBalances[member.id]?.workload ?? 0) + stats.loads[index] - loadTarget,
  );
  const cooking = members.map(
    (member, index) => (priorBalances[member.id]?.cooking ?? 0)
      + stats.cookingTurns[index]
      - cookingTarget,
  );
  const cleaning = members.map(
    (member, index) => (priorBalances[member.id]?.cleaning ?? 0)
      + stats.cleaningTurns[index]
      - cleaningTarget,
  );

  return [
    ...(tasks.some((task) => task.flexible) ? [rotationExceptions(state, tasks).length] : []),
    range(stats.loads),
    sumOfSquares(stats.loads.map((load) => load - loadTarget)),
    maximumAbsolute(workload),
    sumOfSquares(workload),
    Math.max(maximumAbsolute(cooking), maximumAbsolute(cleaning)),
    sumOfSquares(cooking) + sumOfSquares(cleaning),
    range(stats.assignmentCounts),
  ];
}

function compareNumberArrays(left: number[], right: number[]): number {
  for (let index = 0; index < left.length; index += 1) {
    const difference = left[index] - right[index];
    if (Math.abs(difference) > EPSILON) return difference < 0 ? -1 : 1;
  }
  return 0;
}

function combinations(memberCount: number, size: number): number[][] {
  if (size === 1) {
    return Array.from({ length: memberCount }, (_, memberIndex) => [memberIndex]);
  }

  const result: number[][] = [];
  for (let first = 0; first < memberCount; first += 1) {
    for (let second = first + 1; second < memberCount; second += 1) {
      result.push([first, second]);
    }
  }
  return result;
}

function chooseCandidate<T extends { score: number[] }>(
  candidates: T[],
  attempt: number,
  random: RandomSource,
): T {
  candidates.sort((left, right) => compareNumberArrays(left.score, right.score));
  const candidateWindow = attempt === 0 ? 1 : Math.min(4, candidates.length);
  const biasedIndex = Math.floor(random() * random() * candidateWindow);
  return candidates[biasedIndex];
}

function createInitialState(
  tasks: AllocationTask[],
  members: FairRosterMember[],
  priorBalances: Record<string, FairRosterBalance>,
  attempt: number,
  random: RandomSource,
): AllocationState {
  const state = emptyState(tasks);
  const cookingTaskIndexes = tasks
    .map((task, index) => ({ task, index, tie: random() }))
    .filter(({ task }) => task.category === 'cooking')
    .sort((left, right) => (
      (weekdayIndex(left.task.day) ?? Number.MAX_SAFE_INTEGER)
        - (weekdayIndex(right.task.day) ?? Number.MAX_SAFE_INTEGER)
      || right.task.pointsPerMember - left.task.pointsPerMember
      || left.tie - right.tie
    ))
    .map(({ index }) => index);

  const assignCooking = (cookingPosition: number): boolean => {
    if (cookingPosition >= cookingTaskIndexes.length) return true;
    const taskIndex = cookingTaskIndexes[cookingPosition];
    const task = tasks[taskIndex];
    const candidates: Array<{ memberIndexes: number[]; score: number[] }> = [];

    for (const memberIndexes of shuffled(combinations(members.length, task.assigneeCount), random)) {
      state[taskIndex] = [...memberIndexes];
      const valid = memberIndexes.every((memberIndex, position) => (
        isValidMemberAtPosition(state, tasks, taskIndex, position, memberIndex)
      ));
      if (valid) {
        candidates.push({
          memberIndexes,
          score: partialCandidateScore(state, tasks, members, priorBalances),
        });
      }
      state[taskIndex] = Array.from({ length: task.assigneeCount }, () => -1);
    }

    candidates.sort((left, right) => compareNumberArrays(left.score, right.score));
    if (candidates.length === 0) return false;
    const preferred = chooseCandidate(candidates, attempt, random);
    const orderedCandidates = [
      preferred,
      ...candidates.filter((candidate) => candidate !== preferred),
    ];

    for (const candidate of orderedCandidates) {
      state[taskIndex] = [...candidate.memberIndexes];
      if (assignCooking(cookingPosition + 1)) return true;
    }

    state[taskIndex] = Array.from({ length: task.assigneeCount }, () => -1);
    return false;
  };

  if (!assignCooking(0)) {
    throw new FairRosterError(
      'NOT_ENOUGH_AVAILABLE_MEMBERS',
      'No valid cooking rotation can satisfy the required rest days and unique cooking teams.',
      { available: members.length, required: minimumRequiredMembers(tasks) },
    );
  }

  const remainingTaskIndexes = tasks
    .map((task, index) => ({ task, index, tie: random() }))
    .filter(({ task }) => task.category !== 'cooking')
    .sort((left, right) => (
      right.task.pointsPerMember - left.task.pointsPerMember || left.tie - right.tie
    ))
    .map(({ index }) => index);

  for (const taskIndex of remainingTaskIndexes) {
    const candidates: Array<{ memberIndex: number; score: number[] }> = [];

    for (const memberIndex of shuffled(
      Array.from({ length: members.length }, (_, index) => index),
      random,
    )) {
      if (!isValidMemberAtPosition(state, tasks, taskIndex, 0, memberIndex)) continue;
      state[taskIndex][0] = memberIndex;
      candidates.push({
        memberIndex,
        score: partialCandidateScore(state, tasks, members, priorBalances),
      });
    }

    if (candidates.length === 0) {
      throw new FairRosterError(
        'NOT_ENOUGH_AVAILABLE_MEMBERS',
        `No available member can cover ${tasks[taskIndex].day}'s ${tasks[taskIndex].category} duty without also cooking.`,
        { day: tasks[taskIndex].day, category: tasks[taskIndex].category },
      );
    }

    const chosen = chooseCandidate(candidates, attempt, random);
    state[taskIndex][0] = chosen.memberIndex;
  }

  return state;
}

interface Position {
  taskIndex: number;
  position: number;
}

function allPositions(state: AllocationState): Position[] {
  return state.flatMap((assignees, taskIndex) => assignees.map((_, position) => ({
    taskIndex,
    position,
  })));
}

function improveState(
  initialState: AllocationState,
  tasks: AllocationTask[],
  members: FairRosterMember[],
  priorBalances: Record<string, FairRosterBalance>,
  random: RandomSource,
): AllocationState {
  let state = cloneState(initialState);
  let currentScore = scoreAllocation(state, tasks, members, priorBalances);
  const positions = allPositions(state);

  for (let round = 0; round < 24; round += 1) {
    let bestState: AllocationState | null = null;
    let bestScore = currentScore;
    let equivalentBestCount = 0;

    for (const { taskIndex, position } of shuffled(positions, random)) {
      const originalMember = state[taskIndex][position];
      for (const memberIndex of shuffled(
        Array.from({ length: members.length }, (_, index) => index),
        random,
      )) {
        if (memberIndex === originalMember) continue;
        state[taskIndex][position] = memberIndex;
        if (!isValidMemberAtPosition(state, tasks, taskIndex, position, memberIndex)) {
          state[taskIndex][position] = originalMember;
          continue;
        }

        const candidateScore = scoreAllocation(state, tasks, members, priorBalances);
        const comparison = compareScores(candidateScore, bestScore);
        if (comparison < 0) {
          bestState = cloneState(state);
          bestScore = candidateScore;
          equivalentBestCount = 1;
        } else if (comparison === 0 && compareScores(candidateScore, currentScore) < 0) {
          equivalentBestCount += 1;
          if (random() < 1 / equivalentBestCount) bestState = cloneState(state);
        }
        state[taskIndex][position] = originalMember;
      }
    }

    for (let firstIndex = 0; firstIndex < positions.length; firstIndex += 1) {
      const first = positions[firstIndex];
      for (let secondIndex = firstIndex + 1; secondIndex < positions.length; secondIndex += 1) {
        const second = positions[secondIndex];
        const firstMember = state[first.taskIndex][first.position];
        const secondMember = state[second.taskIndex][second.position];
        if (firstMember === secondMember) continue;

        state[first.taskIndex][first.position] = secondMember;
        state[second.taskIndex][second.position] = firstMember;
        const valid = isValidMemberAtPosition(
          state,
          tasks,
          first.taskIndex,
          first.position,
          secondMember,
        ) && isValidMemberAtPosition(
          state,
          tasks,
          second.taskIndex,
          second.position,
          firstMember,
        );

        if (valid) {
          const candidateScore = scoreAllocation(state, tasks, members, priorBalances);
          const comparison = compareScores(candidateScore, bestScore);
          if (comparison < 0) {
            bestState = cloneState(state);
            bestScore = candidateScore;
            equivalentBestCount = 1;
          } else if (comparison === 0 && compareScores(candidateScore, currentScore) < 0) {
            equivalentBestCount += 1;
            if (random() < 1 / equivalentBestCount) bestState = cloneState(state);
          }
        }

        state[first.taskIndex][first.position] = firstMember;
        state[second.taskIndex][second.position] = secondMember;
      }
    }

    if (!bestState || compareScores(bestScore, currentScore) >= 0) break;
    state = bestState;
    currentScore = bestScore;
  }

  return state;
}

function updateBalances(
  existing: Record<string, FairRosterBalance>,
  members: FairRosterMember[],
  stats: AllocationStats,
  tasks: AllocationTask[],
): Record<string, FairRosterBalance> {
  const next = Object.fromEntries(
    Object.entries(existing).map(([memberId, balance]) => [memberId, cloneBalance(balance)]),
  );
  const workloadTarget = totalTaskPoints(tasks) / members.length;
  const cookingTarget = totalCategoryTurns(tasks, 'cooking') / members.length;
  const cleaningTarget = totalCategoryTurns(tasks, 'cleaning') / members.length;

  members.forEach((member, index) => {
    const previous = existing[member.id] ?? ZERO_BALANCE;
    next[member.id] = {
      workload: round(previous.workload + stats.loads[index] - workloadTarget),
      cooking: round(previous.cooking + stats.cookingTurns[index] - cookingTarget),
      cleaning: round(previous.cleaning + stats.cleaningTurns[index] - cleaningTarget),
    };
  });

  return next;
}

function makeAssignments(
  state: AllocationState,
  tasks: AllocationTask[],
  members: FairRosterMember[],
): FairRosterAssignment[] {
  return tasks.map((task, taskIndex) => {
    const assignedMembers = state[taskIndex].map((memberIndex) => members[memberIndex]);
    return {
      taskId: task.id,
      rosterId: task.rosterId,
      rowIndex: task.rowIndex,
      day: task.day,
      event: task.event,
      time: task.time,
      category: task.category,
      memberIds: assignedMembers.map((member) => member.id),
      memberNames: assignedMembers.map((member) => member.name),
      pointsPerMember: task.pointsPerMember,
      totalPoints: round(task.pointsPerMember * assignedMembers.length),
    };
  });
}

function makeMemberSummaries(
  assignments: FairRosterAssignment[],
  members: FairRosterMember[],
  targetPoints: number,
): FairRosterMemberSummary[] {
  return members.map((member) => {
    const memberAssignments: FairRosterMemberAssignment[] = [];

    assignments.forEach((assignment) => {
      if (!assignment.memberIds.includes(member.id)) return;
      memberAssignments.push({
        taskId: assignment.taskId,
        rosterId: assignment.rosterId,
        rowIndex: assignment.rowIndex,
        day: assignment.day,
        event: assignment.event,
        category: assignment.category,
        points: assignment.pointsPerMember,
      });
    });

    const weeklyPoints = memberAssignments.reduce((sum, assignment) => sum + assignment.points, 0);
    return {
      memberId: member.id,
      name: member.name,
      weeklyPoints: round(weeklyPoints),
      targetPoints: round(targetPoints),
      deviation: round(weeklyPoints - targetPoints),
      assignmentCount: memberAssignments.length,
      cookingTurns: memberAssignments.filter((assignment) => assignment.category === 'cooking').length,
      cleaningTurns: memberAssignments.filter((assignment) => assignment.category === 'cleaning').length,
      assignments: memberAssignments,
    };
  });
}

function makeFairnessMetrics(summaries: FairRosterMemberSummary[]): FairRosterMetrics {
  const loads = summaries.map((summary) => summary.weeklyPoints);
  const totalPoints = loads.reduce((sum, load) => sum + load, 0);
  const target = summaries.length > 0 ? totalPoints / summaries.length : 0;
  const squaredLoadSum = sumOfSquares(loads);
  const jainIndex = squaredLoadSum === 0
    ? 1
    : (totalPoints * totalPoints) / (summaries.length * squaredLoadSum);

  return {
    totalPoints: round(totalPoints),
    targetPerMember: round(target),
    minimumLoad: round(Math.min(...loads)),
    maximumLoad: round(Math.max(...loads)),
    loadRange: round(range(loads)),
    maximumAbsoluteDeviation: round(maximumAbsolute(loads.map((load) => load - target))),
    squaredDeviation: round(sumOfSquares(loads.map((load) => load - target))),
    jainIndex: round(jainIndex),
  };
}

function applyAssignments(
  source: RostersMap,
  assignments: FairRosterAssignment[],
): RostersMap {
  const result = cloneRosters(source);

  assignments.forEach((assignment) => {
    const roster = result[assignment.rosterId];
    const row = roster.rows[assignment.rowIndex];
    row.person = assignment.memberNames.join(' & ');
    if (assignment.rosterId === 'prayer_roster') {
      if (assignment.event !== undefined) row.event = assignment.event;
      if (assignment.time !== undefined) row.time = assignment.time;
    }
  });

  return result;
}

function completeBalancesBefore(
  existing: Record<string, FairRosterBalance>,
  members: FairRosterMember[],
): Record<string, FairRosterBalance> {
  const result = Object.fromEntries(
    Object.entries(existing).map(([memberId, balance]) => [memberId, cloneBalance(balance)]),
  );
  members.forEach((member) => {
    if (!result[member.id]) result[member.id] = cloneBalance(ZERO_BALANCE);
  });
  return result;
}

function metricsRecord(metrics: FairRosterMetrics): Record<string, number> {
  return {
    totalPoints: metrics.totalPoints,
    targetPerMember: metrics.targetPerMember,
    minimumLoad: metrics.minimumLoad,
    maximumLoad: metrics.maximumLoad,
    loadRange: metrics.loadRange,
    maximumAbsoluteDeviation: metrics.maximumAbsoluteDeviation,
    squaredDeviation: metrics.squaredDeviation,
    jainIndex: metrics.jainIndex,
  };
}

function finishAllocation(options: {
  sourceRosters: RostersMap;
  state: AllocationState;
  tasks: AllocationTask[];
  members: FairRosterMember[];
  balancesBefore: Record<string, FairRosterBalance>;
  weights: FairRosterWeights;
  mode: FairRosterMode;
  seed: string;
  canonicalWeek: string;
  generatedAt?: string;
  warnings?: string[];
}): FairRosterResult {
  const {
    sourceRosters,
    state,
    tasks,
    members,
    weights,
    mode,
    seed,
    canonicalWeek,
  } = options;
  const stats = allocationStats(state, tasks, members.length);
  const assignments = makeAssignments(state, tasks, members);
  const targetPoints = totalTaskPoints(tasks) / members.length;
  const memberSummaries = makeMemberSummaries(assignments, members, targetPoints);
  const fairness = makeFairnessMetrics(memberSummaries);
  const balancesBefore = completeBalancesBefore(options.balancesBefore, members);
  const balancesAfter = updateBalances(balancesBefore, members, stats, tasks);
  const memberLoads = Object.fromEntries(
    memberSummaries.map((summary) => [summary.memberId, summary]),
  );
  const previousBalances = Object.fromEntries(
    Object.entries(balancesBefore).map(([memberId, balance]) => [
      memberId,
      cloneBalance(balance),
    ]),
  );
  const nextBalances = Object.fromEntries(
    Object.entries(balancesAfter).map(([memberId, balance]) => [
      memberId,
      cloneBalance(balance),
    ]),
  );
  const availableMemberIds = members.map((member) => member.id);
  const availableMemberNames = members.map((member) => member.name);

  return {
    rosters: applyAssignments(sourceRosters, assignments),
    metadata: {
      flexible: tasks.some((task) => task.flexible),
      relaxedRules: rotationExceptions(state, tasks, members),
      version: 1,
      mode,
      seed,
      weekStart: canonicalWeek,
      availableMembers: [...availableMemberNames],
      availableMemberIds: [...availableMemberIds],
      generatedAt: resolvedGeneratedAt(options.generatedAt, canonicalWeek),
      weights: serializeFairRosterWeights(weights),
      weightConfiguration: normalizedWeights(weights),
      assignments,
      memberLoads,
      fairness: metricsRecord(fairness),
      previousBalances,
      nextBalances,
      balancesBefore: previousBalances,
      balancesAfter: nextBalances,
    },
    memberSummaries,
    fairness,
    warnings: [...(options.warnings ?? []), ...rotationExceptions(state, tasks, members)],
  };
}

function parseAssignedMemberIndexes(
  person: string | undefined,
  members: FairRosterMember[],
  task: AllocationTask,
): number[] {
  const names = (person ?? '')
    .split(/&|,|\band\b/i)
    .map((name) => name.trim())
    .filter(Boolean);

  if (names.length !== task.assigneeCount) {
    throw new FairRosterError(
      'INVALID_ASSIGNMENT',
      `${task.day}'s ${task.category} duty requires exactly ${task.assigneeCount} ${task.assigneeCount === 1 ? 'person' : 'distinct people'}.`,
      {
        taskId: task.id,
        expected: task.assigneeCount,
        received: names.length,
      },
    );
  }

  const memberIndexes = names.map((name) => members.findIndex(
    (member) => normalizeText(member.name) === normalizeText(name),
  ));
  const unavailableIndex = memberIndexes.findIndex((memberIndex) => memberIndex < 0);
  if (unavailableIndex >= 0) {
    throw new FairRosterError(
      'INVALID_ASSIGNMENT',
      `"${names[unavailableIndex]}" is not in this week's selected available-member list.`,
      { taskId: task.id, memberName: names[unavailableIndex] },
    );
  }

  if (new Set(memberIndexes).size !== memberIndexes.length) {
    throw new FairRosterError(
      'INVALID_ASSIGNMENT',
      `${task.day}'s cooking partners must be distinct people.`,
      { taskId: task.id, memberNames: names },
    );
  }

  return memberIndexes;
}

/**
 * Recomputes persisted metadata after a generated draft has been manually
 * edited. It never generates replacements: invalid or unavailable names and
 * cook/duty clashes are reported so the UI can block a stale publication.
 */
export function reconcileFairRosterMetadata(
  input: ReconcileFairRosterInput,
): FairRosterResult {
  const members = validateMembers(input.members);
  const weights = normalizedWeights(input.weights);
  const mode = normalizedMode(input.mode);
  const tasks = buildTasks(input.rosters, input.weekStart, weights, mode);
  if (input.flexible) tasks.forEach((task) => { task.flexible = true; });
  const balancesBefore = validateBalances(input.balancesBefore);
  const minimumMembers = minimumRequiredMembers(tasks);

  if (members.length < minimumMembers) {
    throw new FairRosterError(
      'NOT_ENOUGH_AVAILABLE_MEMBERS',
      `At least ${minimumMembers} available members are required: paired cooks cannot take another generated duty on the same day.`,
      { available: members.length, required: minimumMembers },
    );
  }

  const state = emptyState(tasks);
  tasks.forEach((task, taskIndex) => {
    const row = input.rosters[task.rosterId].rows[task.rowIndex];
    state[taskIndex] = parseAssignedMemberIndexes(row.person, members, task);
  });

  if (!stateIsCompleteAndValid(state, tasks, members.length)) {
    throw new FairRosterError(
      'INVALID_ASSIGNMENT',
      'This roster breaks a cooking, team-rotation, or same-roster rest-day rule.',
    );
  }

  const suppliedDate = utcDateFromIso(input.weekStart);
  const canonicalWeek = formatUtcDate(addUtcDays(suppliedDate, -suppliedDate.getUTCDay()));
  const seed = input.seed?.trim() || `${canonicalWeek}:fair-roster-v1`;

  return finishAllocation({
    sourceRosters: input.rosters,
    state,
    tasks,
    members,
    balancesBefore,
    weights,
    mode,
    seed,
    canonicalWeek,
    generatedAt: input.generatedAt,
  });
}

/**
 * Produces an effort-weighted or equal-appearance weekly allocation. The
 * search is deterministic for the same input and seed. Its lexicographic
 * objective first minimizes the worst current-week deviation, then the load
 * range/variance, matching-mode historical debt, cooking/cleaning rotation
 * debt, and finally duplicate light duties.
 */
export function generateFairRoster(input: FairRosterInput): FairRosterResult {
  if (input.flexible) {
    try {
      const strict = generateFairRoster({ ...input, flexible: false });
      strict.metadata.flexible = true;
      return strict;
    } catch (error) {
      if (!(error instanceof FairRosterError) || error.code !== 'NOT_ENOUGH_AVAILABLE_MEMBERS') throw error;
    }
  }
  const members = validateMembers(input.members);
  const weights = normalizedWeights(input.weights);
  const mode = normalizedMode(input.mode);
  const tasks = buildTasks(input.rosters, input.weekStart, weights, mode);
  if (input.flexible) tasks.forEach((task) => { task.flexible = true; });
  const balancesBefore = validateBalances(input.priorBalances);
  const minimumMembers = minimumRequiredMembers(tasks);
  const attempts = input.attempts ?? 12;

  if (!Number.isInteger(attempts) || attempts < 1 || attempts > 512) {
    throw new FairRosterError(
      'INVALID_ATTEMPTS',
      'attempts must be an integer between 1 and 512.',
      { attempts },
    );
  }

  if (members.length < minimumMembers) {
    throw new FairRosterError(
      'NOT_ENOUGH_AVAILABLE_MEMBERS',
      `At least ${minimumMembers} available members are required: paired cooks cannot take another generated duty on the same day.`,
      { available: members.length, required: minimumMembers },
    );
  }

  if (tasks.length === 0) {
    throw new FairRosterError(
      'NOT_ENOUGH_AVAILABLE_MEMBERS',
      'There are no assignable prayer, cleaning, or cooking duties.',
      { available: members.length, required: 0 },
    );
  }

  const suppliedDate = utcDateFromIso(input.weekStart);
  const canonicalWeek = formatUtcDate(addUtcDays(suppliedDate, -suppliedDate.getUTCDay()));
  const seed = input.seed?.trim() || `${canonicalWeek}:fair-roster-v1`;
  const random = seededRandom(seed);
  let bestState: AllocationState | null = null;
  let bestScore: ObjectiveScore | null = null;
  let equivalentBestCount = 0;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const initialState = createInitialState(
      tasks,
      members,
      balancesBefore,
      attempt,
      random,
    );
    const candidateScore = scoreAllocation(initialState, tasks, members, balancesBefore);

    if (!bestScore || compareScores(candidateScore, bestScore) < 0) {
      bestState = initialState;
      bestScore = candidateScore;
      equivalentBestCount = 1;
    } else if (compareScores(candidateScore, bestScore) === 0) {
      equivalentBestCount += 1;
      if (random() < 1 / equivalentBestCount) bestState = initialState;
    }
  }

  // Multi-start selection cheaply finds a feasible, well-balanced base. Run
  // the expensive local improvement once on that best base, rather than once
  // per seed. This keeps the generator responsive without weakening any hard
  // cooking or rest-day rule.
  if (bestState && bestScore) {
    const improvedState = improveState(bestState, tasks, members, balancesBefore, random);
    const improvedScore = scoreAllocation(improvedState, tasks, members, balancesBefore);
    if (compareScores(improvedScore, bestScore) <= 0) {
      bestState = improvedState;
      bestScore = improvedScore;
    }
  }

  if (!bestState || !stateIsCompleteAndValid(bestState, tasks, members.length)) {
    throw new FairRosterError(
      'NOT_ENOUGH_AVAILABLE_MEMBERS',
      'No valid allocation could be found for the selected members.',
      { available: members.length, required: minimumMembers },
    );
  }

  const warnings: string[] = [];

  if (members.length === minimumMembers && minimumMembers > 1) {
    warnings.push(
      `Only ${members.length} members are available. The roster is valid, but one non-cook may cover multiple duties on the same day.`,
    );
  }

  return finishAllocation({
    sourceRosters: input.rosters,
    state: bestState,
    tasks,
    members,
    balancesBefore,
    weights,
    mode,
    seed,
    canonicalWeek,
    generatedAt: input.generatedAt,
    warnings,
  });
}

export interface SlotEligibility {
  memberId: string;
  name: string;
  eligible: boolean;
  /** Short human reason shown when eligible is false. */
  reason?: string;
}

export interface SlotEligibilityInput {
  flexible?: boolean;
  rosters: RostersMap;
  /** This week's selected available members (IDs must match the roster names). */
  members: FairRosterMember[];
  /** Any date in the target Sunday-to-Saturday week, in YYYY-MM-DD format. */
  weekStart: string;
  mode?: FairRosterMode;
  weights?: FairRosterWeights;
  rosterId: string;
  rowIndex: number;
}

/**
 * Previews, for one roster cell, which available members can fill it without
 * breaking a cooking, team-rotation, or rest-day rule. All other cells are
 * held fixed, so the answer matches what a save-time reconcile would accept.
 *
 * Returns null when eligibility cannot be determined: unknown roster rows
 * (e.g. Glorious Service, which the allocator never touches) or cells that
 * currently hold custom names outside the available-member list.
 */
export function getSlotEligibility(input: SlotEligibilityInput): SlotEligibility[] | null {
  let members: FairRosterMember[];
  let weights: FairRosterWeights;
  let mode: FairRosterMode;
  let tasks: AllocationTask[];

  try {
    members = validateMembers(input.members);
    weights = normalizedWeights(input.weights);
    mode = normalizedMode(input.mode);
    if (members.length === 0) return null;
    tasks = buildTasks(input.rosters, input.weekStart, weights, mode);
    if (input.flexible) tasks.forEach((task) => { task.flexible = true; });
  } catch (error) {
    if (error instanceof FairRosterError) return null;
    throw error;
  }

  const taskIndex = tasks.findIndex(
    (task) => task.rosterId === input.rosterId && task.rowIndex === input.rowIndex,
  );
  if (taskIndex < 0) return null;

  // The current board must parse cleanly, otherwise per-member substitution
  // has no trustworthy base to test against.
  let baseState: AllocationState;
  try {
    baseState = emptyState(tasks);
    tasks.forEach((task, index) => {
      const row = input.rosters[task.rosterId].rows[task.rowIndex];
      baseState[index] = parseAssignedMemberIndexes(row?.person, members, task);
    });
  } catch (error) {
    if (error instanceof FairRosterError) return null;
    throw error;
  }

  const task = tasks[taskIndex];

  const testSingle = (memberIndex: number): SlotBlockCause | null => {
    const candidate = cloneState(baseState);
    candidate[taskIndex] = [memberIndex];
    if (stateIsCompleteAndValid(candidate, tasks, members.length)) return null;
    return memberPositionBlockCause(candidate, tasks, taskIndex, 0, memberIndex)
      ?? 'SAME_DAY_CONFLICT';
  };

  const testPairMember = (memberIndex: number): SlotBlockCause | null => {
    const currentPair = baseState[taskIndex];
    const partners: number[] = [];
    for (const occupant of currentPair) {
      if (occupant >= 0 && occupant !== memberIndex && !partners.includes(occupant)) {
        partners.push(occupant);
      }
    }
    for (let partner = 0; partner < members.length; partner += 1) {
      if (partner !== memberIndex && !partners.includes(partner)) partners.push(partner);
    }

    const causes = new Map<SlotBlockCause, number>();
    for (const partner of partners) {
      const candidate = cloneState(baseState);
      candidate[taskIndex] = [memberIndex, partner];
      if (stateIsCompleteAndValid(candidate, tasks, members.length)) return null;
      const cause = memberPositionBlockCause(candidate, tasks, taskIndex, 0, memberIndex)
        ?? memberPositionBlockCause(candidate, tasks, taskIndex, 1, partner)
        ?? 'SAME_DAY_CONFLICT';
      causes.set(cause, (causes.get(cause) ?? 0) + 1);
    }

    let topCause: SlotBlockCause = 'SAME_DAY_CONFLICT';
    let topCount = -1;
    causes.forEach((count, cause) => {
      if (count > topCount) {
        topCount = count;
        topCause = cause;
      }
    });
    return topCause;
  };

  return members.map((member, memberIndex) => {
    const block = task.assigneeCount === 2
      ? testPairMember(memberIndex)
      : testSingle(memberIndex);
    return block === null
      ? { memberId: member.id, name: member.name, eligible: true }
      : {
        memberId: member.id,
        name: member.name,
        eligible: false,
        reason: describeSlotBlock(block),
      };
  });
}
