import { DeleteResult, FindConditions, FindManyOptions, getConnection, In, InsertResult, Repository } from "typeorm";
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
        return await this.draftPickDb.findOneOrFail(id, { cache: this.cacheExpiryMilliseconds });
    }

    public async findPicks(query: FindConditions<DraftPick>): Promise<DraftPick[]> {
        return await this.draftPickDb.find({ where: query, cache: this.cacheExpiryMilliseconds });
    }

    public async createPicks(pickObjs: Partial<DraftPick>[]): Promise<DraftPick[]> {
        const result: InsertResult = await this.draftPickDb.insert(pickObjs);
        return await this.draftPickDb.find({ id: In(result.identifiers.map(({ id }) => id as string)) });
    }

    public async batchCreatePicks(pickObjs: Partial<DraftPick>[]): Promise<DraftPick[]> {
        return await this.draftPickDb.save(pickObjs, { chunk: 10 });
    }

    public async batchUpsertPicks(pickObjs: Partial<DraftPick>[]): Promise<DraftPick[]> {
        if (pickObjs.length) {
            // TODO: Look into replacing onConflict with orUpdate
            const result: InsertResult = await this.draftPickDb
                .createQueryBuilder()
                .insert()
                .values(pickObjs)
                .onConflict(
                    '("type", "season", "round", "originalOwnerId") DO UPDATE SET "currentOwnerId" = EXCLUDED."currentOwnerId", "pickNumber" = EXCLUDED."pickNumber"'
                )
                .execute();

            return await this.draftPickDb.find({
                id: In(result.identifiers.filter(res => !!res).map(({ id }) => id as string)),
            });
        } else {
            return [];
        }
    }

    public async updatePick(id: string, pickObj: Partial<DraftPick>): Promise<DraftPick> {
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
            allPicks = await this.findPicks(query);
        } else {
            allPicks = await this.getAllPicks();
        }
        await this.draftPickDb.remove(allPicks, { chunk: 10 });
    }
}
