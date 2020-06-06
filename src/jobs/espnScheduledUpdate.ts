import Bull from "bull";
import PlayerDAO from "../DAO/PlayerDAO";
import TeamDAO from "../DAO/TeamDAO";
import EspnAPI from "../espn/espnApi";
import logger from "../bootstrap/logger";
import { inspect } from "util";

export function setupScheduledEspnUpdates() {
    const cron = "22 6 * * *"; // daily at 2:22AM ET
    logger.info(`Setting up espn updates to run on schedule: ${cron}`);
    const espnQueue = new Bull("espn_queue");

    espnQueue.process(1, async () => {
        return await updateEspnData({});
    });
    espnQueue.add({}, {repeat: { cron }});

    espnQueue.on("error", error => {
        logger.debug(`Bull error during setupScheduledEspnUpdates: ${inspect(error)}`);
    });

    espnQueue.on("active", job => {
        logger.debug(`setupScheduledEspnUpdates Worker job started: ${inspect(job)}`);
    });

    espnQueue.on("completed", (job, result) => {
        logger.debug(`setupScheduledEspnUpdates Worker completed: ${inspect(job)}`);
    });

    espnQueue.on("failed", (job, err) => {
        logger.debug(`"setupScheduledEspnUpdates Worker failed: ${inspect(job)}, ${inspect(err)}`);
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
    await espnApi.updateMajorLeaguePlayers(currentYear, playerDao);
    logger.debug("player reload complete");
    return `updated @ ${new Date().toLocaleString()}`;
}
