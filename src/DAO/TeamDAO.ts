import { DeleteResult, FindManyOptions, FindOneOptions, getConnection, In, InsertResult, Repository } from "typeorm";
import { QueryDeepPartialEntity } from "typeorm/query-builder/QueryPartialEntity";
import Team from "../models/team";
import User from "../models/user";

interface TeamDeleteResult extends DeleteResult {
    raw: Team[];
    affected?: number | null;
}

export default class TeamDAO {
    private teamDb: Repository<Team>;

    constructor(repo?: Repository<Team>) {
        this.teamDb = repo || getConnection(process.env.ORM_CONFIG).getRepository("Team");
    }

    public async getAllTeams(): Promise<Team[]> {
        const options: FindManyOptions = { order: { id: "ASC" } };
        return await this.teamDb.find(options);
    }

    public async getTeamsWithOwners(): Promise<Team[]> {
        return await this.teamDb.createQueryBuilder("team").innerJoinAndSelect("team.owners", "owners").getMany();
    }

    public async getTeamsWithNoOwners(): Promise<Team[]> {
        return await this.teamDb
            .createQueryBuilder("team")
            .leftJoinAndSelect("team.owners", "owners")
            .where("owners IS NULL")
            .getMany();
    }

    public async getTeamById(id: string): Promise<Team> {
        return await this.teamDb.findOneOrFail({ where: { id } });
    }

    public async findTeams(query: Partial<Team>): Promise<Team[]> {
        return await this.teamDb.find({ where: { ...query } } as FindManyOptions<Team>);
    }

    public async createTeams(teamObjs: Partial<Team>[]): Promise<Team[]> {
        const teamEntities = teamObjs.map(teamObj => this.teamDb.create(teamObj));
        return await this.teamDb.save(teamEntities);
    }

    public async updateTeam(id: string, teamObj: Partial<Team>): Promise<Team> {
        await this.teamDb.update({ id }, teamObj as QueryDeepPartialEntity<Team>);
        return await this.getTeamById(id);
    }

    public async deleteTeam(id: string): Promise<TeamDeleteResult> {
        await this.teamDb.findOneOrFail({ where: { id } } as FindOneOptions<Team>);
        return await this.teamDb.createQueryBuilder().delete().whereInIds(id).returning("id").execute();
    }

    public async updateTeamOwners(id: string, ownersToAdd: User[], ownersToRemove: User[]): Promise<Team> {
        await this.teamDb.findOneOrFail({ where: { id } } as FindOneOptions<Team>);
        await this.teamDb.createQueryBuilder().relation("owners").of(id).addAndRemove(ownersToAdd, ownersToRemove);
        return await this.getTeamById(id);
    }
}
