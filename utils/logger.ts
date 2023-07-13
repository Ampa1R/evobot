export class Logger {
  constructor(private readonly context: string) {}

  static log(...args: any[]) {
    console.log(`[${new Date().toISOString()}]`, ...args);
  }
  static warn(...args: any[]) {
    console.warn(`[${new Date().toISOString()}]`, ...args);
  }
  static error(...args: any[]) {
    console.error(`[${new Date().toISOString()}]`, ...args);
  }
  static info(...args: any[]) {
    console.info(`[${new Date().toISOString()}]`, ...args);
  }

  log(...args: any[]) {
    console.log(`[${new Date().toISOString()}] [${this.context}]`, ...args);
  }
  warn(...args: any[]) {
    console.warn(`[${new Date().toISOString()}] [${this.context}]`, ...args);
  }
  error(...args: any[]) {
    console.error(`[${new Date().toISOString()}] [${this.context}]`, ...args);
  }
  info(...args: any[]) {
    console.info(`[${new Date().toISOString()}] [${this.context}]`, ...args);
  }
}
