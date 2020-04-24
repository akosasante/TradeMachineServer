import Bull from "bull";
import PlayerDAO from "../DAO/PlayerDAO";
import TeamDAO from "../DAO/TeamDAO";
import EspnAPI, { EspnFantasyTeam } from "./espnApi";
import Player from "../models/player";
import logger from "../bootstrap/logger";

export function setupScheduledEspnUpdates() {
    const cron = "22 6 * * *"; // daily at 2:22AM ET
    logger.info(`Setting up espn updates to run on schedule: ${cron}`);
    const espnQueue = new Bull("espn_queue");

    espnQueue.process(1, async () => {
        return updateEspnData({});
    });
    espnQueue.add({}, {repeat: { cron }});
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

    await updateTeamInfo(currentYear, teamDao, espnApi);
    logger.debug("team reload complete");
    await updateMajorLeaguePlayers(currentYear, playerDao, espnApi);
    logger.debug("player reload complete");
    return `updated @ ${new Date().toLocaleString()}`;
}

async function updateMajorLeaguePlayers(year: number, playerDao: PlayerDAO, espnApi: EspnAPI) {
    logger.debug("reloading ESPN major league players");
    const allEspnPlayers = await espnApi.getAllMajorLeaguePlayers(year);
    logger.debug("got all espn players");
    const allPlayers = allEspnPlayers.map(player => Player.convertEspnMajorLeaguerToPlayer(player));
    logger.debug("batch save to db");
    return await playerDao.batchCreatePlayers(allPlayers);
}

async function updateTeamInfo(year: number, teamDao: TeamDAO, espnApi: EspnAPI) {
    logger.debug("reloading ESPN league team objects");
    const allEspnTeams = await espnApi.getAllLeagueTeams(year);
    logger.debug("got all espn fantasy teams");
    const allLeagueTeams = await teamDao.getAllTeams();
    for (const team of allLeagueTeams) {
        const associatedEspnTeam = allEspnTeams.find((foundEspnTeam: EspnFantasyTeam) =>
            foundEspnTeam.id === team.espnId
        );

        if (associatedEspnTeam) {
            await teamDao.updateTeam(team.id!, {espnTeam: associatedEspnTeam});
        }
    }
}
