import Bull from "bull";
import PlayerDAO from "../DAO/PlayerDAO";
import TeamDAO from "../DAO/TeamDAO";
import EspnAPI from "../espn/espnApi";
import logger from "../bootstrap/logger";
import { inspect } from "util";
import { cleanJobForLogging } from "./job_utils";
import { v4 as uuid } from "uuid";
import { rollbar } from "../bootstrap/rollbar";
import { recordJobMetrics } from "./metrics";

export function setupScheduledEspnUpdates(): void {
    const cron = "22 6 * * *"; // daily at 2:22AM ET
    logger.info(`Setting up espn updates to run on schedule: ${cron}`);
    const queueName = process.env.ORM_CONFIG === "staging" ? "stg_espn_queue" : "espn_queue"; // TODO: Should this also have a conditional for test env?
    const espnQueue = new Bull(queueName, { redis: { password: process.env.REDISPASS },  settings: { maxStalledCount: 0 } });
    // eslint-disable-next-line @typescript-eslint/naming-convention
    const JobName = "espn_updates";
    const cleanLoggedData = (_data: any) => "";
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    const cleanLoggedReturn = (returnValue: any) => returnValue;

    void espnQueue.process(JobName, async () => {
        return await updateEspnData({});
    });
    void espnQueue.add(JobName, uuid(), { repeat: { cron } });

    espnQueue.on("error", error => {
        logger.error(`Bull error during setupScheduledEspnUpdates: ${inspect(error)}`);
        rollbar.error("scheduledEspnUpdate error", error);
    });

    espnQueue.on("stalled", job => {
        logger.error(
            `Bull stalled during setupScheduledEspnUpdates: ${inspect(
                cleanJobForLogging(job, cleanLoggedReturn, cleanLoggedData)
            )}`
        );
        rollbar.error("scheduledEspnUpdate stalled", cleanJobForLogging(job, cleanLoggedReturn, cleanLoggedData));
    });

    espnQueue.on("active", job => {
        logger.info(
            `setupScheduledEspnUpdates Worker job started: ${inspect(
                cleanJobForLogging(job, cleanLoggedReturn, cleanLoggedData)
            )}`
        );
    });

    espnQueue.on("completed", (job, _result) => {
        rollbar.info(
            "setupScheduledEspnUpdates Worker completed",
            cleanJobForLogging(job, cleanLoggedReturn, cleanLoggedData)
        );
        logger.info(
            `setupScheduledEspnUpdates Worker completed: ${inspect(
                cleanJobForLogging(job, cleanLoggedReturn, cleanLoggedData)
            )}`
        );
    });

    espnQueue.on("failed", (job, err) => {
        logger.error(
            `"setupScheduledEspnUpdates Worker failed: ${inspect(
                cleanJobForLogging(job, cleanLoggedReturn, cleanLoggedData)
            )}, ${inspect(err)}`
        );
        rollbar.error("scheduledEspnUpdate failed", err);
    });

    recordJobMetrics(espnQueue);
    logger.info(`setupScheduledEspnUpdates complete for queue: ${queueName}`);
}

export interface EspnUpdateDaos {
    playerDao?: PlayerDAO;
    teamDao?: TeamDAO;
    espnApi?: EspnAPI;
}

export async function updateEspnData(deps: EspnUpdateDaos): Promise<string> {
    const playerDao = deps.playerDao || new PlayerDAO();
    const teamDao = deps.teamDao || new TeamDAO();
    const espnApi = deps.espnApi || new EspnAPI(545);
    const currentYear = new Date().getFullYear();

    await espnApi.updateEspnTeamInfo(currentYear, teamDao);
    logger.debug("team reload complete");
    await espnApi.updateMajorLeaguePlayers(currentYear, playerDao, teamDao);
    logger.debug("player reload complete");
    return `updated @ ${new Date().toLocaleString()}`;
}
