import { RostersMap, WeeklySnapshot } from '@/lib/types';

export function getISOWeekDetails(d = new Date()) {
  const date = new Date(d.getTime());
  date.setHours(0, 0, 0, 0);

  // Thursday in current week decides the year ISO week
  date.setDate(date.getDate() + 3 - ((date.getDay() + 6) % 7));
  const week1 = new Date(date.getFullYear(), 0, 4);
  const weekNum = 1 + Math.round(((date.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);

  // Find Monday of the current week
  const monday = new Date(d.getTime());
  const day = monday.getDay();
  const diff = monday.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
  monday.setDate(diff);

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const mondayStr = `${monthNames[monday.getMonth()]} ${monday.getDate()}, ${monday.getFullYear()}`;

  return {
    weekId: `${date.getFullYear()}-W${String(weekNum).padStart(2, '0')}`,
    weekLabel: `Week ${weekNum} (Mon, ${mondayStr})`,
    mondayISO: monday.toISOString(),
  };
}

export function processWeeklySnapshots(
  existingSnapshots: WeeklySnapshot[],
  currentRosters: RostersMap
): WeeklySnapshot[] {
  const { weekId, weekLabel } = getISOWeekDetails();

  // Check if snapshot already exists for this week
  const exists = existingSnapshots.some((s) => s.weekId === weekId);
  if (exists) {
    return existingSnapshots;
  }

  // Create new permanent Monday Canon Snapshot
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
