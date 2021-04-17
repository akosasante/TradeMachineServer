/* eslint-disable */
import initializeDb from "../bootstrap/db";
import TradeDAO from "../DAO/TradeDAO";
import { SlackTradeAnnouncer } from "../slack/tradeAnnouncer";

async function run() {
    const args = process.argv.slice(2);
    await initializeDb(true);
    const tradeDao = new TradeDAO();
    const trade = await tradeDao.getTradeById(
        args[0] || "66dee0a9-6b46-4e8f-aad4-2eca044f69db"
    );
    // console.dir(trade);
    return SlackTradeAnnouncer.sendTradeAnnouncement(trade);
}

run().then(() => process.exit(0)).catch(err => {
    console.error(err);
    process.exit(99);
});
/* eslint-enable */
