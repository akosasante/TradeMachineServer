// Minimal Jest config to bypass potential setup issues
module.exports = {
    preset: "ts-jest",
    testEnvironment: "node",
    roots: ["<rootDir>/src/", "<rootDir>/tests"],
    testMatch: ["**/__tests__/**/*.ts?(x)", "**/?(*.)+(spec|test).ts?(x)"],
    transform: {
        "^.+\\.ts?$": ["ts-jest", { tsconfig: "tests/tsconfig.json" }],
    },
    moduleNameMapper: {
        "^@/(.*)$": "<rootDir>/src/$1",
    },
    verbose: true,
    bail: true,
    forceExit: true,
    detectOpenHandles: true,
    testTimeout: 10000,
    setupFilesAfterEnv: ["jest-extended/all", "jest-date-mock", "./jestSetupFile.docker.mjs"],
};
