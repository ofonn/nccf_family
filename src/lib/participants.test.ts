import { describe, expect, it } from 'vitest';
import { DEFAULT_PARTICIPANT_NAMES } from './constants';
import { getFallbackParticipantId, normalizeParticipantName } from './participants';

describe('participant helpers', () => {
  it('trims a new member name and collapses extra whitespace', () => {
    expect(normalizeParticipantName('  Ada   Eze  ')).toBe('Ada Eze');
  });

  it('rejects empty, reserved, ambiguous, and oversized names', () => {
    expect(normalizeParticipantName('   ')).toBeNull();
    expect(normalizeParticipantName('GENERAL')).toBeNull();
    expect(normalizeParticipantName('Ada & Eze')).toBeNull();
    expect(normalizeParticipantName('A'.repeat(81))).toBeNull();
    expect(normalizeParticipantName(null)).toBeNull();
  });

  it('gives every fallback member a deterministic unique ID', () => {
    const firstPass = DEFAULT_PARTICIPANT_NAMES.map(getFallbackParticipantId);
    const secondPass = DEFAULT_PARTICIPANT_NAMES.map(getFallbackParticipantId);

    expect(firstPass).toEqual(secondPass);
    expect(new Set(firstPass).size).toBe(DEFAULT_PARTICIPANT_NAMES.length);
  });
});
