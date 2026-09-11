import { describe, expect, it } from 'vitest';
import { DEFAULT_ROSTERS } from './constants';
import { performClashCheck } from './clashChecker';

describe('performClashCheck', () => {
  it('checks Sunday cleaning against cooking while exempting Glorious Service', () => {
    const rosters = structuredClone(DEFAULT_ROSTERS);
    rosters.cleaning_roster.rows[0].person = 'Ada';
    rosters.cooking_roster.rows[0].person = 'Ada';
    rosters.glorious_service.rows[0].person = 'Ada';

    const sundayClashes = performClashCheck(rosters).filter((clash) => clash.day === 'Sunday');

    expect(sundayClashes).toHaveLength(1);
    expect(sundayClashes[0].person).toBe('Ada');
    expect([
      sundayClashes[0].activityA.rosterTitle,
      sundayClashes[0].activityB.rosterTitle,
    ].sort()).toEqual(['Cleaning Roster', 'Cooking Roster']);
  });

  it('does not include Glorious Service in generated-work clashes', () => {
    const rosters = structuredClone(DEFAULT_ROSTERS);
    rosters.glorious_service.rows.forEach((row) => {
      row.person = 'Same Person';
    });
    rosters.cleaning_roster.rows.forEach((row) => {
      row.person = '';
    });
    rosters.cooking_roster.rows.forEach((row) => {
      row.person = '';
    });
    rosters.prayer_roster.rows.forEach((row) => {
      row.person = '';
    });

    expect(performClashCheck(rosters)).toEqual([]);
  });
});
