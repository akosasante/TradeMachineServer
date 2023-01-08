const dotenvConfig = require('dotenv').config
const resolvePath = require("path").resolve
const { mockDeep } = require("jest-mock-extended");
const { rollbar } = require("./src/bootstrap/rollbar");
 
// mock rollbar throughout the tests
jest.mock("./src/bootstrap/rollbar");

// add all jest-extended matchers
const matchers = require('jest-extended/all');
expect.extend(matchers);

dotenvConfig({path: resolvePath(__dirname, "./tests/.env")});
