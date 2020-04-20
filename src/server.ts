import { Server } from "http";
import startServer from "./bootstrap/app";

const server: Promise<Server> = startServer();

export default server;
