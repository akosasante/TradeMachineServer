import { NotFoundError } from "routing-controllers";
import { Connection, DeleteResult, FindManyOptions, getConnection, Repository } from "typeorm";
import Team from "../models/team";
import User from "../models/user";

export default class TeamDAO {
    public connection: Connection;
    private teamDb: Repository<Team>;

    constructor() {
        this.connection = getConnection(process.env.NODE_ENV);
        this.teamDb = this.connection.getRepository("Team");
    }

    public async getAllTeams(): Promise<Team[]> {
        const options: FindManyOptions = {order: {id: "ASC"}};
        const dbTeams = await this.teamDb.find(options);
        return dbTeams.map(team => new Team(team));
    }

    public async getTeamsByOwnerStatus(hasOwners: boolean): Promise<Team[]> {
        const condition = `owner."teamId" IS ${(hasOwners ? "NOT NULL" : "NULL")}`;
        const dbTeams = await this.teamDb
            .createQueryBuilder("team")
            .leftJoinAndSelect("team.owners", "owner")
            .where(condition)
            .getMany();
        return dbTeams.map(team => new Team(team));
    }

    public async getTeamById(id: number): Promise<Team> {
        if (!id) {
            throw new NotFoundError("Id is required");
        }
        const dbTeam = await this.teamDb.findOneOrFail(id);
        return new Team(dbTeam);
    }

    public async findTeams(query: Partial<Team>): Promise<Team[]> {
        const dbTeams = await this.teamDb.find({where: query});
        if (dbTeams.length) {
            return dbTeams.map(team => new Team(team));
        } else {
            throw new NotFoundError("No teams found for that query");
        }
    }

    public async createTeam(teamObj: Partial<Team>): Promise<Team> {
        const dbTeam = await this.teamDb.save(teamObj);
        return new Team(dbTeam);
    }

    public async updateTeam(id: number, teamObj: Partial<Team>): Promise<Team> {
        await this.teamDb.update({ id }, teamObj);
        return await this.getTeamById(id);
    }

    public async deleteTeam(id: number): Promise<DeleteResult> {
        if (!id) {
            throw new NotFoundError("Id is required");
        }
        await this.teamDb.findOneOrFail(id);
        return await this.teamDb.delete(id);
    }

    public async updateTeamOwners(id: number, ownersToAdd: User[], ownersToRemove: User[]): Promise<Team> {
        if (!id) {
            throw new NotFoundError("Id is required");
        }
        await this.teamDb.findOneOrFail(id);
        const res = await this.teamDb
            .createQueryBuilder()
            .relation("owners")
            .of(id)
            .addAndRemove(ownersToAdd, ownersToRemove);
        return await this.getTeamById(id);
    }
}
