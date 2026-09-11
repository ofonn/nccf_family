import { afterEach, describe, expect, it } from 'vitest';
import { loadRosterData } from './rosterDataStore';
import {
  isSupabaseConfigured,
  readSupabaseConfig,
  sanitizeSupabaseUrl,
  sanitizeSupabaseValue,
} from './supabaseEnv';

const originalSupabaseUrl = process.env.SUPABASE_URL;
const originalServiceKey = process.env.SUPABASE_SERVICE_KEY;

afterEach(() => {
  if (originalSupabaseUrl === undefined) delete process.env.SUPABASE_URL;
  else process.env.SUPABASE_URL = originalSupabaseUrl;

  if (originalServiceKey === undefined) delete process.env.SUPABASE_SERVICE_KEY;
  else process.env.SUPABASE_SERVICE_KEY = originalServiceKey;
});

describe('supabase env sanitizing', () => {
  it('leaves clean values untouched', () => {
    expect(sanitizeSupabaseValue('eyJhbGciOiJ9.abc_xyz-123')).toBe('eyJhbGciOiJ9.abc_xyz-123');
    expect(sanitizeSupabaseUrl('https://abcdefgh.supabase.co')).toBe('https://abcdefgh.supabase.co');
  });

  it('strips pasted whitespace, newlines, and trailing slashes', () => {
    expect(sanitizeSupabaseValue('  eyJhbGci\nOiJ9.abc\n')).toBe('eyJhbGciOiJ9.abc');
    expect(sanitizeSupabaseUrl('  https://abcdefgh.supabase.co///\n')).toBe('https://abcdefgh.supabase.co');
  });

  it('strips wrapping quotes from dashboard copy-paste', () => {
    expect(sanitizeSupabaseValue('"eyJhbGciOiJ9.abc"')).toBe('eyJhbGciOiJ9.abc');
    expect(sanitizeSupabaseValue("'eyJhbGciOiJ9.abc'")).toBe('eyJhbGciOiJ9.abc');
    expect(sanitizeSupabaseUrl('"https://abcdefgh.supabase.co"\n')).toBe('https://abcdefgh.supabase.co');
  });

  it('reads sanitized config from the environment', () => {
    process.env.SUPABASE_URL = '  "https://abcdefgh.supabase.co/"\n';
    process.env.SUPABASE_SERVICE_KEY = '"eyJh\nbGciOiJ9"  ';
    expect(readSupabaseConfig()).toEqual({
      url: 'https://abcdefgh.supabase.co',
      serviceKey: 'eyJhbGciOiJ9',
    });
    expect(isSupabaseConfigured()).toBe(true);
  });

  it('treats missing values as unconfigured', () => {
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_KEY;
    expect(isSupabaseConfigured()).toBe(false);
  });
});

describe('corrupted supabase env regression', () => {
  it('never fails with "Invalid character in header content" for pasted values', async () => {
    // Simulates the Vercel env paste that bricked every save: a quoted,
    // multi-line service key. The header must be sanitized before the
    // request, so the failure (unreachable host here) is a connection
    // error, never an invalid-header throw.
    process.env.SUPABASE_URL = 'http://127.0.0.1:9';
    process.env.SUPABASE_SERVICE_KEY = '"eyJh\nbGciOiJ9.abc"  ';
    await expect(loadRosterData()).rejects.toMatchObject({
      code: 'PERSISTENCE_UNAVAILABLE',
    });
    await expect(loadRosterData()).rejects.not.toMatchObject({
      message: expect.stringContaining('Invalid character'),
    });
  });
});
