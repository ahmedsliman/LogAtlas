import { LogEntry, LogLevel } from '../types';

const LARAVEL_PATTERN = /^\[(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})\] \w+\.(\w+): (.+)$/;

const LEVEL_MAP: Record<string, LogLevel> = {
  emergency: 'CRITICAL',
  alert: 'CRITICAL',
  critical: 'CRITICAL',
  error: 'ERROR',
  warning: 'WARNING',
  notice: 'NOTICE',
  info: 'INFO',
  debug: 'DEBUG',
};

export function parseLaravel(content: string): LogEntry[] {
  const lines = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const entries: LogEntry[] = [];
  let current: LogEntry | null = null;
  let id = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const match = line.match(LARAVEL_PATTERN);

    if (match) {
      if (current) entries.push(current);
      const [, timestamp, levelStr, message] = match;
      current = {
        id: id++,
        raw: line,
        timestamp,
        level: LEVEL_MAP[levelStr.toLowerCase()] ?? 'UNKNOWN',
        message,
        format: 'laravel',
        lineNumber: i + 1,
      };
    } else if (current && line.trim()) {
      current.raw += '\n' + line;
      current.context = (current.context ?? '') + line + '\n';
    }
  }

  if (current) entries.push(current);
  return entries;
}

export function detectScore(sample: string[]): number {
  return sample.filter(l => LARAVEL_PATTERN.test(l)).length;
}
