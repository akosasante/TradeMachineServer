import { Authorized, BadRequestError, Controller, Param, Post, Res } from "routing-controllers";
import { EmailPublisher } from "../../email/publishers";
import { UUIDPattern } from "../helpers/ApiHelpers";
import logger from "../../bootstrap/logger";
import TradeDAO from "../../DAO/TradeDAO";
import { Response } from "express";
import { Role } from "../../models/user";
import { TradeStatus } from "../../models/trade";
import { SlackPublisher } from "../../slack/publishers";
import { rollbar } from "../../bootstrap/rollbar";

@Controller("/messenger")
export default class MessengerController {
    private emailPublisher: EmailPublisher;
    private slackPublisher: SlackPublisher;
    private tradeDao: TradeDAO;

    constructor(publisher?: EmailPublisher, tradeDao?: TradeDAO, slackPublisher?: SlackPublisher) {
        this.emailPublisher = publisher || EmailPublisher.getInstance();
        this.tradeDao = tradeDao || new TradeDAO();
        this.slackPublisher = slackPublisher || SlackPublisher.getInstance();
    }

    @Post(`/requestTrade${UUIDPattern}`)
    public async sendRequestTradeMessage(@Param("id") id: string, @Res() response: Response) {
        rollbar.info("sendRequestTradeMessage", { id });
        logger.debug(`queuing trade request email for tradeId: ${id}`);
        let trade = await this.tradeDao.getTradeById(id);
        if (trade.status === TradeStatus.REQUESTED) {
            trade = await this.tradeDao.hydrateTrade(trade);
            const recipientEmails = trade.recipients.flatMap(recipTeam => recipTeam.owners?.map(owner => owner.email));
            for (const email of recipientEmails) {
                if (email) {
                    await this.emailPublisher.queueTradeRequestMail(trade, email);
                }
            }
            return response.status(202).json({status: "trade request queued"});
        } else {
            throw new BadRequestError("Cannot send trade request for this trade based on its status");
        }
    }

    @Post(`/declineTrade${UUIDPattern}`)
    public async sendTradeDeclineMessage(@Param("id") id: string, @Res() response: Response) {
        rollbar.info("sendTradeDeclineMessage", { id });
        logger.debug(`queueing trade declined email for tradeId: ${id}`);
        let trade = await this.tradeDao.getTradeById(id);
        if (trade.status === TradeStatus.REJECTED && trade.declinedById) {
            trade = await this.tradeDao.hydrateTrade(trade);
            const emails = trade.tradeParticipants
                ?.flatMap(tp => tp.team.owners)
                .filter(owner => owner && owner.id !== trade.declinedById)
                .map(owner => owner?.email);
            for (const email of (emails || [])) {
                if (email) {
                    await this.emailPublisher.queueTradeDeclinedMail(trade, email);
                }
            }
            return response.status(202).json({status: "trade decline email queued"});
        } else {
            throw new BadRequestError("Cannot send trade decline email for this trade based on its status");
        }
    }

    @Post(`/acceptTrade${UUIDPattern}`)
    public async sendTradeAcceptanceMessage(@Param("id") id: string, @Res() response: Response) {
        rollbar.info("sendTradeAcceptanceMessage", { id });
        logger.debug(`queueing trade acceptance email for tradeId: ${id}`);
        let trade = await this.tradeDao.getTradeById(id);
        if (trade.status === TradeStatus.ACCEPTED) {
            trade = await this.tradeDao.hydrateTrade(trade);
            const creatorEmails = trade.creator?.owners?.map(o => o.email);
            if (creatorEmails) {
                for (const email of creatorEmails) {
                    await this.emailPublisher.queueTradeAcceptedMail(trade, email);
                }
            }
            return response.status(202).json({status: "trade acceptance email queued"});
        } else {
            throw new BadRequestError("Cannot send trade acceptance email for this trade based on its status");
        }
    }

    @Post(`/submitTrade${UUIDPattern}`)
    public async sendTradeAnnouncementMessage(@Param("id") id: string, @Res() response: Response) {
        logger.debug(`queuing trade announcement slack message for tradeId: ${id}`);
        rollbar.info("sendTradeAnnouncementMessage", { id });
        let trade = await this.tradeDao.getTradeById(id);
        if (trade.status === TradeStatus.SUBMITTED) {
            trade = await this.tradeDao.hydrateTrade(trade);
            await this.slackPublisher.queueTradeAnnouncement(trade);
            return response.status(202).json({status: "accepted trade announcement queued"});
        } else {
            throw new BadRequestError("Cannot send trade announcement for this trade based on its status");
        }
    }
}
