type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  requestId?: string;
  userId?: string;
  msg: string;
  /** additional structured fields */
  [key: string]: unknown;
}

const isDev = process.env.NODE_ENV === 'development';

function write(level: LogLevel, msg: string, fields?: Record<string, unknown>): void {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    msg,
    ...fields,
  };
  const line = JSON.stringify(entry);
  if (level === 'error') {
    console.error(line);
  } else if (level === 'warn') {
    console.warn(line);
  } else if (isDev) {
    console.log(line);
  } else {
    process.stdout.write(line + '\n');
  }
}

export const logger = {
  debug: (msg: string, fields?: Record<string, unknown>) => write('debug', msg, fields),
  info:  (msg: string, fields?: Record<string, unknown>) => write('info',  msg, fields),
  warn:  (msg: string, fields?: Record<string, unknown>) => write('warn',  msg, fields),
  error: (msg: string, fields?: Record<string, unknown>) => write('error', msg, fields),

  /** returns a child logger with pre-bound requestId and optional userId */
  child: (ctx: { requestId: string; userId?: string }) => ({
    debug: (msg: string, fields?: Record<string, unknown>) => write('debug', msg, { ...ctx, ...fields }),
    info:  (msg: string, fields?: Record<string, unknown>) => write('info',  msg, { ...ctx, ...fields }),
    warn:  (msg: string, fields?: Record<string, unknown>) => write('warn',  msg, { ...ctx, ...fields }),
    error: (msg: string, fields?: Record<string, unknown>) => write('error', msg, { ...ctx, ...fields }),
  }),
};
