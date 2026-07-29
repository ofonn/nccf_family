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
  createdAt: string;
  isCanon: boolean;
  rosters: RostersMap;
}

export interface HistoryPayload {
  previousSave: RostersMap | null;
  snapshots: WeeklySnapshot[];
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
