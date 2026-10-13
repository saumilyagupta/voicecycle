import type { SessionReport } from '../../modules/voicecycle-player';

const plays = (count: number): string => `${count} ${count === 1 ? 'play' : 'plays'}`;

const clockTime = (epochMs: number): string => {
  const date = new Date(epochMs);
  return `${date.getHours()}:${date.getMinutes().toString().padStart(2, '0')}`;
};

/**
 * One-line summary of the previous session, so the user can check whether it
 * ran to the end. Null when there is nothing worth showing.
 */
export function describeReport(report: SessionReport | null): { tone: 'info' | 'warning' | 'error'; text: string } | null {
  if (!report || report.status === 'running') return null;
  if (report.status === 'interrupted') {
    return {
      tone: 'warning',
      text:
        `The last session (started ${clockTime(report.startedAt)}) was cut off after ${plays(report.completedRepetitions)}. ` +
        'Android closed the app or the phone restarted. See Battery settings in the README.',
    };
  }
  const ended = report.endedAt ? ` at ${clockTime(report.endedAt)}` : '';
  switch (report.endReason) {
    case 'SESSION_COMPLETE':
      return { tone: 'info', text: `Last session finished${ended} after ${plays(report.completedRepetitions)}.` };
    case 'ERROR':
      return {
        tone: 'error',
        text: `Last session failed${ended} after ${plays(report.completedRepetitions)}: ${report.errorMessage ?? 'unknown error'}`,
      };
    default:
      return { tone: 'info', text: `Last session stopped${ended} after ${plays(report.completedRepetitions)}.` };
  }
}
