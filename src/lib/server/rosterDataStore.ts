import http from 'http';
import https from 'https';
import { DEFAULT_ROSTERS } from '@/lib/constants';
import {
  normalizeRosterActivities,
  normalizeWeeklySnapshots,
} from '@/lib/historyManager';
import type {
  RostersMap,
  WeeklyAllocationMetadata,
  WeeklySnapshot,
} from '@/lib/types';
import { normalizeToSundayISO } from '@/lib/rosterCalendar';

const REQUEST_TIMEOUT_MS = 15_000;

export interface StoredRosterData {
  rosters: RostersMap;
  previousSave: RostersMap | null;
  snapshots: WeeklySnapshot[];
  activeWeekId?: string;
  activeWeekStart?: string;
  activeAllocation?: WeeklyAllocationMetadata | null;
  previousSaveWeekId?: string;
  previousSaveWeekStart?: string;
  previousSaveAllocation?: WeeklyAllocationMetadata | null;
  lastUpdated: string;
  [key: string]: unknown;
}

interface HttpResponse {
  ok: boolean;
  status: number;
  body: string;
  json: unknown;
}

interface HttpRequestOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
}

export class RosterPersistenceError extends Error {
  constructor(
    message: string,
    public readonly code:
      | 'PERSISTENCE_NOT_CONFIGURED'
      | 'PERSISTENCE_UNAVAILABLE'
      | 'PERSISTENCE_INVALID_RESPONSE',
    public readonly status = 503,
  ) {
    super(message);
    this.name = 'RosterPersistenceError';
  }
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function isRostersMap(value: unknown): value is RostersMap {
  if (!isRecord(value)) return false;

  const rosterIds: Array<keyof RostersMap> = [
    'prayer_roster',
    'glorious_service',
    'cleaning_roster',
    'cooking_roster',
  ];

  return rosterIds.every((rosterId) => {
    const roster = value[rosterId];
    return (
      isRecord(roster) &&
      roster.id === rosterId &&
      Array.isArray(roster.columns) &&
      Array.isArray(roster.rows)
    );
  });
}

export function isAllocationMetadata(value: unknown): value is WeeklyAllocationMetadata {
  return (
    isRecord(value) &&
    Array.isArray(value.availableMembers) &&
    value.availableMembers.every((member) => typeof member === 'string') &&
    typeof value.generatedAt === 'string'
  );
}

function normalizeOptionalWeekStart(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  try {
    return normalizeToSundayISO(value);
  } catch {
    return undefined;
  }
}

function normalizeTimestamp(value: unknown): string {
  if (typeof value === 'string' && Number.isFinite(Date.parse(value))) return value;
  return new Date().toISOString();
}

export function createDefaultRosterData(): StoredRosterData {
  return {
    rosters: clone(DEFAULT_ROSTERS),
    previousSave: null,
    snapshots: [],
    lastUpdated: new Date().toISOString(),
  };
}

/**
 * Lazily migrates the JSON document without performing a write. The next
 * authenticated mutation persists this normalized representation.
 */
export function normalizeStoredRosterData(value: unknown): StoredRosterData {
  const source = isRecord(value) ? clone(value) : {};
  const activeWeekStart = normalizeOptionalWeekStart(source.activeWeekStart);
  const previousSaveWeekStart = normalizeOptionalWeekStart(source.previousSaveWeekStart);
  const rosters = isRostersMap(source.rosters)
    ? normalizeRosterActivities(source.rosters, activeWeekStart)
    : normalizeRosterActivities(DEFAULT_ROSTERS, activeWeekStart);
  const previousSave = isRostersMap(source.previousSave)
    ? normalizeRosterActivities(source.previousSave, previousSaveWeekStart)
    : null;
  const snapshots = normalizeWeeklySnapshots(
    Array.isArray(source.snapshots) ? (source.snapshots as WeeklySnapshot[]) : [],
  );

  const normalized: StoredRosterData = {
    ...source,
    rosters,
    previousSave,
    snapshots,
    lastUpdated: normalizeTimestamp(source.lastUpdated),
  };

  if (activeWeekStart) {
    normalized.activeWeekStart = activeWeekStart;
    normalized.activeWeekId = activeWeekStart;
  } else {
    delete normalized.activeWeekStart;
    delete normalized.activeWeekId;
  }

  if (previousSaveWeekStart) {
    normalized.previousSaveWeekStart = previousSaveWeekStart;
    normalized.previousSaveWeekId = previousSaveWeekStart;
  } else {
    delete normalized.previousSaveWeekStart;
    delete normalized.previousSaveWeekId;
  }

  normalized.activeAllocation = isAllocationMetadata(source.activeAllocation)
    ? clone(source.activeAllocation)
    : null;
  normalized.previousSaveAllocation = isAllocationMetadata(source.previousSaveAllocation)
    ? clone(source.previousSaveAllocation)
    : null;

  return normalized;
}

function getSupabaseConfig(): { url: string; serviceKey: string } {
  const url = (process.env.SUPABASE_URL || '').trim().replace(/\/+$/, '');
  const serviceKey = (process.env.SUPABASE_SERVICE_KEY || '').trim();

  if (!url || !serviceKey) {
    throw new RosterPersistenceError(
      'Roster persistence is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_KEY.',
      'PERSISTENCE_NOT_CONFIGURED',
    );
  }

  return { url, serviceKey };
}

function requestIPv4(url: string, options: HttpRequestOptions = {}): Promise<HttpResponse> {
  return new Promise((resolve, reject) => {
    const urlObject = new URL(url);
    const request = (urlObject.protocol === 'http:' ? http : https).request(
      {
        hostname: urlObject.hostname,
        port: urlObject.port || undefined,
        path: `${urlObject.pathname}${urlObject.search}`,
        method: options.method || 'GET',
        headers: options.headers,
        family: 4,
      },
      (response) => {
        let body = '';
        response.setEncoding('utf8');
        response.on('data', (chunk: string) => {
          body += chunk;
        });
        response.on('end', () => {
          let json: unknown = null;
          if (body) {
            try {
              json = JSON.parse(body) as unknown;
            } catch {
              // The caller still receives the raw body for useful diagnostics.
            }
          }

          const status = response.statusCode || 500;
          resolve({
            ok: status >= 200 && status < 300,
            status,
            body,
            json,
          });
        });
      },
    );

    request.setTimeout(REQUEST_TIMEOUT_MS, () => {
      request.destroy(new Error('Supabase request timed out.'));
    });
    request.on('error', reject);
    if (options.body) request.write(options.body);
    request.end();
  });
}

function responseExcerpt(body: string): string {
  return body.replace(/\s+/g, ' ').trim().slice(0, 300) || 'No response body';
}

export async function loadRosterData(): Promise<StoredRosterData> {
  const { url, serviceKey } = getSupabaseConfig();
  let response: HttpResponse;

  try {
    response = await requestIPv4(`${url}/rest/v1/rosters_data?id=eq.1&select=data`, {
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
      },
    });
  } catch (error) {
    throw new RosterPersistenceError(
      `Could not reach roster persistence: ${error instanceof Error ? error.message : 'Unknown error'}`,
      'PERSISTENCE_UNAVAILABLE',
    );
  }

  if (!response.ok) {
    throw new RosterPersistenceError(
      `Roster persistence returned ${response.status}: ${responseExcerpt(response.body)}`,
      'PERSISTENCE_UNAVAILABLE',
    );
  }

  if (!Array.isArray(response.json)) {
    throw new RosterPersistenceError(
      'Roster persistence returned an invalid response.',
      'PERSISTENCE_INVALID_RESPONSE',
    );
  }

  const firstRow = response.json[0];
  if (!isRecord(firstRow) || !('data' in firstRow)) {
    return createDefaultRosterData();
  }

  return normalizeStoredRosterData(firstRow.data);
}

export async function saveRosterData(value: StoredRosterData): Promise<StoredRosterData> {
  const { url, serviceKey } = getSupabaseConfig();
  const normalized = normalizeStoredRosterData({
    ...value,
    lastUpdated: new Date().toISOString(),
  });
  let response: HttpResponse;

  try {
    response = await requestIPv4(`${url}/rest/v1/rosters_data?on_conflict=id`, {
      method: 'POST',
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify({
        id: 1,
        data: normalized,
        updated_at: normalized.lastUpdated,
      }),
    });
  } catch (error) {
    throw new RosterPersistenceError(
      `Could not write roster persistence: ${error instanceof Error ? error.message : 'Unknown error'}`,
      'PERSISTENCE_UNAVAILABLE',
    );
  }

  if (!response.ok) {
    throw new RosterPersistenceError(
      `Roster persistence write returned ${response.status}: ${responseExcerpt(response.body)}`,
      'PERSISTENCE_UNAVAILABLE',
    );
  }

  return normalized;
}

export function isRosterPersistenceError(error: unknown): error is RosterPersistenceError {
  return error instanceof RosterPersistenceError;
}
