type LogLevel = 'info' | 'warn' | 'error';

function log(level: LogLevel, message: string, meta?: any) {
  const timestamp = new Date().toISOString();
  const payload = meta ? { ...meta } : undefined;
  // eslint-disable-next-line no-console
  console[level](`${timestamp} [${level.toUpperCase()}] ${message}`, payload || '');
}

export const logger = {
  info: (message: string, meta?: any) => log('info', message, meta),
  warn: (message: string, meta?: any) => log('warn', message, meta),
  error: (message: string, meta?: any) => log('error', message, meta),
};

export default logger;
