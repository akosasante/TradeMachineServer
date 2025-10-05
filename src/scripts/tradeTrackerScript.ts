import TradeDAO from "../DAO/TradeDAO";
import { appendNewTrade } from "../csv/TradeTracker";
import initializeDb from "../bootstrap/db";

async function run() {
    const args = process.argv.slice(2);
    await initializeDb(true);
    const tradeDao = new TradeDAO();
    let trade = await tradeDao.getTradeById(args[0] || "056371f2-ca28-4102-bbe5-a9f4df9628dd");
    trade = await tradeDao.hydrateTrade(trade);
    console.dir(trade);
    return appendNewTrade(trade);
}

run()
    .then(() => process.exit(0))
    .catch(err => {
        console.error(err);
        process.exit(99);
    });
