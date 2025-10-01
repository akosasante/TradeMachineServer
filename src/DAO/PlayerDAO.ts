import {
    DeleteResult,
    FindManyOptions,
    FindOneOptions,
    FindOptionsWhere,
    getConnection,
    ILike,
    In,
    InsertResult,
    QueryFailedError,
    Repository,
} from "typeorm";
import { v4 as uuidv4 } from "uuid";
import Player from "../models/player";
import Team from "../models/team";
import logger from "../bootstrap/logger";
import { inspect } from "util";
import { QueryDeepPartialEntity } from "typeorm/query-builder/QueryPartialEntity";

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
        return await this.playerDb.findOneOrFail({ where: { id } } as FindOneOptions<Player>);
    }

    public async getPlayerByName(name: string): Promise<Player | null> {
        return await this.playerDb.findOne({ where: { name } } as FindOneOptions<Player>);
    }

    public async findPlayers(
        query: FindOptionsWhere<Player> & { leagueTeamId?: string },
        limit?: number
    ): Promise<Player[]> {
        const leagueTeamId = query.leagueTeamId;
        let options: FindManyOptions<Player> = {};
        let where;
        logger.debug(`initial query: ${inspect(query)}`);

        if (leagueTeamId) {
            delete query.leagueTeamId;
            const leagueTeam: FindOptionsWhere<Team> = { id: leagueTeamId };
            where = { ...query, leagueTeam };
        } else {
            where = { ...query };
        }

        options = limit ? { where, take: limit } : { where };
        logger.debug(`initial options: ${inspect(options)}`);
        return await this.playerDb.find(options);
    }

    public async queryPlayersByName(query: string, league?: number): Promise<Player[]> {
        const defaultLimit = 50;
        const cacheExpiryMilliseconds = 60000;
        const where: FindOptionsWhere<Player> = { name: ILike(`%${query}%`) };
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
        try {
            const playerEntities = playerObjs.map(playerObj => this.playerDb.create(playerObj));
            return await this.playerDb.save(playerEntities);
        } catch (error) {
            if (
                error instanceof QueryFailedError &&
                error.message.includes("duplicate key value violates unique constraint")
            ) {
                return [];
            } else {
                throw error;
            }
        }
    }

    public async batchCreatePlayers(playerObjs: Partial<Player>[]): Promise<Player[]> {
        return await this.playerDb.save(playerObjs, { chunk: 10 });
    }

    public async batchUpsertPlayers(playerObjs: Partial<Player>[]): Promise<Player[]> {
        if (playerObjs.length) {
            // Ensure UUIDs are generated for new entities (since raw insert bypasses @BeforeInsert hooks)
            const playersWithIds = playerObjs.map(playerObj => ({
                ...playerObj,
                id: playerObj.id || uuidv4(),
            }));

            const result: InsertResult = await this.playerDb
                .createQueryBuilder()
                .insert()
                .values(playersWithIds)
                .onConflict(
                    '("name", "playerDataId") DO UPDATE SET "meta" = "Player".meta || EXCLUDED.meta, "leagueTeamId" = EXCLUDED."leagueTeamId", "mlbTeam" = EXCLUDED."mlbTeam"'
                )
                .execute();

            return await this.playerDb.find({
                where: {
                    id: In(result.identifiers.filter(res => !!res).map(({ id }) => id as string)),
                },
            } as FindManyOptions<Player>);
        } else {
            return [];
        }
    }

    public async updatePlayer(id: string, playerObj: QueryDeepPartialEntity<Player>): Promise<Player> {
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
            allPlayers = await this.findPlayers(query as FindOptionsWhere<Player> & { leagueTeamId?: string });
        } else {
            allPlayers = await this.getAllPlayers();
        }
        await this.playerDb.remove(allPlayers, { chunk: 10 });
    }
}
