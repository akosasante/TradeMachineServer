import User from "./src/models/user";
import logger from "./src/bootstrap/logger";
import { inspect } from "util";
import { Emailer } from "./src/email/mailer";
import initializeDb from "./src/bootstrap/db";
import TradeDAO from "./src/DAO/TradeDAO";
import { TradeItemType } from "./src/models/tradeItem";
import DraftPickDAO from "./src/DAO/DraftPickDAO";
import PlayerDAO from "./src/DAO/PlayerDAO";

async function test() {
    const mailer = Emailer;
    const user = new User({displayName: "Akosua", email: "tripleabatt@gmail.com"});
    logger.info("BEFORE");
    const res = await mailer.sendTestEmail(user);
    logger.info(`RESULT: ${inspect(res)}`);
}
async function testTrade() {
    const args = process.argv.slice(2);
    const mailer = Emailer;
    await initializeDb(true);
    const tradeDao = new TradeDAO();
    const pickDao = new DraftPickDAO();
    const playerDao = new PlayerDAO();
    const trade = await tradeDao.getTradeById(args[0] || "66dee0a9-6b46-4e8f-aad4-2eca044f69db");
    for (const item of trade.tradeItems || []) {
        if (item.tradeItemType === TradeItemType.PICK) {
            item.entity = await pickDao.getPickById(item.tradeItemId!);
        } else {
            item.entity = await playerDao.getPlayerById(item.tradeItemId!);
        }
    }
    return await mailer.sendTradeRequestEmail(trade);
}
testTrade()
    .then(res => {
        logger.info(`RESULT: ${inspect(res)}`);
        process.exit(0);
    })
    .catch(err => {
        logger.error(inspect(err));
        process.exit(999);
    });
// test();
