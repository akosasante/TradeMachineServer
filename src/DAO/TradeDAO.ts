import { DeleteResult, FindManyOptions, getConnection, Repository } from "typeorm";
import Trade, {TradeStatus} from "../models/trade";
import TradeItem from "../models/tradeItem";
import TradeParticipant from "../models/tradeParticipant";
import { BadRequestError } from "routing-controllers";


export default class TradeDAO {
    private tradeDb: Repository<Trade>;

    constructor(repo?: Repository<Trade>) {
        this.tradeDb = repo || getConnection(process.env.NODE_ENV).getRepository("Trade");
    }

    public async getAllTrades(): Promise<Trade[]> {
        const options: FindManyOptions = {order: {id: "ASC"}};
        return await this.tradeDb.find(options);
    }

    public async getTradeById(id: string): Promise<Trade> {
        return await this.tradeDb.findOneOrFail(id);
    }

public async createTrade(tradeObj: Partial<Trade>): Promise<Trade> {
        if (!Trade.isValid(tradeObj)) {
            throw new BadRequestError("Trade is not valid");
        }

        const saved = await this.tradeDb.save(tradeObj);

        return this.tradeDb.findOneOrFail(saved.id);
    }

    public async deleteTrade(id: string): Promise<DeleteResult> {
        await this.tradeDb.findOneOrFail(id);
        return await this.tradeDb.createQueryBuilder()
            .delete()
            .whereInIds(id)
            .returning("id")
            .execute();
    }

    public async updateParticipants(id: string, participantsToAdd: TradeParticipant[],
                                    participantsToRemove: TradeParticipant[]): Promise<Trade> {
        await this.tradeDb.findOneOrFail(id);
        await this.tradeDb
            .createQueryBuilder()
            .relation("tradeParticipants")
            .of(id)
            .addAndRemove(participantsToAdd, participantsToRemove);
        return await this.tradeDb.findOneOrFail(id);
    }

    public async updateItems(id: string, itemsToAdd: TradeItem[], itemsToRemove: TradeItem[]): Promise<Trade> {
        await this.tradeDb.findOneOrFail(id);
        await this.tradeDb
            .createQueryBuilder()
            .relation("tradeItems")
            .of(id)
            .addAndRemove(itemsToAdd, itemsToRemove);
        return await this.tradeDb.findOneOrFail(id);
    }

    public async updateStatus(id: string, status: TradeStatus): Promise<Trade> {
        await this.tradeDb.update({ id }, { status });
        return await this.getTradeById(id);
    }
}
