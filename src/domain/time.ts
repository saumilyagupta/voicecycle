const MS_PER_SECOND = 1000;
const MS_PER_MINUTE = 60 * MS_PER_SECOND;
const MS_PER_HOUR = 60 * MS_PER_MINUTE;

export const minutesToMs = (minutes: number): number => Math.round(minutes * MS_PER_MINUTE);

const pad = (value: number): string => value.toString().padStart(2, '0');

/** Clock format for countdowns: "4:07", "12:30", "1:05:09". Rounds up so a countdown never shows 0:00 early. */
export function formatClock(ms: number, roundUp = false): string {
  const safe = Number.isFinite(ms) && ms > 0 ? ms : 0;
  const totalSeconds = roundUp ? Math.ceil(safe / MS_PER_SECOND) : Math.floor(safe / MS_PER_SECOND);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${minutes}:${pad(seconds)}`;
}

/** Short human duration for settings: "30 s", "10 min", "2 h", "1 h 30 min". */
export function formatMinutes(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes <= 0) return '0 min';
  if (minutes < 1) return `${Math.round(minutes * 60)} s`;
  const seconds = Math.round((minutes % 1) * 60);
  if (minutes < 60 && seconds > 0) return `${Math.floor(minutes)} min ${seconds} s`;
  const totalMinutes = Math.round(minutes);
  const hours = Math.floor(totalMinutes / 60);
  const rest = totalMinutes % 60;
  if (hours === 0) return `${rest} min`;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}

export const msToHours = (ms: number): number => ms / MS_PER_HOUR;
