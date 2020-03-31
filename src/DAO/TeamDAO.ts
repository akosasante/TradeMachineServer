import {DeleteResult, FindManyOptions, getConnection, In, InsertResult, Repository} from "typeorm";
import Team from "../models/team";
import User from "../models/user";

export default class TeamDAO {
    private teamDb: Repository<Team>;

    constructor(repo?: Repository<Team>) {
        this.teamDb = repo || getConnection(process.env.NODE_ENV).getRepository("Team");
    }

    public async getAllTeams(): Promise<Team[]> {
        const options: FindManyOptions = {order: {id: "ASC"}};
        return await this.teamDb.find(options);
    }

    public async getTeamsWithOwners(): Promise<Team[]> {
        return await this.teamDb
            .createQueryBuilder("team")
            .innerJoinAndSelect("team.owners", "owners")
            .getMany();
    }

    public async getTeamsWithNoOwners(): Promise<Team[]> {
        return await this.teamDb
            .createQueryBuilder("team")
            .leftJoinAndSelect("team.owners", "owners")
            .where("owners IS NULL")
            .getMany();
    }

    public async getTeamById(id: string): Promise<Team> {
        return await this.teamDb.findOneOrFail(id);
    }

    public async findTeams(query: Partial<Team>): Promise<Team[]> {
        return await this.teamDb.find({where: query});
    }

    public async createTeams(teamObjs: Partial<Team>[]): Promise<Team[]> {
        const result: InsertResult = await this.teamDb.insert(teamObjs);
        return await this.teamDb.find({id: In(result.identifiers.map(({id}) => id))});
    }

    public async updateTeam(id: string, teamObj: Partial<Team>): Promise<Team> {
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

    public async updateTeamOwners(id: string, ownersToAdd: User[], ownersToRemove: User[]): Promise<Team> {
        await this.teamDb.findOneOrFail(id);
        await this.teamDb
            .createQueryBuilder()
            .relation("owners")
            .of(id)
            .addAndRemove(ownersToAdd, ownersToRemove);
        return await this.getTeamById(id);
    }
}
