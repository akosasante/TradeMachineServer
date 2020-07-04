import { differenceBy } from "lodash";
import {
    Authorized, BadRequestError, Body, CurrentUser, Delete, Get,
    JsonController, Param, Post, Put, QueryParam, UnauthorizedError
} from "routing-controllers";
import { inspect } from "util";
import logger from "../../bootstrap/logger";
import TradeDAO from "../../DAO/TradeDAO";
import Trade, { TradeStatus } from "../../models/trade";
import User, { Role } from "../../models/user";
import { UUIDPattern } from "../helpers/ApiHelpers";
import TradeParticipant from "../../models/tradeParticipant";

function validateOwnerOfTrade(user: User, trade: Trade): boolean {
    if (user.role === Role.ADMIN) {
        return true;
    } else {
        const belongsToUser = trade.creator?.owners?.map(u => u.id).includes(user.id);
        logger.debug(`${trade} belongs to ${user}? = ${belongsToUser}`);
        return belongsToUser || false;
    }
}

function validateParticipantInTrade(user: User, trade: Trade): boolean {
    if (user.role === Role.ADMIN) {
        return true;
    } else {
        const belongsToUser = (trade.tradeParticipants?.flatMap(tp => tp.team.owners?.map(u => u.id)) || []).includes(user.id);
        logger.debug(`Trade (${trade} belongs to ${user}? = ${belongsToUser}`);
        return belongsToUser;
    }
}

function validateStatusChange(user: User, trade: Trade, newStatus: TradeStatus): boolean {
    type TradeStateMachine = {
        [old in TradeStatus]: TradeStatus[];
    };

    if (trade.status === newStatus) return false;
    // TODO: Consider whether we weant a separate role for LeagueAdmin and/or whether this check should only be allowed for env var admin override
    if (user.isAdmin() || process.env.ADMIN_OVERRIDE === "true") return true;

    const validChangesForParticipants = {
        [TradeStatus.DRAFT]: [],
        [TradeStatus.REQUESTED]: [TradeStatus.PENDING, TradeStatus.ACCEPTED, TradeStatus.REJECTED],
        [TradeStatus.PENDING]: [TradeStatus.ACCEPTED, TradeStatus.REJECTED],
        [TradeStatus.ACCEPTED]: [],
        [TradeStatus.REJECTED]: [],
    };

    const validChangesForOwner = {
        ...validChangesForParticipants,
        [TradeStatus.DRAFT]: [TradeStatus.REQUESTED],
    };

    const checkForValidity: TradeStateMachine = validateOwnerOfTrade(user, trade) ? validChangesForOwner : validChangesForParticipants;

    return checkForValidity[trade.status!].includes(newStatus);
}

function validateTradeDecliner(trade: Trade, declinedById: string) {
    return trade.tradeParticipants?.flatMap(tp => tp.team.owners?.map(u => u.id) || []).includes(declinedById);
}

@JsonController("/trades")
export default class TradeController {
    // TODO: Endpoints for "accepted"/"rejected" trade, for "submitTrade/sendToSlack"
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
    public async getOneTrade(@Param("id") id: string, @QueryParam("hydrated") hydrated?: boolean): Promise<Trade> {
        logger.debug(`get one trade endpoint. hydrated? ${hydrated}`);
        let trade = await this.dao.getTradeById(id);
        if (hydrated) {
            trade = await this.dao.hydrateTrade(trade);
        }
        logger.debug(`got trade: ${trade}`);
        return trade;
    }

    @Post("/")
    public async createTrade(@CurrentUser({ required: true }) user: User, @Body() tradeObj: Partial<Trade>): Promise<Trade> {
        logger.debug("create trade endpoint");
        if (tradeObj.status && ![TradeStatus.DRAFT, TradeStatus.REQUESTED].includes(tradeObj.status) && !user.isAdmin()) {
            // if a non-admin tries to create a new trade with a non-initial status, throw an error.
            throw new BadRequestError("You cannot create a trade that is not a draft or trade request");
        }
        const trade = await this.dao.createTrade(tradeObj);
        logger.debug(`created trade: ${inspect(trade)}`);
        return trade;
    }

    @Put(UUIDPattern)
    public async updateTrade(@CurrentUser({ required: true }) user: User, @Param("id") id: string, @Body() tradeObj: Partial<Trade>): Promise<Trade|undefined> {
        const existingTrade = await this.dao.getTradeById(id);

        // Only trade participants can make updates to the trade.
        if (validateParticipantInTrade(user, existingTrade)) {
            logger.info("update trade endpoint");
            let trade: Trade|undefined;

            if (tradeObj.status && validateStatusChange(user, existingTrade, tradeObj.status)) {
                logger.debug("updating trade status");
                trade = await this.dao.updateStatus(id, tradeObj.status);
            }

            if (tradeObj.declinedById && validateTradeDecliner(existingTrade, tradeObj.declinedById)) {
                logger.debug("updating trade participants");
                trade = await this.dao.updateDeclinedBy(id, tradeObj.declinedById, tradeObj.declinedReason);
            }

            // only owner can actually edit the contents of the trade for now
            // trade contents can only be edited in draft mode
            if (existingTrade.status === TradeStatus.DRAFT && validateOwnerOfTrade(user, existingTrade) && (tradeObj.tradeItems || tradeObj.tradeParticipants)) {
                if (tradeObj.tradeItems ?? tradeObj.tradeItems!.length) {
                    logger.debug(`EXISTING ITEMS: ${inspect(existingTrade.tradeItems)}`);
                    logger.debug(`NEW ITEMS: ${inspect(tradeObj.tradeItems)}`);
                    const itemsToAdd = differenceBy(
                        (tradeObj.tradeItems || []),
                        (existingTrade.tradeItems || []),
                        "tradeItemId");
                    const itemsToRemove = differenceBy(
                        (existingTrade.tradeItems || []),
                        (tradeObj.tradeItems || []),
                        "tradeItemId");
                    trade = await this.dao.updateItems(id, itemsToAdd, itemsToRemove);
                }

                if (tradeObj.tradeParticipants ?? tradeObj.tradeParticipants!.length) {
                    logger.debug(`EXISTING PARTICIPANTS: ${inspect(existingTrade.tradeParticipants)}`);
                    logger.debug(`NEW PARTICIPANTS: ${inspect(tradeObj.tradeParticipants)}`);
                    const participantsToAdd = differenceBy(
                        (tradeObj.tradeParticipants || []),
                        (existingTrade.tradeParticipants || []),
                        (participant: TradeParticipant) => `${participant.participantType}|${participant.team.id}`);
                    const participantsToRemove = differenceBy(
                        (existingTrade.tradeParticipants || []),
                        (tradeObj.tradeParticipants || []),
                        (participant: TradeParticipant) => `${participant.participantType}|${participant.team.id}`);
                    trade = await this.dao.updateParticipants(id, participantsToAdd, participantsToRemove);
                }
            }
            return trade;
        } else {
            throw new UnauthorizedError("Trade can only be modified by participants or admins");
        }
    }

    @Authorized(Role.ADMIN)
    @Delete(UUIDPattern)
    public async deleteTrade(@Param("id") id: string) {
        logger.debug("delete trade endpoint");
        const result = await this.dao.deleteTrade(id);
        logger.debug(`delete successful: ${inspect(result)}`);
        return {deleteCount: result.affected, id: result.raw[0].id};
    }
}
