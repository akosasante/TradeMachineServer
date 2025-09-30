import {
    DeleteResult,
    FindOptionsWhere,
    FindManyOptions,
    getConnection,
    In,
    InsertResult,
    Repository,
    FindOneOptions
} from "typeorm";
import { QueryDeepPartialEntity } from "typeorm/query-builder/QueryPartialEntity";
import { v4 as uuidv4 } from "uuid";
import DraftPick from "../models/draftPick";

interface DraftPickDeleteResult extends DeleteResult {
    raw: DraftPick[];
    affected?: number | null;
}

export default class DraftPickDAO {
    private draftPickDb: Repository<DraftPick>;
    private cacheExpiryMilliseconds = 60000;

    constructor(repo?: Repository<DraftPick>) {
        this.draftPickDb = repo || getConnection(process.env.ORM_CONFIG).getRepository("DraftPick");
    }

    public async getAllPicks(skipCache = false): Promise<DraftPick[]> {
        const options: FindManyOptions = {
            order: { id: "ASC" },
            cache: skipCache ? false : this.cacheExpiryMilliseconds,
        };
        return await this.draftPickDb.find(options);
    }

    public async getPickById(id: string): Promise<DraftPick> {
        return await this.draftPickDb.findOneOrFail({
            where: { id },
            cache: this.cacheExpiryMilliseconds,
        } as FindOneOptions<DraftPick>);
    }

    public async findPicks(query: FindOptionsWhere<DraftPick>): Promise<DraftPick[]> {
        return await this.draftPickDb.find({ where: query, cache: this.cacheExpiryMilliseconds });
    }

    public async createPicks(pickObjs: Partial<DraftPick>[]): Promise<DraftPick[]> {
        const pickEntities = pickObjs.map(pickObj => this.draftPickDb.create(pickObj));
        return await this.draftPickDb.save(pickEntities);
    }

    public async batchCreatePicks(pickObjs: Partial<DraftPick>[]): Promise<DraftPick[]> {
        return await this.draftPickDb.save(pickObjs, { chunk: 10 });
    }

    public async batchUpsertPicks(pickObjs: Partial<DraftPick>[]): Promise<DraftPick[]> {
        if (pickObjs.length) {
            // Ensure UUIDs are generated for new entities (since raw insert bypasses @BeforeInsert hooks)
            const picksWithIds = pickObjs.map(pickObj => ({
                ...pickObj,
                id: pickObj.id || uuidv4(),
            }));

            // TODO: Look into replacing onConflict with orUpdate
            const result: InsertResult = await this.draftPickDb
                .createQueryBuilder()
                .insert()
                .values(picksWithIds)
                .onConflict(
                    '("type", "season", "round", "originalOwnerId") DO UPDATE SET "currentOwnerId" = EXCLUDED."currentOwnerId", "pickNumber" = EXCLUDED."pickNumber"'
                )
                .execute();

            return await this.draftPickDb.find({
                where: {
                    id: In(result.identifiers.filter(res => !!res).map(({ id }) => id as string)),
                },
            } as FindManyOptions<DraftPick>);
        } else {
            return [];
        }
    }

    public async updatePick(id: string, pickObj: QueryDeepPartialEntity<DraftPick>): Promise<DraftPick> {
        await this.draftPickDb.update({ id }, pickObj);
        return await this.getPickById(id);
    }

    public async deletePick(id: string): Promise<DraftPickDeleteResult> {
        await this.getPickById(id);
        return await this.draftPickDb.createQueryBuilder().delete().whereInIds(id).returning("id").execute();
    }

    public async deleteAllPicks(query?: Partial<DraftPick>): Promise<void> {
        let allPicks: DraftPick[];
        if (query) {
            allPicks = await this.findPicks(query as FindOptionsWhere<DraftPick>);
        } else {
            allPicks = await this.getAllPicks();
        }
        await this.draftPickDb.remove(allPicks, { chunk: 10 });
    }
}
