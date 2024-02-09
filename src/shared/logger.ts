/**
 * Logger interface that implements all log levels.
 * Use the {@link LogLevel} when configuring to change which level to output.
 *
 * All methods should be pre-bound to the logger so they can be called from the level-filtered object.
 */
export interface ILogger {
  debug(...data: any[]): void;
  info(...data: any[]): void;
  warn(...data: any[]): void;
  error(...data: any[]): void;

  group(...label: any[]): void;
  groupEnd(): void;
}

export enum LogLevel {
  debug = 0,
  info = 1,
  warn = 2,
  error = 3,
}

export interface ILogConfig {
  readonly logger: ILogger;
  readonly level: LogLevel;
}

function noopLog() {}
export function buildLeveledLogger({ level, logger }: ILogConfig): ILogger {
  return {
    debug: level <= LogLevel.debug ? logger.debug : noopLog,
    info: level <= LogLevel.info ? logger.info : noopLog,
    warn: level <= LogLevel.warn ? logger.warn : noopLog,
    error: level <= LogLevel.error ? logger.error : noopLog,
    group: logger.group,
    groupEnd: logger.groupEnd,
  };
}
