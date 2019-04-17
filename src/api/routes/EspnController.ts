import { Get, JsonController, Param } from "routing-controllers";
import { inspect } from "util";
import logger from "../../bootstrap/logger";
import EspnAPI from "../../espn/espnApi";

@JsonController("/espn")
export default class EspnController {
    private readonly api: EspnAPI;
    private FFLeagueId: number = 545;

    constructor() {
        this.api = new EspnAPI(this.FFLeagueId);
    }

    @Get("/teams/:id([0-9]+)/name")
    public async getTeamName(@Param("id") id: number): Promise<string> {
        logger.debug(`Searching for ESPN team with ID: ${id}`);
        const team = await this.api.loadAndRun(() => this.api.getTeamById(id));
        logger.debug(`Fetched team: ${inspect(team)}`);
        return EspnAPI.getTeamName(team);
    }
}
