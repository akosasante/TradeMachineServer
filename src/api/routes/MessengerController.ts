import {Controller, Post} from "routing-controllers";

@Controller("/messenger")
export default class MessengerController {
    constructor() {
        //
    }

    @Post("/requestTrade")
    public async sendRequestTradeMessage() {
        //
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
