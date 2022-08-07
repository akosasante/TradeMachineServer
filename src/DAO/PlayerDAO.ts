import {
    DeleteResult,
    FindConditions,
    FindManyOptions,
    getConnection,
    ILike,
    In,
    InsertResult,
    Repository,
} from "typeorm";
import Player from "../models/player";

interface PlayerDeleteResult extends DeleteResult {
    raw: Player[];
    affected?: number | null;
}

export default class PlayerDAO {
    private playerDb: Repository<Player>;

    constructor(repo?: Repository<Player>) {
        this.playerDb = repo || getConnection(process.env.ORM_CONFIG).getRepository("Player");
    }

    public async getAllPlayers(): Promise<Player[]> {
        const options: FindManyOptions = { order: { id: "ASC" } };
        return await this.playerDb.find(options);
    }

    public async getPlayerById(id: string): Promise<Player> {
        return await this.playerDb.findOneOrFail(id);
    }

    public async getPlayerByName(name: string): Promise<Player | undefined> {
        return await this.playerDb.findOne({ name });
    }

    public async findPlayers(query: Partial<Player>, limit?: number): Promise<Player[]> {
        const options: FindManyOptions = limit ? { where: query, take: limit } : { where: query };
        return await this.playerDb.find(options);
    }

    public async queryPlayersByName(query: string, league?: number): Promise<Player[]> {
        const defaultLimit = 50;
        const cacheExpiryMilliseconds = 60000;
        const where: FindConditions<Player> = { name: ILike(`%${query}%`) };
        if (league) {
            where.league = league;
        }
        return await this.playerDb.find({
            where,
            take: defaultLimit,
            cache: cacheExpiryMilliseconds,
            order: { name: "ASC" },
        });
    }

    public async createPlayers(playerObjs: Partial<Player>[]): Promise<Player[]> {
        const result: InsertResult = await this.playerDb.insert(playerObjs);
        return await this.playerDb.find({ id: In(result.identifiers.map(({ id }) => id as string)) });
    }

    public async batchCreatePlayers(playerObjs: Partial<Player>[]): Promise<Player[]> {
        return await this.playerDb.save(playerObjs, { chunk: 10 });
    }

    public async batchUpsertPlayers(playerObjs: Partial<Player>[]): Promise<Player[]> {
        if (playerObjs.length) {
            const result: InsertResult = await this.playerDb
                .createQueryBuilder()
                .insert()
                .values(playerObjs)
                .onConflict(
                    '("name", "playerDataId") DO UPDATE SET "meta" = player.meta || EXCLUDED.meta, "leagueTeamId" = EXCLUDED."leagueTeamId", "mlbTeam" = EXCLUDED."mlbTeam"'
                )
                .execute();

            return await this.playerDb.find({
                id: In(result.identifiers.filter(res => !!res).map(({ id }) => id as string)),
            });
        } else {
            return [];
        }
    }

    public async updatePlayer(id: string, playerObj: Partial<Player>): Promise<Player> {
        await this.playerDb.update({ id }, playerObj);
        return await this.getPlayerById(id);
    }

    public async deletePlayer(id: string): Promise<PlayerDeleteResult> {
        await this.getPlayerById(id);
        return await this.playerDb.createQueryBuilder().delete().whereInIds(id).returning("id").execute();
    }

    public async deleteAllPlayers(query?: Partial<Player>): Promise<void> {
        let allPlayers: Player[];
        if (query) {
            allPlayers = await this.findPlayers(query);
        } else {
            allPlayers = await this.getAllPlayers();
        }
        await this.playerDb.remove(allPlayers, { chunk: 10 });
    }
}
