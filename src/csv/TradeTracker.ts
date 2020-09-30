import Trade from "../models/trade";
import { google, sheets_v4 } from "googleapis";
import TradeItem from "../models/tradeItem";
import Player, { PlayerLeagueType } from "../models/player";
import DraftPick from "../models/draftPick";
import { inspect } from "util";
import logger from "../bootstrap/logger";
import { rollbar } from "../bootstrap/rollbar";
import Team from "../models/team";
import Schema$InsertDimensionRequest = sheets_v4.Schema$InsertDimensionRequest;
import Schema$UpdateCellsRequest = sheets_v4.Schema$UpdateCellsRequest;
import Params$Resource$Spreadsheets$Batchupdate = sheets_v4.Params$Resource$Spreadsheets$Batchupdate;

function generateColumnsForRecipients(tradeItems: TradeItem[], recipient: Team) {
    const itemsReceivedByOwner = TradeItem.itemsReceivedBy(tradeItems, recipient);
    const picksReceivedByOwner = TradeItem.filterPicks(itemsReceivedByOwner);
    const picksString = picksReceivedByOwner.map(pickItem => {
        const pick = pickItem.entity as DraftPick;
        return `${pick.season} ${DraftPick.leagueLevelToString(pick.type)} - round ${pick.round} - ${getOwnerNameFromTeam(pick.originalOwner)}'s pick FROM ${getOwnerNameFromTeam(pickItem.sender)}`;
    }).join(",\n");

    const playersReceivedByOwner = TradeItem.filterPlayers(itemsReceivedByOwner);
    const majorLeaguersReceivedByOwner = playersReceivedByOwner
        .filter(player => (player.entity as Player).league === PlayerLeagueType.MAJOR);
    const playersString = majorLeaguersReceivedByOwner.map(playerItem =>
        `${(playerItem.entity as Player).name} FROM ${getOwnerNameFromTeam(playerItem.sender)}`
    ).join(",\n");
    const prospectsReceivedByOwner = playersReceivedByOwner
        .filter(player => (player.entity as Player).league === PlayerLeagueType.MINOR);
    const prospectsString = prospectsReceivedByOwner.map(playerItem =>
        `${(playerItem.entity as Player).name} FROM ${getOwnerNameFromTeam(playerItem.sender)}`
    ).join(",\n");

    return [getOwnerNameFromTeam(recipient), playersString, prospectsString, picksString];
}

function getOwnerNameFromTeam(team?: Team): string {
    return (team?.owners && team.owners.length) ? (team.owners[0].displayName || team.owners[0].csvName || team.owners[0].email) : (team || {}).name || "";
}

function generateTradeRow(trade: Trade) {
    return (trade.tradeParticipants || []).reduce((rowsAcc, recipient, index) => {
        const ratingsBlankField = " ";
        const columns = generateColumnsForRecipients(trade.tradeItems || [], recipient.team);
        return rowsAcc.concat(columns).concat([ratingsBlankField]);
    }, [(trade.dateModified || trade.dateCreated || new Date()).toISOString().substring(0, 10)]
    );
}

export async function appendNewTrade(trade: Trade) {
    const sheetId = parseInt(process.env.TRADE_WORKSHEET_ID!, 10);
    const STARTING_ROW_INDEX = 1; // Row 2
    const auth = await google.auth.getClient({
        scopes: "https://www.googleapis.com/auth/spreadsheets",
        keyFile: `${process.env.BASE_DIR}/${process.env.SHEETS_CREDENTIAL_FILE}`,
    });
    const sheets = google.sheets({
        version: "v4",
        auth,
    });
    const insertEmptyRowRequest: Schema$InsertDimensionRequest = {
        range: {
            sheetId,
            startIndex: STARTING_ROW_INDEX, // (inclusive, insert new row under the header)
            endIndex: 2, // Row 3 (exclusive range)
            dimension: "ROWS",
        },
    };

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

    return sheets.spreadsheets.batchUpdate(batchUpdateRequest).then(_res => {
        logger.info(`Successfully inserted new row in trade index: ${trade.id}`);
    }).catch(err => {
        logger.error(`err: ${inspect(err)}`);
        rollbar.error(err);
    });
}
