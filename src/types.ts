export type LogLevel =
  | 'ERROR'
  | 'WARNING'
  | 'INFO'
  | 'DEBUG'
  | 'NOTICE'
  | 'CRITICAL'
  | 'UNKNOWN';

export type LogFormat =
  | 'laravel'
  | 'nginx-access'
  | 'nginx-error'
  | 'apache-access'
  | 'apache-error'
  | 'unknown';

export interface LogEntry {
  id: number;
  raw: string;
  timestamp: string | null;
  level: LogLevel;
  message: string;
  context?: string;
  ip?: string;
  method?: string;
  url?: string;
  statusCode?: number;
  format: LogFormat;
  lineNumber: number;
}
