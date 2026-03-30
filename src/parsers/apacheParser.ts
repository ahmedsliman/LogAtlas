import { LogEntry } from '../types';
import { parseNginxAccess, detectScore as nginxDetectScore } from './nginxParser';

export function parseApacheAccess(content: string): LogEntry[] {
  return parseNginxAccess(content).map(e => ({ ...e, format: 'apache-access' as const }));
}

export function detectScore(sample: string[]): number {
  return nginxDetectScore(sample);
}
