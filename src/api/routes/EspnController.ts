import { Authorized, Get, JsonController, QueryParam, Req } from "routing-controllers";
import logger from "../../bootstrap/logger";
import EspnAPI, { EspnFantasyTeam, EspnLeagueMember } from "../../espn/espnApi";
import { Role } from "../../models/user";
import { rollbar } from "../../bootstrap/rollbar";
import { Request } from "express";

@JsonController("/espn")
export default class EspnController {
    private readonly api: EspnAPI;
    private ffLeagueId = 545;

    constructor(api?: EspnAPI) {
        this.api = api || new EspnAPI(this.ffLeagueId);
    }

    @Authorized(Role.ADMIN)
    @Get("/members")
    public async getAllEspnMembers(
        @QueryParam("year") year?: number,
        @Req() request?: Request
    ): Promise<EspnLeagueMember[]> {
        rollbar.info("getAllEspnMembers", { year }, request);
        logger.debug("get all ESPN members endpoint");
        const members = await this.api.getAllMembers(year || new Date().getFullYear());
        logger.debug(`got ${members.length} members`);
        return members;
    }

    @Authorized(Role.ADMIN)
    @Get("/teams")
    public async getAllEspnTeams(
        @QueryParam("year") year?: number,
        @Req() request?: Request
    ): Promise<EspnFantasyTeam[]> {
        rollbar.info("getAllEspnTeams", { year }, request);
        logger.debug(`get all ESPN teams endpoint (year=${year || new Date().getFullYear()})`);
        const teams = await this.api.getAllLeagueTeams(year || new Date().getFullYear());
        logger.debug(`got ${teams.length} teams`);
        return teams;
    }
}
