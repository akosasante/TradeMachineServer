import {
    Authorized,
    BadRequestError,
    Body,
    BodyParam,
    Delete,
    Get,
    JsonController,
    NotFoundError,
    Param,
    Patch,
    Post,
    Put,
    QueryParam,
    QueryParams,
} from "routing-controllers";
import { inspect } from "util";
import logger from "../../bootstrap/logger";
import TeamDAO from "../../DAO/TeamDAO";
import Team from "../../models/team";
import User, { Role } from "../../models/user";
import { cleanupQuery, UUID_PATTERN } from "../helpers/ApiHelpers";
import { rollbar } from "../../bootstrap/rollbar";

@JsonController("/teams")
export default class TeamController {
    private dao: TeamDAO;

    constructor(dao?: TeamDAO) {
        this.dao = dao || new TeamDAO();
    }

    @Get("/")
    public async getAllTeams(@QueryParam("hasOwners") hasOwners?: string): Promise<Team[]> {
        rollbar.info("getAllTeams", { hasOwners });
        logger.debug("get all teams endpoint" + ` -- ${hasOwners ? "hasOwners: " + hasOwners : ""}`);
        let teams: Team[];
        if (hasOwners && ["true", "false"].includes(hasOwners.toLowerCase())) {
            teams = hasOwners === "true" ? await this.dao.getTeamsWithOwners() : await this.dao.getTeamsWithNoOwners();
        } else if (!hasOwners) {
            teams = await this.dao.getAllTeams();
        } else {
            throw new BadRequestError(`Given parameter (${hasOwners}) for hasOwners queryParam is invalid.`);
        }
        logger.debug(`got ${teams.length} teams`);
        return teams;
    }

    @Get(UUID_PATTERN)
    public async getOneTeam(@Param("id") id: string): Promise<Team> {
        logger.debug("get one team endpoint");
        rollbar.info("getOneTeam", { id });
        const team = await this.dao.getTeamById(id);
        logger.debug(`got team: ${team}`);
        return team;
    }

    @Get("/search")
    public async findTeamsByQuery(@QueryParams() query: Partial<Team>): Promise<Team[]> {
        rollbar.info("findTeamsByQuery", { query });
        logger.debug(`searching for team with props: ${inspect(query)}`);
        const teams = await this.dao.findTeams(cleanupQuery(query as { [key: string]: string }));
        if (teams.length) {
            logger.debug(`got ${teams.length} teams`);
            return teams;
        } else {
            throw new NotFoundError("No teams found matching that query");
        }
    }

    /* Only the league admins can edit/delete/create teams at the moment */

    @Authorized(Role.ADMIN)
    @Post("/")
    public async createTeam(@Body() teamObjs: Partial<Team>[]): Promise<Team[]> {
        logger.debug("create team endpoint");
        rollbar.info("createTeam", { teamObjs });
        const teams = await this.dao.createTeams(teamObjs);
        logger.debug(`created teams: ${inspect(teams)}`);
        return teams;
    }

    @Authorized(Role.ADMIN)
    @Put(UUID_PATTERN)
    public async updateTeam(@Param("id") id: string, @Body() teamObj: Partial<Team>): Promise<Team> {
        logger.debug("update team endpoint");
        rollbar.info("updateTeam", { id, teamObj });
        const team = await this.dao.updateTeam(id, teamObj);
        logger.debug(`updated team: ${team}`);
        return team;
    }

    @Authorized(Role.ADMIN)
    @Delete(UUID_PATTERN)
    public async deleteTeam(@Param("id") id: string): Promise<{ deleteCount: number | null | undefined; id: any }> {
        logger.debug("delete team endpoint");
        rollbar.info("deleteTeam", { id });
        const result = await this.dao.deleteTeam(id);
        logger.debug(`delete successful: ${inspect(result)}`);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unsafe-assignment
        return { deleteCount: result.affected, id: result.raw[0].id };
    }

    @Authorized(Role.ADMIN)
    @Patch(UUID_PATTERN)
    public async updateTeamOwners(
        @Param("id") id: string,
        @BodyParam("add") ownersToAdd: User[],
        @BodyParam("remove") ownersToRemove: User[]
    ): Promise<Team> {
        logger.debug("update team owners endpoint");
        rollbar.info("updateTeamOwners", { id, add: ownersToAdd, remove: ownersToRemove });
        logger.debug(`add: ${inspect((ownersToAdd || []).map((user: User) => new User(user).toString()))}
         remove: ${inspect((ownersToRemove || []).map((user: User) => new User(user).toString()))}`);
        return await this.dao.updateTeamOwners(id, ownersToAdd, ownersToRemove);
    }
}
