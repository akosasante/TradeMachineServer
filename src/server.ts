import { Server } from "http";
import startServer from "./bootstrap/app";
import { setupScheduledEspnUpdates } from "./scheduled_jobs/espnScheduledUpdate";
import { setupScheduledMlbMinorLeagueUpdates } from "./scheduled_jobs/mlbMinorsScheduledUpdate";
import { setupEmailConsumers } from "./email/consumers";

const server: Promise<Server> = startServer();
setupScheduledEspnUpdates();
setupScheduledMlbMinorLeagueUpdates();
setupEmailConsumers();

export default server;
