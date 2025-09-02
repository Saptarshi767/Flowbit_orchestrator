"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// Test setup file
const config_1 = require("../config");
// Override config for testing
config_1.config.jwtSecret = 'test-secret';
config_1.config.redisUrl = 'redis://localhost:6379';
config_1.config.corsOrigins = ['http://localhost:3000'];
// Suppress console logs during tests
if (process.env.NODE_ENV === 'test') {
    console.log = jest.fn();
    console.error = jest.fn();
    console.warn = jest.fn();
}
//# sourceMappingURL=setup.js.map