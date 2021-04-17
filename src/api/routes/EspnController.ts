import { Authorized, Get, JsonController, QueryParam } from "routing-controllers";
import logger from "../../bootstrap/logger";
import EspnAPI, { EspnFantasyTeam, EspnLeagueMember } from "../../espn/espnApi";
import { Role } from "../../models/user";
import { rollbar } from "../../bootstrap/rollbar";

@JsonController("/espn")
export default class EspnController {
    private readonly api: EspnAPI;
    private FFLeagueId: number = 545;

    constructor(api?: EspnAPI) {
        this.api = api || new EspnAPI(this.FFLeagueId);
    }

    @Authorized(Role.ADMIN)
    @Get("/members")
    public async getAllEspnMembers(@QueryParam("year") year?: number): Promise<EspnLeagueMember[]> {
        rollbar.info("getAllEspnMembers", {year});
        logger.debug("get all ESPN members endpoint");
        const members = await this.api.getAllMembers(year || new Date().getFullYear());
        logger.debug(`got ${members.length} members`);
        return members;
    }

    @Authorized(Role.ADMIN)
    @Get("/teams")
    public async getAllEspnTeams(@QueryParam("year") year?: number): Promise<EspnFantasyTeam[]> {
        rollbar.info("getAllEspnTeams", {year});
        logger.debug("get all ESPN teams endpoint");
        const teams = await this.api.getAllLeagueTeams(year || new Date().getFullYear());
        logger.debug(`got ${teams.length} teams`);
        return teams;
    }
}
