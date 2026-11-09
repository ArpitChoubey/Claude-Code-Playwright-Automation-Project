import { config } from '@config';

type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

const LEVELS: Record<LogLevel, number> = { DEBUG: 10, INFO: 20, WARN: 30, ERROR: 40 };

/** Structured logger with a context name and a minimum level set by LOG_LEVEL (default INFO). */
export class Logger {
    constructor(private readonly context: string) {}

    private log(level: LogLevel, message: string, data?: unknown): void {
        const threshold = LEVELS[config.logLevel as LogLevel] ?? LEVELS.INFO;
        if (LEVELS[level] < threshold) return;

        const entry = `[${new Date().toISOString()}] [${level}] [${this.context}] ${message}`;
        const write = level === 'ERROR' ? console.error : level === 'WARN' ? console.warn : console.log;
        if (data === undefined) write(entry);
        else write(entry, JSON.stringify(data));
    }

    debug(message: string, data?: unknown): void { this.log('DEBUG', message, data); }
    info(message: string, data?: unknown): void { this.log('INFO', message, data); }
    warn(message: string, data?: unknown): void { this.log('WARN', message, data); }
    error(message: string, data?: unknown): void { this.log('ERROR', message, data); }
}
