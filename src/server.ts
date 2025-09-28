// MUST be first import to instrument other modules
import { initializeTelemetry } from "./bootstrap/telemetry";

// Initialize telemetry early
initializeTelemetry();

import "reflect-metadata";
import { Server } from "http";
import startServer from "./bootstrap/app";

const server: Promise<Server> = startServer();
if (process.env.ORM_CONFIG === "production") {
    // setupScheduledEspnUpdates();
    // setupScheduledMlbMinorLeagueUpdates();
}

export default server;
