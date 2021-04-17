import { DeleteResult, FindManyOptions, getConnection, Repository } from "typeorm";
import Trade, { TradeStatus } from "../models/trade";
import TradeItem, { TradeItemType } from "../models/tradeItem";
import TradeParticipant from "../models/tradeParticipant";
import { BadRequestError } from "routing-controllers";
import PlayerDAO from "./PlayerDAO";
import DraftPickDAO from "./DraftPickDAO";


export default class TradeDAO {
    private tradeDb: Repository<Trade>;
    private playerDao: PlayerDAO;
    private pickDao: DraftPickDAO;

    constructor(repo?: Repository<Trade>, playerDao?: PlayerDAO, pickDao?: DraftPickDAO) {
        this.tradeDb = repo || getConnection(process.env.NODE_ENV).getRepository("Trade");
        this.playerDao = playerDao || new PlayerDAO();
        this.pickDao = pickDao || new DraftPickDAO();
    }

    public async getAllTrades(): Promise<Trade[]> {
        const options: FindManyOptions = {order: {id: "ASC"}};
        return await this.tradeDb.find(options);
    }

    public async getTradeById(id: string): Promise<Trade> {
        return await this.tradeDb.findOneOrFail(id);
    }

    public async hydrateTrade(trade: Trade): Promise<Trade> {
        for (const item of (trade.tradeItems || [])) {
            if (item.tradeItemType === TradeItemType.PICK) {
                item.entity = await this.pickDao.getPickById(item.tradeItemId);
            }
            if (item.tradeItemType === TradeItemType.PLAYER) {
                item.entity = await this.playerDao.getPlayerById(item.tradeItemId);
            }
        }
        return trade;
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
        await this.tradeDb.update({id}, {status});
        return await this.getTradeById(id);
    }

    public async updateDeclinedBy(id: string, declinedById: string, declinedReason?: string): Promise<Trade> {
        await this.tradeDb.update({id}, {declinedById, declinedReason});
        return await this.getTradeById(id);
    }

    public async updateAcceptedBy(id: string, acceptedBy: string[]): Promise<Trade> {
        await this.tradeDb.update({id}, {acceptedBy, acceptedOnDate: new Date()});
        return await this.getTradeById(id);
    }
}
