import { Server } from "http";
import startServer from "./bootstrap/app";
import { setupScheduledEspnUpdates } from "./scheduled_jobs/espnScheduledUpdate";

const server: Promise<Server> = startServer();
if (process.env.ORM_CONFIG === 'production') {
  setupScheduledEspnUpdates();
// setupScheduledMlbMinorLeagueUpdates();
}

export default server;
