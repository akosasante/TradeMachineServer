import { Server } from "http";
import startServer from "./bootstrap/app";
import { setupScheduledEspnUpdates } from "./scheduled_jobs/espnScheduledUpdate";
import { setupScheduledMlbMinorLeagueUpdates } from "./scheduled_jobs/mlbMinorsScheduledUpdate";
import { setupEmailConsumers } from "./email/consumers";
import { setupSlackConsumers } from "./slack/consumers";

const server: Promise<Server> = startServer();
setupScheduledEspnUpdates();
setupScheduledMlbMinorLeagueUpdates();
setupEmailConsumers();
setupSlackConsumers();

export default server;
