import { differenceBy } from "lodash";
import { Authorized, BadRequestError, Body, BodyParam, CurrentUser, Delete, Get,
    JsonController, Param, Post, Put, QueryParam, UnauthorizedError } from "routing-controllers";
import { inspect } from "util";
import logger from "../../bootstrap/logger";
import TradeDAO from "../../DAO/TradeDAO";
import Trade, { TradeStatus } from "../../models/trade";
import User, { Role } from "../../models/user";
import { UUIDPattern } from "../helpers/ApiHelpers";
import TradeParticipant from "../../models/tradeParticipant";
import { appendNewTrade } from "../../csv/TradeTracker";
import { V1TradeMachineAdaptor } from "../helpers/V1TradeMachineAdaptor";
import { EmailPublisher } from "../../email/publishers";

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
        [TradeStatus.SUBMITTED]: [],
    };

    const validChangesForOwner = {
        ...validChangesForParticipants,
        [TradeStatus.DRAFT]: [TradeStatus.REQUESTED],
        [TradeStatus.ACCEPTED]: [TradeStatus.SUBMITTED],
    };

    const checkForValidity: TradeStateMachine = validateOwnerOfTrade(user, trade) ? validChangesForOwner : validChangesForParticipants;

    return checkForValidity[trade.status!].includes(newStatus);
}

function validateTradeDecliner(trade: Trade, declinedById: string) {
    return trade.tradeParticipants?.flatMap(tp => tp.team.owners?.map(u => u.id) || []).includes(declinedById);
}

@JsonController("/trades")
export default class TradeController {
    private dao: TradeDAO;
    private emailPublisher: EmailPublisher;

    constructor(DAO?: TradeDAO, publisher?: EmailPublisher) {
        this.dao = DAO || new TradeDAO();
        this.emailPublisher = publisher || EmailPublisher.getInstance();
    }

    @Get("/")
    public async getAllTrades( @QueryParam("hydrated") hydrated?: boolean): Promise<Trade[]> {
        logger.debug("get all trades endpoint");
        const trades = await this.dao.getAllTrades();
        logger.debug(`got ${trades.length} trades`);
        if (hydrated) {
            return await Promise.all(trades.map(t => this.dao.hydrateTrade(t)));
        } else {
            return trades;
        }
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
        const hydratedTrade = await this.dao.hydrateTrade(trade);
        await appendNewTrade(hydratedTrade);
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
                logger.debug("updating trade declined");
                trade = await this.dao.updateDeclinedBy(id, tradeObj.declinedById, tradeObj.declinedReason);
            }

            // only owner can actually edit the contents of the trade for now
            // trade contents can only be edited in draft mode
            if (existingTrade.status === TradeStatus.DRAFT && validateOwnerOfTrade(user, existingTrade) && (tradeObj.tradeItems || tradeObj.tradeParticipants)) {
                logger.debug("update trade participants");
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
            logger.debug("Trade was invalid");
            throw new UnauthorizedError("Trade can only be modified by participants or admins");
        }
    }

    @Put(`${UUIDPattern}/accept`)
    public async acceptTrade(@CurrentUser({ required: true }) user: User, @Param("id") id: string) {
        logger.debug("accept trade endpoint");
        let trade = await this.dao.getTradeById(id);

        if (!validateParticipantInTrade(user, trade)) {
            throw new UnauthorizedError("Trade can only be modified by participants or admins");
        }

        if (!validateStatusChange(user, trade, TradeStatus.ACCEPTED)) {
            throw new BadRequestError("Trade with this status cannot be accepted");
        }

        const acceptedBy = [...(trade.acceptedBy || []), user.id!];
        await this.dao.updateAcceptedBy(id, acceptedBy);

        if (acceptedBy.length === trade.recipients.length) {
            trade = await this.dao.updateStatus(id, TradeStatus.ACCEPTED);
        } else if (trade.status !== TradeStatus.PENDING) {
            trade = await this.dao.updateStatus(id, TradeStatus.PENDING);
        }

        return trade;
    }

    @Put(`${UUIDPattern}/reject`)
    public async rejectTrade(@CurrentUser({ required: true }) user: User, @Param("id") id: string,
                             @BodyParam("declinedById") declinedBy: string, @BodyParam("declinedReason") reason: string) {
        logger.debug("reject trade endpoint");
        const trade = await this.dao.getTradeById(id);

        if (!validateParticipantInTrade(user, trade)) {
            throw new UnauthorizedError("Trade can only be modified by participants or admins");
        }

        if (!validateStatusChange(user, trade, TradeStatus.REJECTED)) {
            throw new BadRequestError("Trade with this status cannot be rejected");
        }

        logger.debug("updating trade declined");
        await this.dao.updateDeclinedBy(id, declinedBy, reason);

        return await this.dao.updateStatus(id, TradeStatus.REJECTED);
    }

    @Put(`${UUIDPattern}/submit`)
    public async submitTrade(@CurrentUser({ required: true }) user: User, @Param("id") id: string) {
        logger.debug("submit trade endpoint");
        const trade = await this.dao.getTradeById(id);

        if (!validateParticipantInTrade(user, trade)) {
            throw new UnauthorizedError("Trade can only be modified by participants or admins");
        }

        if (!validateStatusChange(user, trade, TradeStatus.SUBMITTED)) {
            throw new BadRequestError("Trade with this status cannot be submitted");
        }

        return await this.dao.updateStatus(id, TradeStatus.SUBMITTED);
    }

    @Authorized(Role.ADMIN)
    @Delete(UUIDPattern)
    public async deleteTrade(@Param("id") id: string) {
        logger.debug("delete trade endpoint");
        const result = await this.dao.deleteTrade(id);
        logger.debug(`delete successful: ${inspect(result)}`);
        return {deleteCount: result.affected, id: result.raw[0].id};
    }

    /***** Old Trade Machine Endpoints *****/
    @Post("/v1/submit")
    public async v1RequestTrade(@Body() payload: any): Promise<boolean> {
        logger.debug(`got payload from old trade machine: ${inspect(payload)}`);
        let trade = await V1TradeMachineAdaptor.init().getTrade(payload);
        trade.status = TradeStatus.REQUESTED;
        logger.debug(`adapted trade from payload: ${inspect(trade, false, 2)}`);
        trade = await this.dao.createTrade(trade);
        logger.debug(`saved trade with status: ${trade.status}`);
        trade = await this.dao.hydrateTrade(trade);
        logger.debug("hydrated trade");
        // copied from MessengerController
        const recipientEmails = trade.recipients.flatMap(recipTeam => recipTeam.owners?.map(owner => owner.email));
        for (const email of recipientEmails) {
            if (email) {
                await this.emailPublisher.queueTradeRequestMail(trade, email, false);
            }
        }
        return true;
    }

    @Post(`/v1/reject${UUIDPattern}`)
    public async rejectV1Trade(@Param("id") id: string, @BodyParam("recip") declinerEmailPrefix: string, @BodyParam("reason") declineReason: string) {
        logger.debug("got reject trade request from old trade machine");
        let trade = await this.dao.getTradeById(id);
        const decliningUser = trade.tradeParticipants!.reduce((acc: User | undefined, participant) => {
            if (acc) return acc;
            const matchingUser = participant.team.owners!.find(o => o.email.startsWith(declinerEmailPrefix));
            return matchingUser ? matchingUser : acc;
        }, undefined);

        if (decliningUser) {
            logger.debug(`retrieved declining user: ${decliningUser}`);
            if (!validateParticipantInTrade(decliningUser, trade)) {
                throw new UnauthorizedError("Trade can only be modified by participants or admins");
            }

            if (!validateStatusChange(decliningUser, trade, TradeStatus.REJECTED)) {
                throw new BadRequestError("Trade with this status cannot be rejected");
            }

            logger.debug("updating trade declined");
            await this.dao.updateDeclinedBy(id, decliningUser.id!, declineReason);
            trade = await this.dao.updateStatus(id, TradeStatus.REJECTED);
            // send email(s)
            logger.debug("sending trade decline email(s)");
            trade = await this.dao.hydrateTrade(trade);
            const emails = trade.tradeParticipants
                ?.flatMap(tp => tp.team.owners)
                .filter(owner => owner && owner.id !== trade.declinedById)
                .map(owner => owner?.email);
            for (const email of (emails || [])) {
                if (email) {
                    await this.emailPublisher.queueTradeDeclinedMail(trade, email);
                }
            }
            return true;
        } else {
            return false;
        }
    }

    @Post(`/v1/accept${UUIDPattern}`)
    public async acceptV1Trade(@Param("id") id: string, @BodyParam("recip") acceptorEmailPrefix: string) {
        logger.debug("got accept trade request from old trade machine");
        let trade = await this.dao.getTradeById(id);
        const acceptingUser = trade.tradeParticipants!.reduce((acc: User | undefined, participant) => {
            if (acc) return acc;
            const matchingUser = participant.team.owners!.find(o => o.email.startsWith(acceptorEmailPrefix));
            return matchingUser ? matchingUser : acc;
        }, undefined);

        if (!acceptingUser) return false;

        if (!validateParticipantInTrade(acceptingUser, trade)) {
            throw new UnauthorizedError("Trade can only be modified by participants or admins");
        }

        if (!validateStatusChange(acceptingUser, trade, TradeStatus.ACCEPTED)) {
            throw new BadRequestError("Trade with this status cannot be accepted");
        }

        const acceptedBy = [...(trade.acceptedBy || []), acceptingUser.id!];
        await this.dao.updateAcceptedBy(id, acceptedBy);

        if (acceptedBy.length === trade.recipients.length) {
            trade = await this.dao.updateStatus(id, TradeStatus.ACCEPTED);
        } else if (trade.status !== TradeStatus.PENDING) {
            trade = await this.dao.updateStatus(id, TradeStatus.PENDING);
        }

        // send email(s)
        logger.debug("sending trade accept email(s)");
        trade = await this.dao.hydrateTrade(trade);
        const creatorEmails = trade.creator?.owners?.map(o => o.email);
        if (creatorEmails) {
            for (const email of creatorEmails) {
                await this.emailPublisher.queueTradeAcceptedMail(trade, email);
            }
        }

        return true;
    }

    @Get(`/v1${UUIDPattern}`)
    public async getTradeForV1(@Param("id") id: string) {
        logger.debug("v1 get trade endpoint with id: " + id);
        let trade = await this.dao.getTradeById(id);
        trade = await this.dao.hydrateTrade(trade);
        logger.debug(`got trade: ${trade}`);
        const v1Trade = V1TradeMachineAdaptor.convertToV1Trade(trade);
        logger.debug(`converted to v1 trade: ${inspect(v1Trade)}`);
        return v1Trade;
    }
}
