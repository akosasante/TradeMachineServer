import { DeleteResult, FindManyOptions, FindOneOptions, getConnection, In, Raw, Repository } from "typeorm";
import Trade, { TradeStatus } from "../models/trade";
import TradeItem, { TradeItemType } from "../models/tradeItem";
import TradeParticipant from "../models/tradeParticipant";
import { BadRequestError } from "routing-controllers";
import PlayerDAO from "./PlayerDAO";
import DraftPickDAO from "./DraftPickDAO";
import { HydratedTrade } from "../models/views/hydratedTrades";
import { FindOptionsWhere } from "typeorm/find-options/FindOptionsWhere";
import logger from "../bootstrap/logger";
import { v4 as uuid } from "uuid";

interface TradeDeleteResult extends DeleteResult {
    raw: Trade[];
    affected?: number | null;
}

export default class TradeDAO {
    private tradeDb: Repository<Trade>;
    private hydratedTradeDb: Repository<HydratedTrade>;
    private playerDao: PlayerDAO;
    private pickDao: DraftPickDAO;

    constructor(
        repo?: Repository<Trade>,
        playerDao?: PlayerDAO,
        pickDao?: DraftPickDAO,
        hydratedTradeRepo?: Repository<HydratedTrade>
    ) {
        this.tradeDb = repo || getConnection(process.env.ORM_CONFIG).getRepository("Trade");
        this.hydratedTradeDb =
            hydratedTradeRepo || getConnection(process.env.ORM_CONFIG).getRepository("HydratedTrade");
        this.playerDao = playerDao || new PlayerDAO();
        this.pickDao = pickDao || new DraftPickDAO();
    }

    public async getAllTrades(): Promise<Trade[]> {
        const options: FindManyOptions = { order: { id: "ASC" } };
        return await this.tradeDb.find(options);
    }

    public async returnHydratedTrades(
        statuses?: TradeStatus[],
        includeTeam?: string,
        pageSize = 25,
        pageNumber = 1
    ): Promise<[HydratedTrade[], number]> {
        let where: FindOptionsWhere<HydratedTrade>[] | FindOptionsWhere<HydratedTrade> | undefined;

        if (statuses && includeTeam) {
            where = [
                { tradeCreator: includeTeam, tradeStatus: In(statuses) },
                {
                    tradeRecipients: Raw(_tp => ':teamName = ANY("tradeRecipients")', { teamName: includeTeam }),
                    tradeStatus: In(statuses),
                },
            ];
        } else if (statuses) {
            where = { tradeStatus: In(statuses) };
        } else if (includeTeam) {
            where = [
                { tradeCreator: includeTeam },
                { tradeRecipients: Raw(_tp => ':teamName = ANY("tradeRecipients")', { teamName: includeTeam }) },
            ];
        }

        const whereClause = where ? { where } : undefined;

        const pagingOptions = {
            skip: (pageNumber - 1) * pageSize,
            take: pageSize,
        };

        return await (whereClause
            ? this.hydratedTradeDb.findAndCount({
                  order: { dateCreated: "DESC" },
                  ...pagingOptions,
                  where,
              })
            : this.hydratedTradeDb.findAndCount({ order: { dateCreated: "DESC" }, ...pagingOptions }));
    }

    public async getTradeById(id: string): Promise<Trade> {
        return await this.tradeDb.findOneOrFail({ where: { id } } as FindOneOptions<Trade>);
    }

    public async hydrateTrade(trade: Trade): Promise<Trade> {
        for (const item of trade.tradeItems || []) {
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

        if (!tradeObj.id) {
            tradeObj.id = uuid();
        }

        for (const item of tradeObj.tradeItems || []) {
            if (!item.id) {
                item.id = uuid();
            }
        }

        for (const participant of tradeObj.tradeParticipants || []) {
            if (!participant.id) {
                participant.id = uuid();
            }
        }

        const saved = await this.tradeDb.save({...tradeObj, id: uuid()});

        return this.tradeDb.findOneOrFail({ where: { id: saved.id } } as FindOneOptions<Trade>);
    }

    public async deleteTrade(id: string): Promise<TradeDeleteResult> {
        await this.tradeDb.findOneOrFail({ where: { id } });
        return await this.tradeDb.createQueryBuilder().delete().whereInIds(id).returning("id").execute();
    }

    public async updateParticipants(
        id: string,
        participantsToAdd: TradeParticipant[],
        participantsToRemove: TradeParticipant[]
    ): Promise<Trade> {
        await this.tradeDb.findOneOrFail({ where: { id } });
        await this.tradeDb
            .createQueryBuilder()
            .relation("tradeParticipants")
            .of(id)
            .addAndRemove(participantsToAdd, participantsToRemove);
        return await this.tradeDb.findOneOrFail({ where: { id } });
    }

    public async updateItems(id: string, itemsToAdd: TradeItem[], itemsToRemove: TradeItem[]): Promise<Trade> {
        await this.tradeDb.findOneOrFail({ where: { id } });
        await this.tradeDb.createQueryBuilder().relation("tradeItems").of(id).addAndRemove(itemsToAdd, itemsToRemove);
        return await this.tradeDb.findOneOrFail({ where: { id } });
    }

    public async updateStatus(id: string, status: TradeStatus): Promise<Trade> {
        await this.tradeDb.update({ id }, { status });
        return await this.getTradeById(id);
    }

    public async updateDeclinedBy(id: string, declinedById: string, declinedReason?: string): Promise<Trade> {
        await this.tradeDb.update({ id }, { declinedById, declinedReason });
        return await this.getTradeById(id);
    }

    public async updateAcceptedBy(id: string, acceptedBy: string[]): Promise<Trade> {
        await this.tradeDb.update({ id }, { acceptedBy, acceptedOnDate: new Date() });
        return await this.getTradeById(id);
    }
}
