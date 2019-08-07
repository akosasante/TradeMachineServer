import { NotFoundError } from "routing-controllers";
import { Connection, DeleteResult, FindManyOptions, getConnection, Repository } from "typeorm";
import { ConstructorError } from "../models/base";
import Trade from "../models/trade";
import TradeItem from "../models/tradeItem";
import TradeParticipant from "../models/tradeParticipant";

const relations = ["tradeParticipants", "tradeItems", "tradeParticipants.team", "tradeItems.sender",
"tradeItems.recipient", "tradeItems.player", "tradeItems.pick"];

export default class TradeDAO {
    public connection: Connection;
    private tradeDb: Repository<Trade>;
    private participantDb: Repository<TradeParticipant>;
    private itemDb: Repository<TradeItem>;

    constructor() {
        this.connection = getConnection(process.env.NODE_ENV);
        this.tradeDb = this.connection.getRepository("Trade");
        this.participantDb = this.connection.getRepository("TradeParticipant");
        this.itemDb = this.connection.getRepository("TradeItem");
    }

    public async getAllTrades(): Promise<Trade[]> {
        const options: FindManyOptions = {order: {id: "ASC"}, relations};
        const dbTrades = await this.tradeDb.find(options);
        return dbTrades.map(trade => new Trade(trade));
    }

    public async getTradeById(id: number): Promise<Trade> {
        if (!id) {
            throw new NotFoundError("Id is required");
        }
        const dbTrade = await this.tradeDb.findOneOrFail(id, {relations});
        return new Trade(dbTrade);
    }

    public async createTrade(tradeObj: Partial<Trade>): Promise<Trade> {
        return this.connection.transaction(async tran => {
            const partDb = tran.getRepository("TradeParticipant");
            const itemDb = tran.getRepository("TradeItem");
            const tradeDb = tran.getRepository("Trade");

            tradeObj.tradeParticipants = await partDb.save(tradeObj.tradeParticipants || []);
            tradeObj.tradeItems = await itemDb.save(tradeObj.tradeItems || []);

            const trade = await tradeDb.save(tradeObj);
            const newTrade = new Trade(trade);
            newTrade.constructRelations();

            if (!newTrade.isValid()) {
                throw new ConstructorError("Trade is not valid");
            }

            return newTrade;
        });
    }

    // public async updateTrade(id: number, tradeObj: Partial<Trade>): Promise<Trade> {
    //
    //     return await this.getTradeById(id);
    // }

    public async deleteTrade(id: number): Promise<DeleteResult> {
        if (!id) {
            throw new NotFoundError("Id is required");
        }
        await this.tradeDb.findOneOrFail(id);
        return await this.tradeDb.delete(id);
    }

    public async updateParticipants(id: number, participantsToAdd: TradeParticipant[],
                                    participantsToRemove: TradeParticipant[]): Promise<Trade> {
        if (!id) {
            throw new NotFoundError("Id is required");
        }
        await this.participantDb.save([...participantsToAdd, ...participantsToRemove]);
        await this.tradeDb.findOneOrFail(id);
        await this.tradeDb
            .createQueryBuilder()
            .relation("tradeParticipants")
            .of(id)
            .addAndRemove(participantsToAdd, participantsToRemove);
        return await this.getTradeById(id);
    }

    public async updateItems(id: number, itemsToAdd: TradeItem[], itemsToRemove: TradeItem[]): Promise<Trade> {
        if (!id) {
            throw new NotFoundError("Id is required");
        }
        await this.itemDb.save([...itemsToAdd, itemsToRemove]);
        await this.tradeDb.findOneOrFail(id);
        await this.tradeDb
            .createQueryBuilder()
            .relation("tradeItems")
            .of(id)
            .addAndRemove(itemsToAdd, itemsToRemove);
        return await this.getTradeById(id);
    }
}
