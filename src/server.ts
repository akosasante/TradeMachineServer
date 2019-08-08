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
        if (process.env.NODE_ENV !== "test") {
            redisClient.quit();
        }
        logger.debug("server says bye!");
    });
    return srv;
})
    .catch(err => {
        logger.error(`fatal error when starting server: ${err}`);
        return process.exit(99);
    });

export default server;
