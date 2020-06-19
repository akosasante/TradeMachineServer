import { Authorized, BadRequestError, Controller, Param, Post, Res } from "routing-controllers";
import { EmailPublisher } from "../../email/publishers";
import { UUIDPattern } from "../helpers/ApiHelpers";
import logger from "../../bootstrap/logger";
import TradeDAO from "../../DAO/TradeDAO";
import { Response } from "express";
import { Role } from "../../models/user";
import { TradeStatus } from "../../models/trade";

@Controller("/messenger")
export default class MessengerController {
    private emailPublisher: EmailPublisher;
    private tradeDao: TradeDAO;

    constructor(publisher?: EmailPublisher, tradeDao?: TradeDAO) {
        this.emailPublisher = publisher || EmailPublisher.getInstance();
        this.tradeDao = tradeDao || new TradeDAO();
    }
    @Authorized(Role.OWNER)
    @Post(`/requestTrade${UUIDPattern}`)
    public async sendRequestTradeMessage(@Param("id") id: string, @Res() response: Response) {
        logger.debug(`queuing trade request email for tradeId: ${id}`);
        let trade = await this.tradeDao.getTradeById(id);
        if (trade.status === TradeStatus.PENDING) {
            trade = await this.tradeDao.hydrateTrade(trade);
            await this.emailPublisher.queueTradeRequestMail(trade);
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

    @Post("/submitTrade")
    public async sendTradeAnnouncementMessage() {
        //
    }
}
