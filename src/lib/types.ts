export type RosterColumnKey = 'time' | 'event' | 'person' | 'breakfast' | 'dinner';

export interface RosterColumn {
  key: RosterColumnKey;
  label: string;
  editable: boolean;
  isTime?: boolean;
  list?: 'members' | 'events' | 'foods';
}

export interface RosterRow {
  day: string;
  time?: string;
  event?: string;
  person?: string;
  breakfast?: string;
  dinner?: string;
  [key: string]: string | undefined;
}

export interface Roster {
  id: 'prayer_roster' | 'glorious_service' | 'cleaning_roster' | 'cooking_roster';
  title: string;
  icon: string;
  image: string;
  themeClass: string;
  editableBy: 'master' | 'prayer_coordinator';
  instruction?: string;
  columns: RosterColumn[];
  rows: RosterRow[];
}

export interface RostersMap {
  prayer_roster: Roster;
  glorious_service: Roster;
  cleaning_roster: Roster;
  cooking_roster: Roster;
}

export interface RostersPayload {
  rosters: RostersMap;
  lastUpdated?: string;
  activeWeekId?: string;
  activeWeekStart?: string;
  activeAllocation?: WeeklyAllocationMetadata | null;
  snapshots?: WeeklySnapshot[];
}

export interface Participant {
  id: string;
  name: string;
}

export interface ParticipantsPayload {
  participants: Participant[];
  persistenceAvailable: boolean;
}

export type AuthRole = 'none' | 'prayer_coordinator' | 'master';

export interface ClashWarning {
  day: string;
  person: string;
  activityA: { rosterTitle: string; timeStr?: string };
  activityB: { rosterTitle: string; timeStr?: string };
}

export interface WeeklySnapshot {
  id: string;
  weekId: string;
  weekLabel: string;
  /** Sunday that starts this roster week, in YYYY-MM-DD format. */
  weekStart?: string;
  createdAt: string;
  updatedAt?: string;
  isCanon: boolean;
  rosters: RostersMap;
  allocation?: WeeklyAllocationMetadata;
}

/**
 * Generator details saved with a weekly snapshot. Only availability and the
 * generation time are universal; allocator-specific diagnostics are kept in
 * the same JSON object so history remains reproducible as the model evolves.
 */
export interface WeeklyAllocationMetadata {
  flexible?: boolean;
  relaxedRules?: string[];
  /** Display names selected as available, retained for readable history. */
  availableMembers: string[];
  /** Stable participant IDs used for carry-over calculations. */
  availableMemberIds?: string[];
  generatedAt: string;
  weekStart?: string;
  mode?: 'weighted' | 'appearances';
  version?: number;
  seed?: string;
  weights?: unknown;
  assignments?: unknown[];
  memberLoads?: Record<string, unknown>;
  fairness?: Record<string, number>;
  previousBalances?: Record<string, WeeklyWorkloadBalance>;
  nextBalances?: Record<string, WeeklyWorkloadBalance>;
  balancesBefore?: Record<string, WeeklyWorkloadBalance>;
  balancesAfter?: Record<string, WeeklyWorkloadBalance>;
  [key: string]: unknown;
}

export interface WeeklyWorkloadBalance {
  workload: number;
  cooking: number;
  cleaning: number;
}

export interface HistoryPayload {
  previousSave: RostersMap | null;
  snapshots: WeeklySnapshot[];
  activeWeekId?: string;
  activeWeekStart?: string;
  activeAllocation?: WeeklyAllocationMetadata | null;
}

export interface Notice {
  id: string;
  title: string;
  category: 'Maintenance Dues' | 'Food & Gas' | 'General Notice' | 'Urgent';
  content: string;
  amount?: string;
  accountDetails?: string;
  createdAt: string;
  updatedAt?: string;
}
