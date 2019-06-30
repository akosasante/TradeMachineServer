import { NotFoundError } from "routing-controllers";
import { Connection, DeleteResult, FindManyOptions, getConnection, Repository } from "typeorm";
import DraftPick from "../models/draftPick";

export default class DraftPickDAO {
    public connection: Connection;
    private draftPickDb: Repository<DraftPick>;

    constructor() {
        this.connection = getConnection(process.env.NODE_ENV);
        this.draftPickDb = this.connection.getRepository("DraftPick");
    }

    public async getAllPicks(): Promise<DraftPick[]> {
        const options: FindManyOptions = {order: {id: "ASC"}};
        const dbPicks = await this.draftPickDb.find(options);
        return dbPicks.map(pick => new DraftPick(pick));
    }

    public async getPickById(id: number): Promise<DraftPick> {
        if (!id) {
            throw new NotFoundError("Id is required");
        }
        const dbPick = await this.draftPickDb.findOneOrFail(id);
        return new DraftPick(dbPick);
    }

    public async findPicks(query: Partial<DraftPick>): Promise<DraftPick[]> {
        const dbPicks = await this.draftPickDb.find({where: query});
        if (dbPicks.length) {
            return dbPicks.map(draftPick => new DraftPick(draftPick));
        } else {
            throw new NotFoundError("No picks found for that query");
        }
    }

    public async createPick(pickObj: Partial<DraftPick>): Promise<DraftPick> {
        const dbPick = await this.draftPickDb.save(pickObj);
        return new DraftPick(dbPick);
    }

    public async updatePick(id: number, pickObj: Partial<DraftPick>): Promise<DraftPick> {
        await this.draftPickDb.update({ id }, pickObj);
        return await this.getPickById(id);
    }

    public async deletePick(id: number): Promise<DeleteResult> {
        await this.getPickById(id);
        return await this.draftPickDb.delete(id);
    }
}
