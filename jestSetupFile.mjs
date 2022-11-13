const dotenvConfig = require('dotenv').config
const resolvePath = require("path").resolve

// add all jest-extended matchers
const matchers = require('jest-extended/all');
expect.extend(matchers);

dotenvConfig({path: resolvePath(__dirname, "./tests/.env")});
