import { Team } from "@akosasante/trade-machine-models";
import {
    Authorized,
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
    QueryParams
} from "routing-controllers";
import { inspect } from "util";
import logger from "../../bootstrap/logger";
import TeamDAO from "../../DAO/TeamDAO";
import TeamDO from "../../models/team";
import UserDO, { Role } from "../../models/user";
import { cleanupQuery, UUIDPattern } from "../helpers/ApiHelpers";

@JsonController("/teams")
export default class TeamController {
    private dao: TeamDAO;

    constructor(DAO?: TeamDAO) {
        this.dao = DAO || new TeamDAO();
    }

    @Get("/")
    public async getAllTeams(@QueryParam("hasOwners") hasOwners?: "true"|"false"): Promise<Team[]> {
        logger.debug("get all teams endpoint" + ` -- ${hasOwners ? ("hasOwners: " + hasOwners ) : ""}`);
        const teams = hasOwners ?
            await this.dao.getTeamsByOwnerStatus(hasOwners === "true") :
            await this.dao.getAllTeams();
        logger.debug(`got ${teams.length} teams`);
        return teams;
    }

    @Get(UUIDPattern)
    public async getOneTeam(@Param("id") id: string): Promise<Team> {
        logger.debug("get one team endpoint");
        const team = await this.dao.getTeamById(id);
        logger.debug(`got team: ${team}`);
        return team;
    }

    @Get("/search")
    public async findTeamsByQuery(@QueryParams() query: Partial<TeamDO>): Promise<Team[]> {
        logger.debug(`searching for team with props: ${inspect(query)}`);
        const teams = await this.dao.findTeams(cleanupQuery(query as {[key: string]: string}));
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
    public async createTeam(@Body() teamObjs: Array<Partial<TeamDO>>): Promise<Team[]> {
        logger.debug("create team endpoint");
        const teams = await this.dao.createTeams(teamObjs);
        logger.debug(`created teams: ${inspect(teams)}`);
        return teams;
    }

    @Authorized(Role.ADMIN)
    @Put(UUIDPattern)
    public async updateTeam(@Param("id") id: string, @Body() teamObj: Partial<TeamDO>): Promise<Team> {
        logger.debug("update team endpoint");
        const team = await this.dao.updateTeam(id, teamObj);
        logger.debug(`updated team: ${team}`);
        return team;
    }

    @Authorized(Role.ADMIN)
    @Delete(UUIDPattern)
    public async deleteTeam(@Param("id") id: string) {
        logger.debug("delete team endpoint");
        const result = await this.dao.deleteTeam(id);
        logger.debug(`delete successful: ${inspect(result)}`);
        return {deleteCount: result.affected, id: result.raw[0].id};
    }

    @Authorized(Role.ADMIN)
    @Patch(UUIDPattern)
    public async updateTeamOwners(@Param("id") id: string,
                                  @BodyParam("add") ownersToAdd: UserDO[],
                                  @BodyParam("remove") ownersToRemove: UserDO[]): Promise<Team> {
        logger.debug("update team owners endpoint");
        logger.debug(`add: ${inspect((ownersToAdd || []).map((user: UserDO) => new UserDO(user).toString()))}
         remove: ${inspect((ownersToRemove || []).map((user: UserDO) => new UserDO(user).toString()))}`);
        return await this.dao.updateTeamOwners(id, ownersToAdd, ownersToRemove);
    }
}
