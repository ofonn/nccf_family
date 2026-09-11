import { describe, expect, it } from 'vitest';
import { DEFAULT_ROSTERS } from './constants';
import { generateFairRoster, reconcileFairRosterMetadata } from './fairRoster';

describe('flexible small-group rosters', () => {
  for (const count of [3, 4, 5]) {
    for (const mode of ['weighted', 'appearances'] as const) {
      it(`generates and reconciles ${count} members in ${mode} mode`, () => {
        const members = Array.from({ length: count }, (_, i) => ({ id: `m${i}`, name: `Member ${i}` }));
        const result = generateFairRoster({ rosters: DEFAULT_ROSTERS, members, mode,
          flexible: true, weekStart: '2026-09-13', seed: 'small-group' });
        expect(result.rosters.glorious_service).toEqual(DEFAULT_ROSTERS.glorious_service);
        for (const row of result.rosters.cooking_roster.rows) {
          const cooks = row.person!.split(' & ');
          expect(new Set(cooks).size).toBe(row.day === 'Sunday' ? 1 : 2);
          expect(cooks.every((name) => members.some((member) => member.name === name))).toBe(true);
          for (const roster of [result.rosters.prayer_roster, result.rosters.cleaning_roster]) {
            expect(roster.rows.filter((duty) => duty.day === row.day).every((duty) => !cooks.includes(duty.person!))).toBe(true);
          }
        }
        if (count < 5) expect(result.metadata.relaxedRules!.length).toBeGreaterThan(0);
        else expect(result.metadata.relaxedRules).toEqual([]);
        const saved = JSON.parse(JSON.stringify(result));
        const reconciled = reconcileFairRosterMetadata({ rosters: saved.rosters, members, mode,
          flexible: saved.metadata.flexible, weekStart: '2026-09-13',
          balancesBefore: saved.metadata.balancesBefore });
        expect(reconciled.rosters).toEqual(result.rosters);
        expect(reconciled.metadata.relaxedRules).toEqual(result.metadata.relaxedRules);
        if (count < 5) expect(() => reconcileFairRosterMetadata({ rosters: saved.rosters,
          members, mode, weekStart: '2026-09-13' })).toThrow();
      });
    }
  }
});
