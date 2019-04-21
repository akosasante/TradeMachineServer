import { Authorized, Body, BodyParam, Delete, Get, JsonController,
    Param, Patch, Post, Put, QueryParam, QueryParams } from "routing-controllers";
import { inspect } from "util";
import logger from "../../bootstrap/logger";
import TeamDAO from "../../DAO/TeamDAO";
import Team from "../../models/team";
import User, { Role } from "../../models/user";
import { cleanupQuery } from "../ApiHelpers";

@JsonController("/teams")
export default class TeamController {
    private dao: TeamDAO;

    constructor(DAO?: TeamDAO) {
        this.dao = DAO || new TeamDAO();
    }

    @Get("/")
    public async getAllTeams(@QueryParam("hasOwners") hasOwners?: "true"|"false"): Promise<Team[]> {
        logger.debug("get all teams endpoint" + ` -- ${hasOwners ? ("hasOwners: " + hasOwners ) : ""}`);
        let teams: Team[] = [];
        // TODO: Consider matching the contract used in UserController.findUser where it 404 if empty
        if (!hasOwners) {
            teams = (await this.dao.getAllTeams()) || [];
        } else {
            teams = (await this.dao.getTeamsByOwnerStatus(hasOwners === "true"));
        }
        logger.debug(`got ${teams.length} teams`);
        return teams.map((team: Team) => team.publicTeam);
    }

    @Get("/:id([0-9]+)")
    public async getOneTeam(@Param("id") id: number): Promise<Team> {
        logger.debug("get one team endpoint");
        const team = await this.dao.getTeamById(id);
        return team.publicTeam;
    }

    @Get("/search")
    public async findTeamsByQuery(@QueryParams() query: Partial<Team>): Promise<Team[]> {
        logger.debug(`searching for team with props: ${inspect(query)}`);
        // TODO: May allow for searching for multiple teams in the future?
        const teams = await this.dao.findTeams(cleanupQuery(query as {[key: string]: string}));
        return teams.map((team: Team) => team.publicTeam);
    }

    /* Only the league admins can edit/delete/create teams at the moment */

    @Authorized(Role.ADMIN)
    @Post("/")
    public async createTeam(@Body() teamObj: Partial<Team>): Promise<Team> {
        logger.debug("create team endpoint");
        const team = await this.dao.createTeam(teamObj);
        return team.publicTeam;
    }

    @Authorized(Role.ADMIN)
    @Put("/:id")
    public async updateTeam(@Param("id") id: number, @Body() teamObj: Partial<Team>): Promise<Team> {
        logger.debug("update team endpoint");
        const team = await this.dao.updateTeam(id, teamObj);
        logger.debug(`updated team: ${inspect(team)}`);
        return team.publicTeam;
    }

    @Authorized(Role.ADMIN)
    @Delete("/:id")
    public async deleteTeam(@Param("id") id: number) {
        logger.debug("delete team endpoint");
        const result = await this.dao.deleteTeam(id);
        logger.debug(`delete successful: ${inspect(result)}`);
        return await {deleteResult: !!result.raw[1], id};
    }

    @Authorized(Role.ADMIN)
    @Patch("/:id([0-9]+)")
    public async updateTeamOwners(@Param("id") id: number,
                                  @BodyParam("add") ownersToAdd: User[],
                                  @BodyParam("remove") ownersToRemove: User[]): Promise<Team> {
        logger.debug("update team owners endpoint");
        logger.debug(`add: ${inspect((ownersToAdd || []).map((user: User) => new User(user).toString()))}
         remove: ${inspect((ownersToRemove || []).map((user: User) => new User(user).toString()))}`);
        const team = await this.dao.updateTeamOwners(id, ownersToAdd, ownersToRemove);
        return team.publicTeam;
    }
}
