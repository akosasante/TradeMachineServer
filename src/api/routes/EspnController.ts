import { Authorized, Get, JsonController, QueryParam, Req } from "routing-controllers";
import logger from "../../bootstrap/logger";
import EspnAPI, { EspnFantasyTeam, EspnLeagueMember } from "../../espn/espnApi";
import { Role } from "../../models/user";
import { rollbar } from "../../bootstrap/rollbar";
import { Request } from "express";

/**
 * Returns a sensible default year for ESPN fantasy baseball API calls.
 * If we're before April (when MLB season typically starts), use the previous year
 * since the current year's fantasy season likely doesn't exist yet on ESPN.
 *
 * @param now - Optional Date for testing purposes
 */
export function getDefaultEspnYear(now: Date = new Date()): number {
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth(); // 0-indexed: Jan=0, Feb=1, Mar=2, Apr=3
    // MLB season typically starts in late March/early April
    // Use previous year if we're in Jan, Feb, or March (months 0, 1, 2)
    return currentMonth < 3 ? currentYear - 1 : currentYear;
}

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
        const effectiveYear = year || getDefaultEspnYear();
        rollbar.info("getAllEspnMembers", { year: effectiveYear }, request);
        logger.debug(`get all ESPN members endpoint (year=${effectiveYear})`);
        const members = await this.api.getAllMembers(effectiveYear);
        logger.debug(`got ${members.length} members`);
        return members;
    }

    @Authorized(Role.ADMIN)
    @Get("/teams")
    public async getAllEspnTeams(
        @QueryParam("year") year?: number,
        @Req() request?: Request
    ): Promise<EspnFantasyTeam[]> {
        const effectiveYear = year || getDefaultEspnYear();
        rollbar.info("getAllEspnTeams", { year: effectiveYear }, request);
        logger.debug(`get all ESPN teams endpoint (year=${effectiveYear})`);
        const teams = await this.api.getAllLeagueTeams(effectiveYear);
        logger.debug(`got ${teams.length} teams`);
        return teams;
    }
}
