import { LogLevel } from '@nestjs/common';

const DEFAULT_LEVELS: LogLevel[] = ['log', 'error', 'warn'];
const ALLOWED_LEVELS: LogLevel[] = ['log', 'error', 'warn', 'debug', 'verbose'];

export function parseLogLevels(raw?: string | null): LogLevel[] {
  if (!raw) return DEFAULT_LEVELS;

  const levels = raw
    .split(',')
    .map((level) => level.trim().toLowerCase())
    .filter((level) => ALLOWED_LEVELS.includes(level as LogLevel)) as LogLevel[];

  return levels.length > 0 ? levels : DEFAULT_LEVELS;
}
