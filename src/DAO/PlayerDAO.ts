import { NotFoundError } from "routing-controllers";
import { Connection, DeleteResult, FindManyOptions, getConnection, Repository } from "typeorm";
import Player from "../models/player";

export default class PlayerDAO {
    public connection: Connection;
    private playerDb: Repository<Player>;

    constructor() {
        this.connection = getConnection(process.env.NODE_ENV);
        this.playerDb = this.connection.getRepository("Player");
    }

    public async getAllPlayers(): Promise<Player[]> {
        const options: FindManyOptions = {order: {id: "ASC"}};
        const dbPlayers = await this.playerDb.find(options);
        return dbPlayers.map(player => new Player(player));
    }

    public async getPlayerById(id: number): Promise<Player> {
        if (!id) {
            throw new NotFoundError("Id is required");
        }
        const dbPlayer = await this.playerDb.findOneOrFail(id);
        return new Player(dbPlayer);
    }

    public async findPlayers(query: Partial<Player>): Promise<Player[]> {
        const dbPlayers = await this.playerDb.find({where: query});
        if (dbPlayers.length) {
            return dbPlayers.map(player => new Player(player));
        } else {
            throw new NotFoundError("No players found for that query");
        }
    }

    public async createPlayer(playerObj: Partial<Player>): Promise<Player> {
        const dbPlayer = await this.playerDb.save(playerObj);
        return new Player(dbPlayer);
    }

    public async updatePlayer(id: number, playerObj: Partial<Player>): Promise<Player> {
        await this.playerDb.update({ id }, playerObj);
        return await this.getPlayerById(id);
    }

    public async deletePlayer(id: number): Promise<DeleteResult> {
        await this.getPlayerById(id);
        return await this.playerDb.delete(id);
    }
}
