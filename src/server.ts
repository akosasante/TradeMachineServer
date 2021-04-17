import { Server } from "http";
import startServer from "./bootstrap/app";
import { setupScheduledEspnUpdates } from "./scheduled_jobs/espnScheduledUpdate";

const server: Promise<Server> = startServer();
setupScheduledEspnUpdates();
// setupScheduledMlbMinorLeagueUpdates();

export default server;
