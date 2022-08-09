import { differenceBy } from "lodash";
import {
    Authorized,
    BadRequestError,
    Body,
    BodyParam,
    CurrentUser,
    Delete,
    Get,
    JsonController,
    Param,
    Post,
    Put,
    QueryParam,
    Req,
    UnauthorizedError,
} from "routing-controllers";
import { inspect } from "util";
import logger from "../../bootstrap/logger";
import TradeDAO from "../../DAO/TradeDAO";
import Trade, { TradeStatus } from "../../models/trade";
import User, { Role } from "../../models/user";
import { UUID_PATTERN } from "../helpers/ApiHelpers";
import TradeParticipant from "../../models/tradeParticipant";
import { HydratedTrade } from "../../models/views/hydratedTrades";
import { appendNewTrade } from "../../csv/TradeTracker";
import { EmailPublisher } from "../../email/publishers";
import { SlackPublisher } from "../../slack/publishers";
import { rollbar } from "../../bootstrap/rollbar";
import { Request } from "express";

function validateOwnerOfTrade(user: User, trade: Trade): boolean {
    if (user.role === Role.ADMIN) {
        return true;
    } else {
        const belongsToUser = trade.creator?.owners?.map(u => u.id).includes(user.id);
        logger.debug(`${trade} belongs to ${user}? = ${belongsToUser}`);
        return belongsToUser || false;
    }
}
function validateRecipientOfTrade(user: User, trade: Trade): boolean {
    if (user.role === Role.ADMIN) {
        return true;
    } else {
        const belongsToUser = trade.recipients
            ?.flatMap(recipientTeam => recipientTeam.owners?.map(u => u.id))
            .includes(user.id);
        logger.debug(`${user} is a recipient of ${trade}? = ${belongsToUser}`);
        return belongsToUser || false;
    }
}

function validateParticipantInTrade(user: User, trade: Trade): boolean {
    if (user.role === Role.ADMIN) {
        return true;
    } else {
        const belongsToUser = (trade.tradeParticipants?.flatMap(tp => tp.team.owners?.map(u => u.id)) || []).includes(
            user.id
        );
        logger.debug(`Trade (${trade} belongs to ${user}? = ${belongsToUser}`);
        return belongsToUser || false;
    }
}

function validateStatusChange(user: User, trade: Trade, newStatus: TradeStatus): boolean {
    type TradeStateMachine = {
        [old in TradeStatus]: TradeStatus[];
    };

    if (trade.status === newStatus) return false;
    // TODO: Consider whether we want a separate role for LeagueAdmin and/or whether this check should only be allowed for env var admin override
    if (user.isAdmin() || process.env.ADMIN_OVERRIDE === "true") return true;

    const validChangesForParticipants = {
        [TradeStatus.DRAFT]: [],
        [TradeStatus.REQUESTED]: [TradeStatus.PENDING, TradeStatus.ACCEPTED, TradeStatus.REJECTED],
        [TradeStatus.PENDING]: [TradeStatus.ACCEPTED, TradeStatus.REJECTED],
        [TradeStatus.ACCEPTED]: [],
        [TradeStatus.REJECTED]: [],
        [TradeStatus.SUBMITTED]: [],
    };

    const validChangesForOwner = {
        ...validChangesForParticipants,
        [TradeStatus.DRAFT]: [TradeStatus.REQUESTED],
        [TradeStatus.ACCEPTED]: [TradeStatus.SUBMITTED],
    };

    const checkForValidity: TradeStateMachine = validateOwnerOfTrade(user, trade)
        ? validChangesForOwner
        : validChangesForParticipants;

    return checkForValidity[trade.status!].includes(newStatus);
}

function validateTradeDecliner(trade: Trade, declinedById: string) {
    return trade.tradeParticipants?.flatMap(tp => tp.team.owners?.map(u => u.id) || []).includes(declinedById);
}

function allRecipientTeamsAccepted(acceptedBy: string[], trade: Trade): boolean {
    const numberOfRecipientTeams = (trade.recipients || []).length;
    const acceptedTeams = (trade.recipients || []).reduce((totalNumTeams, recipientTeam) => {
        const recipientTeamOwnerIds = (recipientTeam.owners || []).map(u => u.id!);
        if (recipientTeamOwnerIds.some(recipientUserId => acceptedBy.includes(recipientUserId))) {
            return totalNumTeams + 1;
        } else {
            return totalNumTeams;
        }
    }, 0);

    return numberOfRecipientTeams === acceptedTeams;
}

async function acceptTradeIfValid(dao: TradeDAO, acceptingUser: User, trade: Trade): Promise<string[]> {
    if (!validateRecipientOfTrade(acceptingUser, trade)) {
        throw new UnauthorizedError("Trade can only be accepted by recipients or admins");
    }

    if (!validateStatusChange(acceptingUser, trade, TradeStatus.ACCEPTED)) {
        throw new BadRequestError(
            `Trade with this status (${trade.status ? TradeStatus[trade.status] : "undefined"}) cannot be accepted`
        );
    }

    if ((trade.acceptedBy || []).includes(acceptingUser.id || "")) {
        throw new BadRequestError(
            `Trade (${trade.id}) already has accepting user: ${acceptingUser.id} ${acceptingUser.displayName}`
        );
    }

    const acceptedBy = [...(trade.acceptedBy || []), acceptingUser.id!];
    await dao.updateAcceptedBy(trade.id!, acceptedBy);
    return acceptedBy;
}

@JsonController("/trades")
export default class TradeController {
    private readonly dao: TradeDAO;

    constructor(dao?: TradeDAO) {
        this.dao = dao || new TradeDAO();
    }

    @Get("/")
    public async getAllTrades(
        @QueryParam("hydrated") hydrated?: boolean,
        @QueryParam("pageSize") pageSize?: number,
        @QueryParam("pageNumber") pageNumber?: number,
        @QueryParam("statuses") statuses?: TradeStatus[],
        @QueryParam("includesTeam") includeTeam?: string,
        @Req() request?: Request
    ): Promise<Trade[] | HydratedTrade[]> {
        logger.debug(`get all trades endpoint; ${inspect({ hydrated, pageSize, pageNumber, statuses, includeTeam })}`);
        rollbar.info("getAllTrades", { hydrated, pageSize, pageNumber, statuses, includeTeam }, request);
        if (hydrated) {
            const hydratedTrades = await this.dao.returnHydratedTrades(statuses, includeTeam, pageSize, pageNumber);
            logger.debug(`got ${hydratedTrades.length} hydrated trades`);
            return hydratedTrades;
        } else {
            const trades = await this.dao.getAllTrades();
            logger.debug(`got ${trades.length} trades`);
            return trades;
        }
    }

    @Get(UUID_PATTERN)
    public async getOneTrade(
        @Param("id") id: string,
        @QueryParam("hydrated") hydrated?: boolean,
        @Req() request?: Request
    ): Promise<Trade> {
        logger.debug(`get one trade endpoint. hydrated? ${hydrated}`);
        rollbar.info("getOneTrade", { tradeId: id, hydrated }, request);
        let trade = await this.dao.getTradeById(id);
        if (hydrated) {
            trade = await this.dao.hydrateTrade(trade);
        }
        logger.debug(`got trade: ${trade}`);
        return trade;
    }

    @Post("/")
    public async createTrade(
        @CurrentUser({ required: true }) user: User,
        @Body() tradeObj: Partial<Trade>,
        @Req() request?: Request
    ): Promise<Trade> {
        logger.debug("create trade endpoint");
        rollbar.info("createTrade", { trade: tradeObj }, request);
        if (
            tradeObj.status &&
            ![TradeStatus.DRAFT, TradeStatus.REQUESTED].includes(tradeObj.status) &&
            !user.isAdmin()
        ) {
            // if a non-admin tries to create a new trade with a non-initial status, throw an error.
            throw new BadRequestError("You cannot create a trade that is not a draft or trade request");
        }
        const trade = await this.dao.createTrade(tradeObj);
        logger.debug(`created trade: ${inspect(trade)}`);
        return trade;
    }

    @Put(UUID_PATTERN)
    public async updateTrade(
        @CurrentUser({ required: true }) user: User,
        @Param("id") id: string,
        @Body() tradeObj: Partial<Trade>,
        @Req() request?: Request
    ): Promise<Trade | undefined> {
        rollbar.info("updateTrade", { trade: tradeObj }, request);
        const existingTrade = await this.dao.getTradeById(id);

        // Only trade participants can make updates to the trade.
        if (validateParticipantInTrade(user, existingTrade)) {
            logger.info("update trade endpoint");
            let trade: Trade | undefined;

            if (tradeObj.status && validateStatusChange(user, existingTrade, tradeObj.status)) {
                logger.debug("updating trade status");
                trade = await this.dao.updateStatus(id, tradeObj.status);
            }

            if (tradeObj.declinedById && validateTradeDecliner(existingTrade, tradeObj.declinedById)) {
                logger.debug("updating trade declined");
                trade = await this.dao.updateDeclinedBy(id, tradeObj.declinedById, tradeObj.declinedReason);
            }

            // only owner can actually edit the contents of the trade for now
            // trade contents can only be edited in draft mode
            if (
                existingTrade.status === TradeStatus.DRAFT &&
                validateOwnerOfTrade(user, existingTrade) &&
                (tradeObj.tradeItems || tradeObj.tradeParticipants)
            ) {
                logger.debug("update trade participants");
                if (tradeObj.tradeItems ?? tradeObj.tradeItems!.length) {
                    logger.debug(`EXISTING ITEMS: ${inspect(existingTrade.tradeItems)}`);
                    logger.debug(`NEW ITEMS: ${inspect(tradeObj.tradeItems)}`);
                    const itemsToAdd = differenceBy(
                        tradeObj.tradeItems || [],
                        existingTrade.tradeItems || [],
                        "tradeItemId"
                    );
                    const itemsToRemove = differenceBy(
                        existingTrade.tradeItems || [],
                        tradeObj.tradeItems || [],
                        "tradeItemId"
                    );
                    trade = await this.dao.updateItems(id, itemsToAdd, itemsToRemove);
                }

                if (tradeObj.tradeParticipants ?? tradeObj.tradeParticipants!.length) {
                    logger.debug(`EXISTING PARTICIPANTS: ${inspect(existingTrade.tradeParticipants)}`);
                    logger.debug(`NEW PARTICIPANTS: ${inspect(tradeObj.tradeParticipants)}`);
                    const participantsToAdd = differenceBy(
                        tradeObj.tradeParticipants || [],
                        existingTrade.tradeParticipants || [],
                        (participant: TradeParticipant) => `${participant.participantType}|${participant.team.id}`
                    );
                    const participantsToRemove = differenceBy(
                        existingTrade.tradeParticipants || [],
                        tradeObj.tradeParticipants || [],
                        (participant: TradeParticipant) => `${participant.participantType}|${participant.team.id}`
                    );
                    trade = await this.dao.updateParticipants(id, participantsToAdd, participantsToRemove);
                }
            }
            return trade;
        } else {
            logger.debug("Trade was invalid");
            throw new UnauthorizedError("Trade can only be modified by participants or admins");
        }
    }

    @Put(`${UUID_PATTERN}/accept`)
    public async acceptTrade(
        @CurrentUser({ required: true }) user: User,
        @Param("id") id: string,
        @Req() request?: Request
    ): Promise<Trade> {
        rollbar.info("acceptTrade", { tradeId: id }, request);
        logger.debug("accept trade endpoint");
        let trade = await this.dao.getTradeById(id);

        const acceptedBy = await acceptTradeIfValid(this.dao, user, trade);

        if (allRecipientTeamsAccepted(acceptedBy, trade)) {
            trade = await this.dao.updateStatus(id, TradeStatus.ACCEPTED);
        } else if (trade.status !== TradeStatus.PENDING) {
            trade = await this.dao.updateStatus(id, TradeStatus.PENDING);
        }

        return trade;
    }

    @Put(`${UUID_PATTERN}/reject`)
    public async rejectTrade(
        @CurrentUser({ required: true }) user: User,
        @Param("id") id: string,
        @BodyParam("declinedById") declinedBy: string,
        @BodyParam("declinedReason") reason: string,
        @Req() request?: Request
    ): Promise<Trade> {
        rollbar.info("rejectTrade", { declinedBy, reason }, request);
        logger.debug("reject trade endpoint");
        const trade = await this.dao.getTradeById(id);

        if (!validateRecipientOfTrade(user, trade)) {
            throw new UnauthorizedError("Trade can only be rejected by recipients or admins");
        }

        if (!validateStatusChange(user, trade, TradeStatus.REJECTED)) {
            throw new BadRequestError(
                `Trade with this status (${trade.status ? TradeStatus[trade.status] : "undefined"})  cannot be rejected`
            );
        }

        logger.debug("updating trade declined");
        await this.dao.updateDeclinedBy(id, declinedBy, reason);

        return await this.dao.updateStatus(id, TradeStatus.REJECTED);
    }

    @Put(`${UUID_PATTERN}/submit`)
    public async submitTrade(
        @CurrentUser({ required: true }) user: User,
        @Param("id") id: string,
        @Req() request?: Request
    ): Promise<Trade> {
        rollbar.info("submitTrade", { tradeId: id }, request);
        logger.debug("submit trade endpoint");
        const trade = await this.dao.getTradeById(id);

        if (!validateOwnerOfTrade(user, trade)) {
            throw new UnauthorizedError("Trade can only be submitted by the trade owner or admins");
        }

        if (!validateStatusChange(user, trade, TradeStatus.SUBMITTED)) {
            throw new BadRequestError(
                `Trade with this status (${
                    trade.status ? TradeStatus[trade.status] : "undefined"
                })  cannot be submitted`
            );
        }

        const hydratedTrade = await this.dao.hydrateTrade(trade);
        await appendNewTrade(hydratedTrade);
        return await this.dao.updateStatus(id, TradeStatus.SUBMITTED);
    }

    @Authorized(Role.ADMIN)
    @Delete(UUID_PATTERN)
    public async deleteTrade(
        @Param("id") id: string,
        @Req() request?: Request
    ): Promise<{ deleteCount: number | null | undefined; id: any }> {
        rollbar.info("deleteTrade", { tradeId: id }, request);
        logger.debug("delete trade endpoint");
        const result = await this.dao.deleteTrade(id);
        logger.debug(`delete successful: ${inspect(result)}`);
        return { deleteCount: result.affected, id: result.raw[0].id };
    }
}
