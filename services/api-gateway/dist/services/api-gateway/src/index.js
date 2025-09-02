"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const app_1 = require("./app");
const config_1 = require("./config");
const rateLimiter_1 = require("./middleware/rateLimiter");
const logging_1 = require("./middleware/logging");
const startServer = async () => {
    try {
        // Initialize Redis connection for rate limiting
        await (0, rateLimiter_1.initializeRedis)();
        // Create Express app
        const app = (0, app_1.createApp)();
        // Start server
        const server = app.listen(config_1.config.port, () => {
            (0, logging_1.logInfo)(`API Gateway server started`, {
                correlationId: 'startup',
                method: 'GET',
                url: `http://localhost:${config_1.config.port}`,
                ip: 'localhost'
            });
            console.log(`🚀 API Gateway running on port ${config_1.config.port}`);
            console.log(`📊 Environment: ${config_1.config.nodeEnv}`);
            console.log(`🔒 CORS Origins: ${config_1.config.corsOrigins.join(', ')}`);
            console.log(`⚡ Rate Limiting: ${config_1.config.rateLimiting.max} requests per ${config_1.config.rateLimiting.windowMs / 1000}s`);
        });
        // Graceful shutdown handling
        const gracefulShutdown = (signal) => {
            (0, logging_1.logInfo)(`Received ${signal}, shutting down gracefully`, {
                correlationId: 'shutdown',
                method: 'SYSTEM',
                url: '',
                ip: 'localhost'
            });
            server.close(() => {
                (0, logging_1.logInfo)('Server closed successfully', {
                    correlationId: 'shutdown',
                    method: 'SYSTEM',
                    url: '',
                    ip: 'localhost'
                });
                process.exit(0);
            });
            // Force close after 10 seconds
            setTimeout(() => {
                (0, logging_1.logError)(new Error('Forced shutdown after timeout'), {
                    correlationId: 'shutdown',
                    method: 'SYSTEM',
                    url: '',
                    ip: 'localhost'
                });
                process.exit(1);
            }, 10000);
        };
        // Handle shutdown signals
        process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
        process.on('SIGINT', () => gracefulShutdown('SIGINT'));
        // Handle uncaught exceptions
        process.on('uncaughtException', (error) => {
            (0, logging_1.logError)(error, {
                correlationId: 'uncaught-exception',
                method: 'SYSTEM',
                url: '',
                ip: 'localhost'
            });
            process.exit(1);
        });
        // Handle unhandled promise rejections
        process.on('unhandledRejection', (reason, promise) => {
            (0, logging_1.logError)(new Error(`Unhandled Rejection: ${reason}`), {
                correlationId: 'unhandled-rejection',
                method: 'SYSTEM',
                url: '',
                ip: 'localhost'
            });
            process.exit(1);
        });
    }
    catch (error) {
        (0, logging_1.logError)(error, {
            correlationId: 'startup-error',
            method: 'SYSTEM',
            url: '',
            ip: 'localhost'
        });
        process.exit(1);
    }
};
// Start the server
startServer();
//# sourceMappingURL=index.js.map