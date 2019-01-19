import { Server } from "http";
import initApp from "./bootstrap/app";
import { redisClient } from "./bootstrap/express";
import logger from "./bootstrap/logger";

const server: Promise<Server> = initApp().then(app => {
    const srv = app.listen(app.get("port"), app.get("ip"), () => {
        logger.info(`App is running at ${app.get("ip")} : ${app.get("port")} in ${app.get("env")} mode`);
        logger.info("Press CTRL-C to stop\n");
    });
    srv.on("close", () => {
        logger.debug("closing server");
        redisClient.quit();
        logger.debug("bye!");
    });
    return srv;
});

export default server;
