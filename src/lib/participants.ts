export function normalizeParticipantName(value: unknown): string | null {
  if (typeof value !== 'string') return null;

  const name = value.trim().replace(/\s+/g, ' ');
  if (!name || name.length > 80 || name.includes('&') || name.toLowerCase() === 'general') {
    return null;
  }
  return name;
}

export function getFallbackParticipantId(name: string): string {
  return `default:${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
}
