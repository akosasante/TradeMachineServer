import {
    Authorized, Body, BodyParam, Delete, Get, JsonController, NotFoundError,
    Param, Patch, Post, Put, QueryParam, QueryParams
} from "routing-controllers";
import { inspect } from "util";
import logger from "../../bootstrap/logger";
import TeamDAO from "../../DAO/TeamDAO";
import TeamDO from "../../models/team";
import User, { Role } from "../../models/user";
import { cleanupQuery } from "../helpers/ApiHelpers";
import {Team} from "@akosasante/trade-machine-models";

@JsonController("/teams")
export default class TeamController {
    private dao: TeamDAO;

    constructor(DAO?: TeamDAO) {
        this.dao = DAO || new TeamDAO();
    }

    @Get("/")
    public async getAllTeams(@QueryParam("hasOwners") hasOwners?: "true"|"false"): Promise<Team[]> {
        logger.debug("get all teams endpoint" + ` -- ${hasOwners ? ("hasOwners: " + hasOwners ) : ""}`);
        const teams = hasOwners ? await this.dao.getAllTeams() : await this.dao.getTeamsByOwnerStatus(hasOwners === "true");
        if (teams.length) {
            logger.debug(`got ${teams.length} teams`);
            return teams;
        } else {
            throw new NotFoundError("No teams found matching that query");
        }
    }
    //
    // @Get("/search")
    // public async findTeamsByQuery(@QueryParams() query: Partial<TeamDO>): Promise<TeamDO[]> {
    //     logger.debug(`searching for team with props: ${inspect(query)}`);
    //     // TODO: May allow for searching for multiple teams in the future?
    //     const teams = await this.dao.findTeams(cleanupQuery(query as {[key: string]: string}));
    //     return teams.map((team: TeamDO) => team.publicTeam);
    // }
    //
    // @Get("/:id([0-9]+)")
    // public async getOneTeam(@Param("id") id: number): Promise<TeamDO> {
    //     logger.debug("get one team endpoint");
    //     const team = await this.dao.getTeamById(id);
    //     return team.publicTeam;
    // }
    //
    // /* Only the league admins can edit/delete/create teams at the moment */
    //
    // @Authorized(Role.ADMIN)
    // @Post("/")
    // public async createTeam(@Body() teamObj: Partial<TeamDO>): Promise<TeamDO> {
    //     logger.debug("create team endpoint");
    //     const team = await this.dao.createTeam(teamObj);
    //     return team.publicTeam;
    // }
    //
    // @Authorized(Role.ADMIN)
    // @Put("/:id")
    // public async updateTeam(@Param("id") id: number, @Body() teamObj: Partial<TeamDO>): Promise<TeamDO> {
    //     logger.debug("update team endpoint");
    //     const team = await this.dao.updateTeam(id, teamObj);
    //     logger.debug(`updated team: ${team}`);
    //     return team.publicTeam;
    // }
    //
    // @Authorized(Role.ADMIN)
    // @Delete("/:id([0-9]+)")
    // public async deleteTeam(@Param("id") id: number) {
    //     logger.debug("delete team endpoint");
    //     const result = await this.dao.deleteTeam(id);
    //     logger.debug(`delete successful: ${inspect(result)}`);
    //     return {deleteCount: result.affected, id: result.raw[0].id};
    // }
    //
    // @Authorized(Role.ADMIN)
    // @Patch("/:id([0-9]+)")
    // public async updateTeamOwners(@Param("id") id: number,
    //                               @BodyParam("add") ownersToAdd: User[],
    //                               @BodyParam("remove") ownersToRemove: User[]): Promise<TeamDO> {
    //     logger.debug("update team owners endpoint");
    //     logger.debug(`add: ${inspect((ownersToAdd || []).map((user: User) => new User(user).toString()))}
    //      remove: ${inspect((ownersToRemove || []).map((user: User) => new User(user).toString()))}`);
    //     const team = await this.dao.updateTeamOwners(id, ownersToAdd, ownersToRemove);
    //     return team.publicTeam;
    // }
}
