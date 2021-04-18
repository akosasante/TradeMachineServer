import { DeleteResult, FindManyOptions, getConnection, In, InsertResult, Repository } from "typeorm";
import DraftPick from "../models/draftPick";

export default class DraftPickDAO {
    private draftPickDb: Repository<DraftPick>;

    constructor(repo?: Repository<DraftPick>) {
        this.draftPickDb = repo || getConnection(process.env.ORM_CONFIG).getRepository("DraftPick");
    }

    public async getAllPicks(): Promise<DraftPick[]> {
        const options: FindManyOptions = { order: { id: "ASC" } };
        return await this.draftPickDb.find(options);
    }

    public async getPickById(id: string): Promise<DraftPick> {
        return await this.draftPickDb.findOneOrFail(id);
    }

    public async findPicks(query: Partial<DraftPick>): Promise<DraftPick[]> {
        return await this.draftPickDb.find({ where: query });
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

    public async deletePick(id: string): Promise<DeleteResult> {
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
