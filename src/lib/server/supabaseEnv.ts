/**
 * Supabase dashboard copy-paste often smuggles in stray whitespace, newlines,
 * or wrapping quotes around the project URL and service key. A pasted
 * multi-line value breaks every persistence call: Node rejects the `apikey`
 * header with "Invalid character in header content", so roster saves,
 * history, participants, and notices all fail at once.
 *
 * Supabase URLs and keys never legitimately contain whitespace or quotes, so
 * stripping them here is safe and keeps one bad paste from bricking the app.
 */
export function sanitizeSupabaseValue(value: string | undefined): string {
  let cleaned = (value || '').replace(/\s+/g, '');
  if (cleaned.length >= 2) {
    const first = cleaned.charAt(0);
    const last = cleaned.charAt(cleaned.length - 1);
    if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
      cleaned = cleaned.slice(1, -1);
    }
  }
  return cleaned;
}

export function sanitizeSupabaseUrl(value: string | undefined): string {
  return sanitizeSupabaseValue(value).replace(/\/+$/, '');
}

export interface SupabaseConfig {
  url: string;
  serviceKey: string;
}

/** Reads and sanitizes the Supabase env on every call (test- and deploy-safe). */
export function readSupabaseConfig(): SupabaseConfig {
  return {
    url: sanitizeSupabaseUrl(process.env.SUPABASE_URL),
    serviceKey: sanitizeSupabaseValue(process.env.SUPABASE_SERVICE_KEY),
  };
}

export function isSupabaseConfigured(): boolean {
  const config = readSupabaseConfig();
  return Boolean(config.url && config.serviceKey);
}
