import { Authorized, BadRequestError, Controller, Param, Post, Res } from "routing-controllers";
import { EmailPublisher } from "../../email/publishers";
import { UUIDPattern } from "../helpers/ApiHelpers";
import logger from "../../bootstrap/logger";
import TradeDAO from "../../DAO/TradeDAO";
import { Response } from "express";
import { Role } from "../../models/user";
import { TradeStatus } from "../../models/trade";
import { SlackPublisher } from "../../slack/publishers";

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
    @Authorized(Role.OWNER)
    @Post(`/requestTrade${UUIDPattern}`)
    public async sendRequestTradeMessage(@Param("id") id: string, @Res() response: Response) {
        logger.debug(`queuing trade request email for tradeId: ${id}`);
        let trade = await this.tradeDao.getTradeById(id);
        if (trade.status === TradeStatus.PENDING) {
            trade = await this.tradeDao.hydrateTrade(trade);
            const recipientEmails = trade.recipients.flatMap(recipTeam => recipTeam.owners?.map(owner => owner.email));
            for (const email of recipientEmails) {
                await this.emailPublisher.queueTradeRequestMail(trade, email!);
            }
            return response.status(202).json({status: "trade request queued"});
        } else {
            throw new BadRequestError("Cannot send trade request for this trade based on its status");
        }
    }

    @Post("/acceptTrade")
    public async sendTradeAcceptMessage() {
        //
    }

    @Post("/declineTrade")
    public async sendTradeDeclineMessage() {
        //
    }

    @Post(`/submitTrade${UUIDPattern}`)
    public async sendTradeAnnouncementMessage(@Param("id") id: string, @Res() response: Response) {
        logger.debug(`queuing trade announcement slack message for tradeId: ${id}`);
        let trade = await this.tradeDao.getTradeById(id);
        if (trade.status === TradeStatus.ACCEPTED) {
            trade = await this.tradeDao.hydrateTrade(trade);
            await this.slackPublisher.queueTradeAnnouncement(trade);
            return response.status(202).json({status: "accepted trade announcement queued"});
        } else {
            throw new BadRequestError("Cannot send trade announcement for this trade based on its status");
        }
    }
}
