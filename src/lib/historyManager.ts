import { RostersMap, WeeklySnapshot } from '@/lib/types';

export function getSundayWeekDetails(d = new Date()) {
  // Find Sunday of the current week (Sunday = day 0)
  const sunday = new Date(d.getTime());
  const day = sunday.getDay();
  sunday.setDate(sunday.getDate() - day);
  sunday.setHours(0, 0, 0, 0);

  // Compute week number relative to the year's first Sunday
  const yearStart = new Date(sunday.getFullYear(), 0, 1);
  const sundayOffset = (7 - yearStart.getDay()) % 7;
  const firstSunday = new Date(sunday.getFullYear(), 0, 1 + sundayOffset);
  const weekNum = Math.max(1, Math.floor((sunday.getTime() - firstSunday.getTime()) / (7 * 86400000)) + 1);

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const sundayStr = `${monthNames[sunday.getMonth()]} ${sunday.getDate()}, ${sunday.getFullYear()}`;

  return {
    weekId: `${sunday.getFullYear()}-W${String(weekNum).padStart(2, '0')}`,
    weekLabel: `Week ${weekNum} (Sun, ${sundayStr})`,
    sundayISO: sunday.toISOString(),
  };
}

export function processWeeklySnapshots(
  existingSnapshots: WeeklySnapshot[],
  currentRosters: RostersMap
): WeeklySnapshot[] {
  const { weekId, weekLabel } = getSundayWeekDetails();

  // Check if snapshot already exists for this week
  const exists = existingSnapshots.some((s) => s.weekId === weekId);
  if (exists) {
    return existingSnapshots;
  }

  // Automatically lock in Sunday weekly schedule snapshot
  const newSnapshot: WeeklySnapshot = {
    id: `snapshot_${weekId}`,
    weekId,
    weekLabel,
    createdAt: new Date().toISOString(),
    isCanon: true,
    rosters: JSON.parse(JSON.stringify(currentRosters)),
  };

  // Prepend new snapshot (newest first)
  return [newSnapshot, ...existingSnapshots];
}
