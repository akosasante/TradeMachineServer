import app from "./bootstrap/express";
import logger from "./bootstrap/logger";

app.get("/", (req, res) => res.json("Hello World"));
app.listen(app.get("port"), app.get("ip"), () => {
    logger.info(`App is running at //${app.get("ip")}:${app.get("port")} in ${app.get("env")} mode`);
    logger.info("Press CTRL-C to stop\n");
});
