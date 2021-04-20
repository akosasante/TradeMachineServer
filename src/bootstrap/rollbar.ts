import Rollbar from "rollbar";

export const rollbar = new Rollbar({
    accessToken: process.env.ROLLBAR_TOKEN,
    environment: process.env.ORM_CONFIG,
});
