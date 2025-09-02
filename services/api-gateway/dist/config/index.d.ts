export interface Config {
    port: number;
    nodeEnv: string;
    corsOrigins: string[];
    jwtSecret: string;
    redisUrl: string;
    rateLimiting: {
        windowMs: number;
        max: number;
    };
    logging: {
        level: string;
        format: string;
    };
}
export declare const config: Config;
//# sourceMappingURL=index.d.ts.map