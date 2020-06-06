import { Server } from "http";
import startServer from "./bootstrap/app";
import { setupScheduledEspnUpdates } from "./jobs/espnScheduledUpdate";
import { setupScheduledMlbMinorLeagueUpdates } from "./jobs/mlbMinorsScheduledUpdate";

const server: Promise<Server> = startServer();
setupScheduledEspnUpdates();
setupScheduledMlbMinorLeagueUpdates();

export default server;
