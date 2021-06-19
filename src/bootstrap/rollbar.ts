import Rollbar from "rollbar";

export const rollbar = new Rollbar({
    accessToken: process.env.ROLLBAR_TOKEN,
    environment: process.env.ORM_CONFIG,
    autoInstrument: true, // may want to extend this in the future: https://docs.rollbar.com/docs/nodejs#telemetry
    captureEmail: true,
    captureUsername: true,
    captureUncaught: true,
});
