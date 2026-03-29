import { LogEntry, LogLevel } from '../types';

// Combined Log Format — used by both Nginx and Apache access logs
export const COMBINED_LOG_PATTERN =
  /^(\S+) \S+ \S+ \[([^\]]+)\] "(\w+) ([^ "]+)[^"]*" (\d{3}) (\d+|-)/;

function statusToLevel(status: number): LogLevel {
  if (status >= 500) return 'ERROR';
  if (status >= 400) return 'WARNING';
  if (status >= 300) return 'NOTICE';
  return 'INFO';
}

export function parseNginxAccess(content: string): LogEntry[] {
  const lines = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const entries: LogEntry[] = [];
  let id = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    const match = line.match(COMBINED_LOG_PATTERN);
    if (!match) continue;
    const [, ip, timestamp, method, url, statusStr] = match;
    const statusCode = parseInt(statusStr, 10);
    if (isNaN(statusCode)) continue;
    entries.push({
      id: id++,
      raw: line,
      timestamp,
      level: statusToLevel(statusCode),
      message: `${method} ${url} \u2192 ${statusCode}`,
      ip,
      method,
      url,
      statusCode,
      format: 'nginx-access',
      lineNumber: i + 1,
    });
  }
  return entries;
}

export function detectScore(sample: string[]): number {
  return sample.filter(l => COMBINED_LOG_PATTERN.test(l)).length;
}
