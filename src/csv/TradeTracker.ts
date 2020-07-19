import Trade from "../models/trade";
import { google, sheets_v4 } from "googleapis";
import TradeItem from "../models/tradeItem";
import Player, { PlayerLeagueType } from "../models/player";
import Schema$InsertDimensionRequest = sheets_v4.Schema$InsertDimensionRequest;
import Schema$UpdateCellsRequest = sheets_v4.Schema$UpdateCellsRequest;
import DraftPick from "../models/draftPick";
import { inspect } from "util";
import logger from "../bootstrap/logger";
// import initializeDb from "../bootstrap/db";
// import TradeDAO from "../DAO/TradeDAO";
import Params$Resource$Spreadsheets$Batchupdate = sheets_v4.Params$Resource$Spreadsheets$Batchupdate;
// import { GoogleSpreadsheet } from "google-spreadsheet";
import Rollbar from "rollbar";

const rollbar = new Rollbar({
    accessToken: process.env.ROLLBAR_TOKEN,
    environment: process.env.NODE_ENV,
    verbose: true,
});

function generateTradeRow(trade: Trade) {
    const tradeRowValues: {[key: string]: any} = {
        date: (new Date()).toISOString().substring(0, 10),
        owner1: trade.creator?.name,
        ratingBlank: "",
    };

    // logger.debug(`${inspect(tradeRowValues)}`);

    const itemsReceivedByOwner1 = TradeItem.itemsReceivedBy(trade.tradeItems!, trade.creator!);
    const playersReceivedByOwner1 = TradeItem.filterPlayers(itemsReceivedByOwner1)
        .filter(player => player.entity instanceof Player ? player.entity.league === PlayerLeagueType.MAJOR : false);
    const prospectsReceivedByOwner1 = TradeItem.filterPlayers(itemsReceivedByOwner1)
        .filter(player => player.entity instanceof Player ? player.entity.league === PlayerLeagueType.MINOR : false);
    const picksReceivedByOwner1 = TradeItem.filterPicks(itemsReceivedByOwner1);

    // logger.debug(`${inspect(playersReceivedByOwner1)}`);
    // logger.debug(`${inspect(prospectsReceivedByOwner1)}`);
    // logger.debug(`${inspect(picksReceivedByOwner1)}`);

    tradeRowValues.players1 = playersReceivedByOwner1
        .map(playerItem =>
            `${(playerItem.entity as Player).name} FROM ${playerItem.sender.name}`
        ).join(", ");
    tradeRowValues.prospects1 = prospectsReceivedByOwner1
        .map(playerItem =>
            `${(playerItem.entity as Player).name} FROM ${playerItem.sender.name}`
        ).join(", ");
    tradeRowValues.picks1 = picksReceivedByOwner1.map(pickItem => {
        const pick = pickItem.entity as DraftPick;
        // logger.debug(`pickID: ${inspect(pick.id)}`);
        return `${pick.season} ${pick.type} - round ${pick.round} - ${pick.originalOwner?.name}'s pick FROM ${pickItem.sender.name}`;
    }).join(", ");

    // add each recipient as an `owner#` key
    trade.recipients.forEach((recipTeam, index) => {
        const ownerKey = `owner${index + 2}`;
        const playerKey = `players${index + 2}`;
        const prospectsKey = `prospects${index + 2}`;
        const picksKey = `picks${index + 2}`;
        const itemsReceivedByOwner = TradeItem.itemsReceivedBy(trade.tradeItems!, recipTeam);
        const playersReceivedByOwner = TradeItem.filterPlayers(itemsReceivedByOwner)
            .filter(player => player.entity instanceof Player ? player.entity.league === PlayerLeagueType.MAJOR : false);
        const prospectsReceivedByOwner = TradeItem.filterPlayers(itemsReceivedByOwner)
            .filter(player => player.entity instanceof Player ? player.entity.league === PlayerLeagueType.MINOR : false);
        const picksReceivedByOwner = TradeItem.filterPicks(itemsReceivedByOwner);

        tradeRowValues[ownerKey] = recipTeam.name;
        tradeRowValues[playerKey] = playersReceivedByOwner
            .map(playerItem =>
                `${(playerItem.entity as Player).name} FROM ${playerItem.sender.name}`
            ).join(", ");
        tradeRowValues[prospectsKey] = prospectsReceivedByOwner
            .map(playerItem =>
                `${(playerItem.entity as Player).name} FROM ${playerItem.sender.name}`
            ).join(", ");
        tradeRowValues[picksKey] = picksReceivedByOwner.map(pickItem => {
            const pick = pickItem.entity as DraftPick;
            return `${pick.season} ${pick.type} - round ${pick.round} - ${pick.originalOwner?.name}'s pick FROM ${pickItem.sender.name}`;
        }).join(", ");
    });

    return trade.recipients.reduce((rowsAcc, recipient, index) => {
        logger.debug(`conct: ${inspect(rowsAcc)}`);
        return rowsAcc.concat([
            tradeRowValues[`players${index + 2}`],
            tradeRowValues[`prospects${index + 2}`],
            tradeRowValues[`picks${index + 2}`],
            tradeRowValues.ratingBlank,
        ]);
    }, [
        tradeRowValues.date,
        tradeRowValues.owner1,
        tradeRowValues.players1,
        tradeRowValues.prospects1,
        tradeRowValues.picks1,
        tradeRowValues.ratingBlank,
    ]);
}

export async function appendNewTrade(trade: Trade) {
    // const doc = new GoogleSpreadsheet(process.env.TRADE_SPREADSHEET_ID!);
    const sheetId = parseInt(process.env.TRADE_WORKSHEET_ID!, 10);
    // await doc.useServiceAccountAuth({
    //     client_email: process.env.SHEETS_API_EMAIL!,
    //     private_key: process.env.SHEETS_API_KEY!,
    // });
    // await doc.loadInfo(); // load sheet info
    // const sheet = doc.sheetsById[sheetId];
    // logger.debug(`sheet: ${inspect(sheet)}`);
    // sheet.addRow(["hello"]);

    const STARTING_ROW_INDEX = 1; // Row 2
    // logger.debug(`generated: ${inspect(generateTradeRow(trade))}`);
    const auth = await google.auth.getClient({
        scopes: "https://www.googleapis.com/auth/spreadsheets",
        keyFile: "/Users/aasante/h-dev/TradeMachine/trade-machine-server/sheet_creds.json",
    });
    const sheets = google.sheets({
        version: "v4",
        auth,
    });
    const insertEmptyRowRequest: Schema$InsertDimensionRequest = {
        range: {
            sheetId,
            startIndex: STARTING_ROW_INDEX, // (inclusive, insert new row under the header)
            endIndex: 2, // Row 3 (exculsive range)
            dimension: "ROWS",
        },
    };
    logger.debug(`res: ${inspect(generateTradeRow(trade))}`);

    const insertTradeDataRequest: Schema$UpdateCellsRequest = {
        fields: "*", // we want to update all fields in this cell range
        start: {
            sheetId,
            rowIndex: STARTING_ROW_INDEX,
            columnIndex: 0, // Column A. Update the row starting from cell A1
        },
        rows: [
            {
                values: generateTradeRow(trade).map(datum => ({ userEnteredValue: { stringValue: datum } })),
            },
        ],
    };

    const batchUpdateRequest: Params$Resource$Spreadsheets$Batchupdate = {
        spreadsheetId: process.env.TRADE_SPREADSHEET_ID,
        requestBody: {
            requests: [{insertDimension: insertEmptyRowRequest}, {updateCells: insertTradeDataRequest}],
        },
        auth,
    };

    return sheets.spreadsheets.batchUpdate(batchUpdateRequest).then(res => {
        logger.info(`Successfully inserted new row in trade index: ${trade.id}`);
    }).catch(err => {
        logger.error(`err: ${inspect(err)}`);
        rollbar.error(err);
    });
}

// async function run() {
//     const args = process.argv.slice(2);
//     await initializeDb(true);
//     const tradeDao = new TradeDAO();
//     let trade = await tradeDao.getTradeById(args[0] || "66dee0a9-6b46-4e8f-aad4-2eca044f69db");
//     trade = await tradeDao.hydrateTrade(trade);
//     logger.debug("got trade: " + trade.id);
//     return await appendNewTrade(trade);
// }
//
// run().then(res => logger.info(`${inspect(res)}`)).catch(err => logger.error(`${inspect(err)}`)).finally(() => process.exit(0));
