// Docker-optimized Jest config
module.exports = {
    preset: "ts-jest",
    testEnvironment: "node",

    // Coverage
    collectCoverage: true,
    coverageDirectory: "./tests/coverage",
    coveragePathIgnorePatterns: [
        "\\\\node_modules\\\\",
        "<rootDir>/dist/",
        "<rootDir>/declarations/",
        "<rootDir>/src/db/",
        "<rootDir>/src/bootstrap/db.ts",
        "<rootDir>/src/bootstrap/logger.ts",
        "<rootDir>/src/api/middlewares/",
        "<rootDir>/tests/unit/mocks/",
    ],
    coverageReporters: ["json", "text", "lcov", "clover"],

    // File patterns
    roots: ["<rootDir>/src/", "<rootDir>/tests"],
    testMatch: ["**/__tests__/**/*.ts?(x)", "**/?(*.)+(spec|test).ts?(x)"],
    moduleFileExtensions: ["js", "json", "ts", "node"],

    // Module resolution
    moduleNameMapper: {
        "^@/(.*)$": "<rootDir>/src/$1",
    },

    // Performance optimizations for Docker
    maxWorkers: 1, // Run tests serially to avoid resource contention
    cache: false, // Disable cache to avoid cross-container issues

    // Setup
    setupFilesAfterEnv: ["jest-extended/all", "jest-date-mock", "./jestSetupFile.docker.mjs"],

    // Transform
    transform: {
        "^.+\\.ts?$": ["ts-jest", { tsconfig: "tests/tsconfig.json" }],
    },

    // Timeouts and behavior
    testTimeout: 25000,
    verbose: true,
    bail: true,
    forceExit: true,
    detectOpenHandles: true,
    notify: false, // Disable notifications in container
};
