type LogMeta = Record<string, unknown> | unknown[] | string | number | boolean | null;

const env = process.env.NODE_ENV ?? "development";
const isDev = env !== "production";
const logLevel = (process.env.LOG_LEVEL ?? "info").toLowerCase();

const levelPriority: Record<string, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

function shouldLog(level: keyof typeof levelPriority): boolean {
  const configured = levelPriority[logLevel] ?? levelPriority.info;
  if (isDev && level === "debug") return true;
  return levelPriority[level] >= configured;
}

function line(level: string, scope: string, message: string, meta?: LogMeta): string {
  const timestamp = new Date().toISOString();
  if (meta === undefined) return `[${timestamp}] [${level}] [${scope}] ${message}`;
  return `[${timestamp}] [${level}] [${scope}] ${message} ${JSON.stringify(meta)}`;
}

export const logger = {
  debug(scope: string, message: string, meta?: LogMeta): void {
    if (!shouldLog("debug")) return;
    console.debug(line("DEBUG", scope, message, meta));
  },
  info(scope: string, message: string, meta?: LogMeta): void {
    if (!shouldLog("info")) return;
    console.info(line("INFO", scope, message, meta));
  },
  warn(scope: string, message: string, meta?: LogMeta): void {
    if (!shouldLog("warn")) return;
    console.warn(line("WARN", scope, message, meta));
  },
  error(scope: string, message: string, meta?: LogMeta): void {
    if (!shouldLog("error")) return;
    console.error(line("ERROR", scope, message, meta));
  },
};
