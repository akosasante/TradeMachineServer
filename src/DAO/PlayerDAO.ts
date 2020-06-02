import {DeleteResult, FindConditions, FindManyOptions, getConnection, In, InsertResult, Repository} from "typeorm";
import Player, {PlayerLeagueType} from "../models/player";

export default class PlayerDAO {
    private playerDb: Repository<Player>;

    constructor(repo?: Repository<Player>) {
        this.playerDb = repo || getConnection(process.env.NODE_ENV).getRepository("Player");
    }

    public async getAllPlayers(): Promise<Player[]> {
        const options: FindManyOptions = {order: {id: "ASC"}};
        return await this.playerDb.find(options);
    }

    public async getPlayerById(id: string): Promise<Player> {
        return await this.playerDb.findOneOrFail(id);
    }

    public async findPlayers(query: Partial<Player>): Promise<Player[]> {
        return await this.playerDb.find({where: query});
    }

    public async createPlayers(playerObjs: Partial<Player>[]): Promise<Player[]> {
        const result: InsertResult = await this.playerDb.insert(playerObjs);
        return await this.playerDb.find({id: In(result.identifiers.map(({id}) => id))});
    }

    public async batchCreatePlayers(playerObjs: Partial<Player>[]): Promise<Player[]> {
        return await this.playerDb.save(playerObjs, {chunk: 10});
    }

    public async updatePlayer(id: string, playerObj: Partial<Player>): Promise<Player> {
        await this.playerDb.update({ id }, playerObj);
        return await this.getPlayerById(id);
    }

    public async deletePlayer(id: string): Promise<DeleteResult> {
        await this.getPlayerById(id);
        return await this.playerDb.createQueryBuilder()
            .delete()
            .whereInIds(id)
            .returning("id")
            .execute();
    }

    public async deleteAllPlayers(query?: Partial<Player>): Promise<void> {
        let allPlayers: Player[];
        if (query) {
            allPlayers = await this.findPlayers(query);
        } else {
            allPlayers = await this.getAllPlayers();
        }
        await this.playerDb.remove(allPlayers, {chunk: 10});
    }
}
