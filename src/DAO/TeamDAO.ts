import { NotFoundError } from "routing-controllers";
import { Connection, DeleteResult, FindManyOptions, getConnection, Repository } from "typeorm";
import TeamDO from "../models/team";
import User from "../models/user";
import { Team } from "@akosasante/trade-machine-models";
import UserDO from "../models/user";

export default class TeamDAO {
    private teamDb: Repository<TeamDO>;

    constructor(repo?: Repository<TeamDO>) {
        this.teamDb = repo || getConnection(process.env.NODE_ENV).getRepository("Team");
    }

    public async getAllTeams(): Promise<Team[]> {
        const options: FindManyOptions = {order: {id: "ASC"}};
        const dbTeams = await this.teamDb.find(options);
        return dbTeams.map(team => team.toTeamModel());
    }

    public async getTeamsByOwnerStatus(hasOwners: boolean): Promise<Team[]> {
        const condition = `owner."teamId" IS ${(hasOwners ? "NOT NULL" : "NULL")}`;
        const dbTeams = await this.teamDb
            .createQueryBuilder("team")
            .leftJoinAndSelect("team.owners", "owner")
            .where(condition)
            .getMany();
        return dbTeams.map(team => team.toTeamModel());
    }

    public async getTeamById(id: string): Promise<Team> {
        const dbTeam = await this.teamDb.findOneOrFail(id);
        return dbTeam.toTeamModel();
    }

    public async findTeams(query: Partial<TeamDO>): Promise<Team[]> {
        const dbTeams = await this.teamDb.find({where: query});
        return dbTeams.map(team => team.toTeamModel());
    }

    public async createTeams(teamObjs: Array<Partial<TeamDO>>): Promise<Team[]> {
        const dbTeams = await this.teamDb.save(teamObjs);
        return dbTeams.map(team => team.toTeamModel());
    }

    public async updateTeam(id: string, teamObj: Partial<TeamDO>): Promise<Team> {
        await this.teamDb.update({ id }, teamObj);
        return await this.getTeamById(id);
    }

    public async deleteTeam(id: string): Promise<DeleteResult> {
        await this.teamDb.findOneOrFail(id);
        return await this.teamDb.createQueryBuilder()
            .delete()
            .whereInIds(id)
            .returning("id")
            .execute();
    }

    public async updateTeamOwners(id: string, ownersToAdd: UserDO[], ownersToRemove: UserDO[]): Promise<Team> {
        await this.teamDb.findOneOrFail(id);
        await this.teamDb
            .createQueryBuilder()
            .relation("owners")
            .of(id)
            .addAndRemove(ownersToAdd, ownersToRemove);
        return await this.getTeamById(id);
    }
}
