import { JsonController, Param, Authorized, Get } from "routing-controllers";
import logger from "../../bootstrap/logger";
import EspnAPI, { EspnFantasyTeam, EspnLeagueMember } from "../../espn/espnApi";
import { Role } from "../../models/user";

@JsonController("/espn")
export default class EspnController {
    private readonly api: EspnAPI;
    private FFLeagueId: number = 545;

    constructor(api?: EspnAPI) {
        this.api = api || new EspnAPI(this.FFLeagueId);
    }

    @Authorized(Role.ADMIN)
    @Get("/members")
    public async getAllEspnMembers(@Param("year") year?: number): Promise<EspnLeagueMember[]> {
        logger.debug("get all ESPN members endpoint");
        const members = await this.api.getAllMembers(year || new Date().getFullYear());
        logger.debug(`got ${members.length} members`);
        return members;
    }

    @Authorized(Role.ADMIN)
    @Get("/teams")
    public async getAllEspnTeams(@Param("year") year?: number): Promise<EspnFantasyTeam[]> {
        logger.debug("get all ESPN teams endpoint");
        const teams = await this.api.getAllLeagueTeams(year || new Date().getFullYear());
        logger.debug(`got ${teams.length} teams`);
        return teams;
    }
}
