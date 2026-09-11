import 'server-only';

import https from 'https';
import { DEFAULT_PARTICIPANT_NAMES } from '@/lib/constants';
import { getFallbackParticipantId } from '@/lib/participants';
import type { Participant } from '@/lib/types';
import { readSupabaseConfig } from './supabaseEnv';

interface HttpResult {
  ok: boolean;
  status: number;
  body: string;
}

interface ParticipantRow {
  id: string;
  name: string;
}

export class ParticipantsRepositoryError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'ParticipantsRepositoryError';
  }
}

function requestSupabase(url: string, options: { method?: string; body?: string } = {}): Promise<HttpResult> {
  // Read env lazily so pasted-value sanitizing in supabaseEnv always applies.
  const { serviceKey } = readSupabaseConfig();
  return new Promise((resolve, reject) => {
    const target = new URL(url);
    const request = https.request({
      hostname: target.hostname,
      port: target.port || 443,
      path: `${target.pathname}${target.search}`,
      method: options.method || 'GET',
      family: 4,
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
    }, (response) => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', (chunk: string) => {
        body += chunk;
      });
      response.on('end', () => {
        const status = response.statusCode || 500;
        resolve({ ok: status >= 200 && status < 300, status, body });
      });
    });

    request.setTimeout(10_000, () => {
      request.destroy(new Error('Participant database request timed out.'));
    });
    request.on('error', reject);

    if (options.body) request.write(options.body);
    request.end();
  });
}

function parseRows(body: string): ParticipantRow[] {
  let value: unknown;
  try {
    value = JSON.parse(body);
  } catch {
    throw new ParticipantsRepositoryError('Participant database returned an invalid response.', 502);
  }

  if (!Array.isArray(value)) {
    throw new ParticipantsRepositoryError('Participant database returned an invalid response.', 502);
  }

  return value.filter((row): row is ParticipantRow => {
    if (!row || typeof row !== 'object') return false;
    const candidate = row as Record<string, unknown>;
    return typeof candidate.id === 'string' && typeof candidate.name === 'string';
  });
}

function fallbackParticipants(): Participant[] {
  return DEFAULT_PARTICIPANT_NAMES.map((name) => ({
    id: getFallbackParticipantId(name),
    name,
  }));
}

export function isParticipantPersistenceAvailable(): boolean {
  const { url, serviceKey } = readSupabaseConfig();
  return Boolean(url && serviceKey);
}

function participantsBaseUrl(): string {
  return readSupabaseConfig().url;
}

export async function listParticipants(): Promise<Participant[]> {
  if (!isParticipantPersistenceAvailable()) return fallbackParticipants();

  const response = await requestSupabase(
    `${participantsBaseUrl()}/rest/v1/participants?select=id,name&order=name.asc`,
  );
  if (!response.ok) {
    throw new ParticipantsRepositoryError('Unable to load house members.', response.status);
  }

  return parseRows(response.body);
}

export async function createParticipant(name: string): Promise<Participant> {
  if (!isParticipantPersistenceAvailable()) {
    throw new ParticipantsRepositoryError('Database persistence is not configured.', 503);
  }

  const response = await requestSupabase(
    `${participantsBaseUrl()}/rest/v1/participants?select=id,name`,
    { method: 'POST', body: JSON.stringify({ name }) },
  );
  if (!response.ok) {
    const message = response.status === 409
      ? 'That house member already exists.'
      : 'Unable to add the house member.';
    throw new ParticipantsRepositoryError(message, response.status);
  }

  const [participant] = parseRows(response.body);
  if (!participant) {
    throw new ParticipantsRepositoryError('Participant database did not return the new member.', 502);
  }
  return participant;
}

export async function deleteParticipant(id: string): Promise<void> {
  if (!isParticipantPersistenceAvailable()) {
    throw new ParticipantsRepositoryError('Database persistence is not configured.', 503);
  }

  const response = await requestSupabase(
    `${participantsBaseUrl()}/rest/v1/participants?id=eq.${encodeURIComponent(id)}&select=id,name`,
    { method: 'DELETE' },
  );
  if (!response.ok) {
    throw new ParticipantsRepositoryError('Unable to remove the house member.', response.status);
  }

  const deletedRows = parseRows(response.body);
  if (deletedRows.length === 0) {
    throw new ParticipantsRepositoryError('House member not found.', 404);
  }
}
