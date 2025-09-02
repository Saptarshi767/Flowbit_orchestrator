export class Logger {
  private context: string;

  constructor(context: string) {
    this.context = context;
  }

  info(message: string, meta?: any): void {
    console.log(`[${new Date().toISOString()}] [INFO] [${this.context}] ${message}`, meta || '');
  }

  warn(message: string, meta?: any): void {
    console.warn(`[${new Date().toISOString()}] [WARN] [${this.context}] ${message}`, meta || '');
  }

  error(message: string, meta?: any): void {
    console.error(`[${new Date().toISOString()}] [ERROR] [${this.context}] ${message}`, meta || '');
  }

  debug(message: string, meta?: any): void {
    if (process.env.NODE_ENV === 'development') {
      console.debug(`[${new Date().toISOString()}] [DEBUG] [${this.context}] ${message}`, meta || '');
    }
  }
}