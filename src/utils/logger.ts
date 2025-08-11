import pino from 'pino';
import type { LoggerConfig } from '../types/index.js';

/**
 * Create a configured Pino logger instance
 * @param config Logger configuration options
 * @returns Configured Pino logger
 */
export function createLogger(config: LoggerConfig = {}): pino.Logger {
  const isDevelopment = process.env.NODE_ENV !== 'production';

  const baseConfig: pino.LoggerOptions = {
    level: config.level || (isDevelopment ? 'debug' : 'info'),
    ...(config.destination && { transport: { target: config.destination } }),
  };

  // Configure pretty printing for development
  if (config.pretty !== false && isDevelopment) {
    baseConfig.transport = {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'SYS:standard',
        ignore: 'pid,hostname',
        singleLine: false,
        levelFirst: true,
        messageFormat: '{msg}',
      },
    };
  }

  return pino(baseConfig);
}

// Default logger instance
export const logger = createLogger();

/**
 * Create a child logger with additional context
 * @param parent Parent logger instance
 * @param context Additional context to include in logs
 * @returns Child logger with context
 */
export function createChildLogger(
  parent: pino.Logger,
  context: Record<string, unknown>
): pino.Logger {
  return parent.child(context);
}

/**
 * Log operation timing
 * @param logger Logger instance to use
 * @param operation Operation name
 * @param fn Function to time
 * @returns Function result
 */
export async function logTiming<T>(
  logger: pino.Logger,
  operation: string,
  fn: () => Promise<T>
): Promise<T> {
  const start = performance.now();
  logger.debug(`Starting ${operation}`);

  try {
    const result = await fn();
    const duration = performance.now() - start;
    logger.info({ durationMs: Math.round(duration) }, `Completed ${operation}`);
    return result;
  } catch (error) {
    const duration = performance.now() - start;
    logger.error(
      {
        durationMs: Math.round(duration),
        error: error instanceof Error ? error.message : String(error),
      },
      `Failed ${operation}`
    );
    if (error instanceof Error && error.stack) {
      logger.error({ stack: error.stack }, 'Stack trace');
    }
    throw error;
  }
}
