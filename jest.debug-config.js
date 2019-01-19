const defaultConfig = require("./jest.config");

module.exports = {
    ...defaultConfig,
    collectCoverage: false,
    notify: false,
    verbose: false,
};
