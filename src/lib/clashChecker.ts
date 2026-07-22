import { RostersMap, Roster, RosterRow, ClashWarning } from './types';

function parseMinutes(timeStr: string): number | null {
  const match = timeStr.match(/(\d{1,2}):(\d{2})\s*([AP]M)/i);
  if (!match) return null;
  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const period = match[3].toUpperCase();
  if (period === 'PM' && hours < 12) hours += 12;
  if (period === 'AM' && hours === 12) hours = 0;
  return hours * 60 + minutes;
}

function normalizeNames(personStr: string | undefined): string[] {
  if (!personStr) return [];
  return personStr
    .split(/&|,|\band\b/i)
    .map(name => name.trim().toLowerCase())
    .filter(Boolean);
}

interface ScheduledItem {
  rosterTitle: string;
  isCooking: boolean;
  timeStr?: string;
  startMinutes?: number;
  names: string[];
}

export function performClashCheck(rosters: RostersMap): ClashWarning[] {
  const clashes: ClashWarning[] = [];
  const daySchedule: Record<string, ScheduledItem[]> = {};

  // 1. Collect all duty items grouped by Day
  (Object.values(rosters) as Roster[]).forEach((roster) => {
    const isCooking = roster.id === 'cooking_roster';

    roster.rows.forEach((row: RosterRow) => {
      const day = row.day || 'General';

      let names: string[] = [];
      if (isCooking) {
        names = normalizeNames(row.person);
      } else {
        names = normalizeNames(row.person);
      }

      if (names.length === 0) return;

      const timeStr = row.time;
      const startMinutes = timeStr ? parseMinutes(timeStr) ?? undefined : undefined;

      if (!daySchedule[day]) daySchedule[day] = [];

      daySchedule[day].push({
        rosterTitle: roster.title,
        isCooking,
        timeStr,
        startMinutes,
        names
      });
    });
  });

  // 2. Check for overlaps per day (excluding Sunday)
  Object.keys(daySchedule).forEach(day => {
    if (day === 'Sunday') return; // Exempt Sundays

    const items = daySchedule[day];

    for (let i = 0; i < items.length; i++) {
      for (let j = i + 1; j < items.length; j++) {
        const itemA = items[i];
        const itemB = items[j];

        let isOverlap = false;

        // Rule: Anyone cooking cannot hold ANY other duty on that day
        if (itemA.isCooking || itemB.isCooking) {
          isOverlap = true;
        } else {
          // Normal period check (Morning < 12:00 vs Evening >= 12:00)
          const periodA = itemA.startMinutes !== undefined && itemA.startMinutes < 12 * 60 ? 'Morning' : 'Evening';
          const periodB = itemB.startMinutes !== undefined && itemB.startMinutes < 12 * 60 ? 'Morning' : 'Evening';
          isOverlap = periodA === periodB;
        }

        if (isOverlap) {
          // Check for shared names
          const sharedNames = itemA.names.filter(n => itemB.names.includes(n));
          sharedNames.forEach(shared => {
            const formattedName = shared.charAt(0).toUpperCase() + shared.slice(1);
            clashes.push({
              day,
              person: formattedName,
              activityA: { rosterTitle: itemA.rosterTitle, timeStr: itemA.timeStr },
              activityB: { rosterTitle: itemB.rosterTitle, timeStr: itemB.timeStr }
            });
          });
        }
      }
    }
  });

  return clashes;
}
