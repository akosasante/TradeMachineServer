import Rollbar from "rollbar";
import { mockDeep } from "jest-mock-extended";

export const rollbar =
    process.env.NODE_ENV === "test"
        ? mockDeep<Rollbar>()
        : new Rollbar({
              accessToken: process.env.ROLLBAR_TOKEN,
              environment: process.env.ORM_CONFIG,
              autoInstrument: process.env.NODE_ENV === "test" ? false : true, // may want to extend this in the future: https://docs.rollbar.com/docs/nodejs#telemetry; turning off for test since it causes too many eventEmitter listeners (memory hog)
              captureEmail: true,
              captureUsername: true,
              captureUncaught: true,
          });
