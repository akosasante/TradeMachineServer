import { Server } from "http";
import startServer from "./bootstrap/app";
import { setupScheduledEspnUpdates } from "./espn/espnScheduledUpdate";

const server: Promise<Server> = startServer();
setupScheduledEspnUpdates();

export default server;
