import { differenceBy } from "lodash";
import { Authorized, Body, Delete, Get, JsonController, Param, Post, Put } from "routing-controllers";
import { inspect } from "util";
import logger from "../../bootstrap/logger";
import TradeDAO from "../../DAO/TradeDAO";
import Trade from "../../models/trade";
import { Role } from "../../models/user";
import { UUIDPattern } from "../helpers/ApiHelpers";
import TradeParticipant from "../../models/tradeParticipant";

@JsonController("/trades")
export default class TradeController {
    private dao: TradeDAO;

    constructor(DAO?: TradeDAO) {
        this.dao = DAO || new TradeDAO();
    }

    @Get("/")
    public async getAllTrades(): Promise<Trade[]> {
        logger.debug("get all trades endpoint");
        const trades = await this.dao.getAllTrades();
        logger.debug(`got ${trades.length} trades`);
        return trades;
    }

    @Get(UUIDPattern)
    public async getOneTrade(@Param("id") id: string): Promise<Trade> {
        logger.debug("get one trade endpoint");
        const trade = await this.dao.getTradeById(id);
        logger.debug(`got trade: ${trade}`);
        return trade;
    }

    // TODO: Probably don't want to restrict creating trades to admins; leaving as is for now but will adjust. Updates might depend on if we want to do trade drafts
    @Authorized(Role.ADMIN)
    @Post("/")
    public async createTrade(@Body() tradeObj: Partial<Trade>): Promise<Trade> {
        logger.debug("create trade endpoint");
        const trade = await this.dao.createTrade(tradeObj);
        logger.debug(`created trade: ${inspect(trade)}`);
        return trade;
    }

    @Authorized(Role.ADMIN)
    @Put(UUIDPattern)
    public async updateTrade(@Param("id") id: string, @Body() tradeObj: Partial<Trade>): Promise<Trade> {
        logger.debug("update trade endpoint");
        const existingTrade = await this.dao.getTradeById(id);
        logger.debug(`EXISTING PART: ${inspect(existingTrade.tradeParticipants)}`);
        logger.debug(`NEW PART: ${inspect(tradeObj.tradeParticipants)}`);
        const participantsToAdd = differenceBy(
            (tradeObj.tradeParticipants || []),
            (existingTrade.tradeParticipants || []),
            (participant: TradeParticipant) => `${participant.participantType}|${participant.team.id}`);
        const participantsToRemove = differenceBy(
            (existingTrade.tradeParticipants || []),
            (tradeObj.tradeParticipants || []),
            (participant: TradeParticipant) => `${participant.participantType}|${participant.team.id}`);

        const itemsToAdd = differenceBy(
            (tradeObj.tradeItems || []),
            (existingTrade.tradeItems || []),
            "tradeItemId");
        const itemsToRemove = differenceBy(
            (existingTrade.tradeItems || []),
            (tradeObj.tradeItems || []),
            "tradeItemId");

        await this.dao.updateParticipants(id, participantsToAdd, participantsToRemove);
        const x = await this.dao.updateItems(id, itemsToAdd, itemsToRemove);
        console.debug(`i: ${inspect(x)}`);
        return x;
    }

    @Authorized(Role.ADMIN)
    @Delete(UUIDPattern)
    public async deleteTrade(@Param("id") id: string) {
        logger.debug("delete trade endpoint");
        const result = await this.dao.deleteTrade(id);
        logger.debug(`delete successful: ${inspect(result)}`);
        return await {deleteCount: result.affected, id: result.raw[0].id};
    }
}
