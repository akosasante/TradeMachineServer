import { NotFoundError } from "routing-controllers";
import { Connection, DeleteResult, FindManyOptions, getConnection, Repository } from "typeorm";
import Trade from "../models/trade";

export default class TradeDAO {
    public connection: Connection;
    private tradeDb: Repository<Trade>;

    constructor() {
        this.connection = getConnection(process.env.NODE_ENV);
        this.tradeDb = this.connection.getRepository("Trade");
    }

    public async getAllTrades(): Promise<Trade[]> {
        const options: FindManyOptions = {order: {id: "ASC"}};
        const dbTrades = await this.tradeDb.find(options);
        return dbTrades.map(trade => new Trade(trade));
    }

    public async getTradeById(id: number): Promise<Trade> {
        if (!id) {
            throw new NotFoundError("Id is required");
        }
        const dbTrade = await this.tradeDb.findOneOrFail(id);
        return new Trade(dbTrade);
    }

    public async createTrade(tradeObj: Partial<Trade>): Promise<Trade> {
        const dbTrade = await this.tradeDb.save(tradeObj);
        return new Trade(dbTrade);
    }

    public async updateTrade(id: number, tradeObj: Partial<Trade>): Promise<Trade> {
        await this.tradeDb.update({ id }, tradeObj);
        return await this.getTradeById(id);
    }

    public async deleteTrade(id: number): Promise<DeleteResult> {
        if (!id) {
            throw new NotFoundError("Id is required");
        }
        await this.tradeDb.findOneOrFail(id);
        return await this.tradeDb.delete(id);
    }
}
