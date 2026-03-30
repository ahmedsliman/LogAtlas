import { LogEntry, LogFormat } from '../types';
import { parseLaravel, detectScore as laravelScore } from './laravelParser';
import { parseNginxAccess, detectScore as nginxScore } from './nginxParser';
import { parseApacheAccess, detectScore as apacheScore } from './apacheParser';

export function detectFormat(lines: string[]): LogFormat {
  const sample = lines.slice(0, 20);
  const scores: Array<[LogFormat, number]> = [
    ['laravel', laravelScore(sample)],
    ['nginx-access', nginxScore(sample)],
    ['apache-access', apacheScore(sample)],
  ];
  scores.sort((a, b) => b[1] - a[1]);
  if (scores[0][1] === 0) return 'unknown';

  // nginx-access and apache-access share the same regex — always prefer nginx-access on a tie
  if (
    scores[0][0] === 'apache-access' &&
    scores.find(s => s[0] === 'nginx-access')?.[1] === scores[0][1]
  ) {
    return 'nginx-access';
  }

  return scores[0][0];
}

export function parseLog(
  content: string,
  format?: LogFormat
): { entries: LogEntry[]; format: LogFormat } {
  const lines = content.split('\n');
  const detected: LogFormat = format ?? detectFormat(lines);

  switch (detected) {
    case 'laravel':
      return { entries: parseLaravel(content), format: 'laravel' };
    case 'nginx-access':
      return { entries: parseNginxAccess(content), format: 'nginx-access' };
    case 'apache-access':
      return { entries: parseApacheAccess(content), format: 'apache-access' };
    case 'nginx-error':
      return { entries: [], format: 'nginx-error' };
    case 'apache-error':
      return { entries: [], format: 'apache-error' };
    default:
      return { entries: parseLaravel(content), format: 'unknown' };
  }
}
