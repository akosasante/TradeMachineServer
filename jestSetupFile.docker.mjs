const { mockDeep } = require("jest-mock-extended");

// Mock rollbar throughout the tests - avoid importing bootstrap/rollbar which may hang
jest.mock("./src/bootstrap/rollbar", () => ({
    rollbar: mockDeep()
}));

// Add all jest-extended matchers
const matchers = require('jest-extended/all');
expect.extend(matchers);

// For Docker environment, set environment variables directly instead of loading .env files
if (process.env.CONTAINER_ENV === 'docker') {
    // Set essential test environment variables without loading .env files
    process.env.NODE_ENV = 'test';
    process.env.ORM_CONFIG = 'test';
    process.env.PG_SCHEMA = 'test';
    process.env.ENABLE_LOGS = 'true';
    process.env.DB_LOGS = 'false'; // Reduce noise in tests

    // Override Docker defaults for tests
    process.env.REDIS_IP = 'redis';
    process.env.REDIS_PORT = '6379';
    process.env.PG_HOST = 'postgres';
    process.env.PG_PORT = '5432';
    process.env.PG_USER = 'trader_user';
    process.env.PG_PASSWORD = 'dev_password_change_me';
    process.env.PG_DB = 'trade_dn';
    process.env.BASE_DIR = '/app';

    // Most importantly - set the correct DATABASE_URL for tests
    process.env.DATABASE_URL = 'postgresql://trader_user:dev_password_change_me@postgres:5432/trade_dn?schema=test&application_name=tm_server_test';
} else {
    // For local environment, use the original dotenv approach
    const dotenvConfig = require('dotenv').config;
    const resolvePath = require("path").resolve;

    dotenvConfig({path: resolvePath(__dirname, "./tests/.env")});
}