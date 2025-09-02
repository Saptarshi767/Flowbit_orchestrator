// Test setup file
import { config } from '../config';

// Override config for testing
config.jwtSecret = 'test-secret';
config.redisUrl = 'redis://localhost:6379';
config.corsOrigins = ['http://localhost:3000'];

// Suppress console logs during tests
if (process.env.NODE_ENV === 'test') {
  console.log = jest.fn();
  console.error = jest.fn();
  console.warn = jest.fn();
}