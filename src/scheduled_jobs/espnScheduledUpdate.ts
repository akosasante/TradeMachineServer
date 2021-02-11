import Bull from "bull";
import PlayerDAO from "../DAO/PlayerDAO";
import TeamDAO from "../DAO/TeamDAO";
import EspnAPI from "../espn/espnApi";
import logger from "../bootstrap/logger";
import { inspect } from "util";
import { cleanJobForLogging } from "./job_utils";
import { v4 as uuid } from "uuid";
import { rollbar } from "../bootstrap/rollbar";

export function setupScheduledEspnUpdates() {
    const cron = "22 6 * * *"; // daily at 2:22AM ET
    logger.info(`Setting up espn updates to run on schedule: ${cron}`);
    const espnQueue = new Bull("espn_queue", {settings: {maxStalledCount: 0}});
    const JobName = "espn_updates";
    const cleanLoggedData = (_data: any) => "";
    const cleanLoggedReturn = (returnValue: any) => returnValue;

    espnQueue.process(JobName, async () => {
        return await updateEspnData({});
    });
    espnQueue.add(JobName, uuid(), { repeat: { cron } });

    espnQueue.on("error", error => {
        logger.error(`Bull error during setupScheduledEspnUpdates: ${inspect(error)}`);
        rollbar.error("scheduledEspnUpdate error", error);
    });

    espnQueue.on("stalled", job => {
        logger.error(`Bull stalled during setupScheduledEspnUpdates: ${inspect(cleanJobForLogging(job, cleanLoggedReturn, cleanLoggedData))}`);
        rollbar.error("scheduledEspnUpdate stalled", cleanJobForLogging(job, cleanLoggedReturn, cleanLoggedData));
    });

    espnQueue.on("active", job => {
        logger.info(`setupScheduledEspnUpdates Worker job started: ${inspect(cleanJobForLogging(job, cleanLoggedReturn, cleanLoggedData))}`);
    });

    espnQueue.on("completed", (job, _result) => {
        rollbar.info("setupScheduledEspnUpdates Worker completed", cleanJobForLogging(job, cleanLoggedReturn, cleanLoggedData));
        logger.info(`setupScheduledEspnUpdates Worker completed: ${inspect(cleanJobForLogging(job, cleanLoggedReturn, cleanLoggedData))}`);
    });

    espnQueue.on("failed", (job, err) => {
        logger.error(`"setupScheduledEspnUpdates Worker failed: ${inspect(cleanJobForLogging(job, cleanLoggedReturn, cleanLoggedData))}, ${inspect(err)}`);
        rollbar.error("scheduledEspnUpdate failed", err);
    });
}

export interface EspnUpdateDaos {
    playerDao?: PlayerDAO;
    teamDao?: TeamDAO;
    espnApi?: EspnAPI;
}

export async function updateEspnData(deps: EspnUpdateDaos) {
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
