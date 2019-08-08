import { differenceBy } from "lodash";
import { Authorized, Body, Delete, Get, JsonController, Param, Post, Put } from "routing-controllers";
import { inspect } from "util";
import logger from "../../bootstrap/logger";
import TradeDAO from "../../DAO/TradeDAO";
import Trade from "../../models/trade";
import { Role } from "../../models/user";

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

    @Get("/:id([0-9]+)")
    public async getOneTrade(@Param("id") id: number): Promise<Trade> {
        logger.debug("get one trade endpoint");
        return await this.dao.getTradeById(id);
    }

    @Authorized(Role.ADMIN)
    @Post("/")
    public async createTrade(@Body() tradeObj: Partial<Trade>): Promise<Trade> {
        logger.debug("create trade endpoint");
        return await this.dao.createTrade(tradeObj);
    }

    @Authorized(Role.ADMIN)
    @Put("/:id([0-9]+)")
    public async updateTrade(@Param("id") id: number, @Body() tradeObj: Partial<Trade>): Promise<Trade> {
        logger.debug("update trade endpoint");
        const existingTrade = await this.dao.getTradeById(id);
        const participantsToAdd = differenceBy(
            (tradeObj.tradeParticipants || []),
            (existingTrade.tradeParticipants || []),
            "tradeParticipantId");
        const participantsToRemove = differenceBy(
            (existingTrade.tradeParticipants || []),
            (tradeObj.tradeParticipants || []),
            "tradeParticipantId");

        const itemsToAdd = differenceBy(
            (tradeObj.tradeItems || []),
            (existingTrade.tradeItems || []),
            "tradeItemId");
        const itemsToRemove = differenceBy(
            (existingTrade.tradeItems || []),
            (tradeObj.tradeItems || []),
            "tradeItemId");

        await this.dao.updateParticipants(id, participantsToAdd, participantsToRemove);
        await this.dao.updateItems(id, itemsToAdd, itemsToRemove);
        return await this.dao.getTradeById(id);
    }

    @Authorized(Role.ADMIN)
    @Delete("/:id([0-9]+)")
    public async deleteTrade(@Param("id") id: number) {
        logger.debug("delete trade endpoint");
        const result = await this.dao.deleteTrade(id);
        logger.debug(`delete successful: ${inspect(result)}`);
        return await {deleteCount: result.affected, id: result.raw[0].id};
    }
}
