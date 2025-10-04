import { DeleteResult, FindManyOptions, FindOneOptions, getConnection, In, Raw, Repository } from "typeorm";
import Trade, { TradeStatus } from "../models/trade";
import TradeItem, { TradeItemType } from "../models/tradeItem";
import TradeParticipant from "../models/tradeParticipant";
import { BadRequestError } from "routing-controllers";
import PlayerDAO from "./PlayerDAO";
import DraftPickDAO from "./DraftPickDAO";
import { HydratedTrade } from "../models/views/hydratedTrades";
import { FindOptionsWhere } from "typeorm/find-options/FindOptionsWhere";
import { v4 as uuid } from "uuid";
import logger from "../bootstrap/logger";

export interface TradeDeleteResult extends DeleteResult {
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

        // Manually generate IDs for nested entities to work around TypeORM @BeforeInsert hook issues
        if (!tradeObj.id) {
            tradeObj.id = uuid();
            logger.info(`Generated UUID for Trade: ${tradeObj.id}`);
        }

        // Generate IDs for trade participants
        if (tradeObj.tradeParticipants) {
            tradeObj.tradeParticipants.forEach(participant => {
                if (!participant.id) {
                    participant.id = uuid();
                    logger.info(`Generated UUID for TradeParticipant: ${participant.id}`);
                }
            });
        }

        // Generate IDs for trade items
        if (tradeObj.tradeItems) {
            tradeObj.tradeItems.forEach(item => {
                if (!item.id) {
                    item.id = uuid();
                    logger.info(`Generated UUID for TradeItem: ${item.id}`);
                }
            });
        }

        // Note: Emails use messageId as primary key, not id, so no UUID generation needed

        const saved = await this.tradeDb.save(tradeObj);

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

        // Generate IDs for new participants to work around TypeORM @BeforeInsert hook issues
        participantsToAdd.forEach(participant => {
            if (!participant.id) {
                participant.id = uuid();
                logger.info(`Generated UUID for new TradeParticipant: ${participant.id}`);
            }
        });

        await this.tradeDb
            .createQueryBuilder()
            .relation("tradeParticipants")
            .of(id)
            .addAndRemove(participantsToAdd, participantsToRemove);
        return await this.tradeDb.findOneOrFail({ where: { id } });
    }

    public async updateItems(id: string, itemsToAdd: TradeItem[], itemsToRemove: TradeItem[]): Promise<Trade> {
        await this.tradeDb.findOneOrFail({ where: { id } });

        // Generate IDs for new items to work around TypeORM @BeforeInsert hook issues
        itemsToAdd.forEach(item => {
            if (!item.id) {
                item.id = uuid();
                logger.info(`Generated UUID for new TradeItem: ${item.id}`);
            }
        });

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
