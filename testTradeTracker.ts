import TradeDAO from "./src/DAO/TradeDAO";
import { appendNewTrade } from "./src/csv/TradeTracker";
import initializeDb from "./src/bootstrap/db";

async function run() {
    const args = process.argv.slice(2);
    await initializeDb(true);
    const tradeDao = new TradeDAO();
    let trade = await tradeDao.getTradeById(args[0] || "ffa4381a-549e-4ab4-bfcb-45b15aeb18f8");
    trade = await tradeDao.hydrateTrade(trade);
    // @ts-ignore
    // tslint:disable-next-line
    console.dir(trade);
    return appendNewTrade(trade);
}

// tslint:disable-next-line:no-console
run().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(99); });
