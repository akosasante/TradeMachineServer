const dotenvConfig = require('dotenv').config
const resolvePath = require("path").resolve
const { mockDeep } = require("jest-mock-extended");
const { rollbar } = require("./src/bootstrap/rollbar");
 
// mock rollbar throughout the tests
jest.mock("./src/bootstrap/rollbar");

// add all jest-extended matchers
const matchers = require('jest-extended/all');
expect.extend(matchers);

// Load Docker-specific test env if running in container, otherwise use local
const isDocker = process.env.CONTAINER_ENV === 'docker' || process.env.PG_HOST === 'postgres';
const envPath = isDocker
    ? resolvePath(__dirname, "./tests/.env.docker")
    : resolvePath(__dirname, "./tests/.env");

dotenvConfig({path: envPath});
