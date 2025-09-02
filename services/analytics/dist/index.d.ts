import winston from 'winston';
import { AnalyticsService } from './analytics.service';
declare const logger: winston.Logger;
declare const analyticsService: AnalyticsService;
declare const app: import("express-serve-static-core").Express;
export { analyticsService, logger };
export default app;
//# sourceMappingURL=index.d.ts.map