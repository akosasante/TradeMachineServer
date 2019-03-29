import { NotFoundError } from "routing-controllers";
import { Connection, DeleteResult, FindManyOptions, getConnection, Repository } from "typeorm";
import Team from "../models/team";

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

    public async getTeamById(id: number): Promise<Team> {
        if (!id) {
            throw new NotFoundError("Id is required");
        }
        const dbTeam = await this.teamDb.findOneOrFail(id);
        return new Team(dbTeam);
    }

    public async findTeam(query: Partial<Team>): Promise<Team|undefined> {
        const dbTeam = await this.teamDb.findOneOrFail({where: query});
        return new Team(dbTeam);
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
        await this.getTeamById(id);
        return await this.teamDb.delete(id);
    }
}
