const dotenvConfig = require('dotenv').config
const resolvePath = require("path").resolve

dotenvConfig({path: resolvePath(__dirname, "./tests/.env")});
/* global jest */
jest.setTimeout(10000)
