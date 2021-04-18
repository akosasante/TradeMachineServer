import "jest-extended";
import { TradeFactory } from "../../factories/TradeFactory";
import { appendNewTrade } from "../../../src/csv/TradeTracker";
import { google } from "googleapis";
import { mocked } from "ts-jest/utils";
import { PlayerFactory } from "../../factories/PlayerFactory";
import { PlayerLeagueType } from "../../../src/models/player";
import { TeamFactory } from "../../factories/TeamFactory";

/* eslint-disable @typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unsafe-assignment */
jest.mock("googleapis");
const mockedGoogleSheets = mocked(google);
const mockBatchUpdate = jest.fn();
// @ts-ignore
mockedGoogleSheets.sheets = jest.fn(() => {
    return {
        spreadsheets: {
            batchUpdate: mockBatchUpdate,
        },
    };
});
// @ts-ignore
mockedGoogleSheets.auth = {
    getClient: jest.fn().mockResolvedValue("authed"),
};

afterEach(() => {
    mockBatchUpdate.mockReset();
});
const trade = TradeFactory.getTrade();
trade.tradeItems!.push(
    TradeFactory.getTradedMajorPlayer(
        PlayerFactory.getPlayer("Jose Bautista", PlayerLeagueType.MAJOR),
        trade.creator,
        trade.recipients[0]
    )
);
let values: any[];

function getCellValues(mockBatchUpdateMock: jest.MockContext<any, any>) {
    const {
        requestBody: { requests },
    } = mockBatchUpdateMock.calls[0][0];
    const {
        updateCells: { rows },
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    } = (requests as any[]).find(obj => obj.hasOwnProperty("updateCells"));
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return rows[0].values;
}

beforeAll(async () => {
    mockBatchUpdate.mockResolvedValue(undefined);
    await appendNewTrade(trade);
    values = getCellValues(mockBatchUpdate.mock);
});
describe("TradeTracker.appendNewTrade/1", () => {
    it("should call the spreadsheet batchUpdate api method once and with the expected BatchUpdateRequest shape", () => {
        const expectedRequests = [
            {
                insertDimension: {
                    range: { sheetId: expect.toBeNumber(), startIndex: 1, endIndex: 2, dimension: "ROWS" },
                },
            },
            {
                updateCells: {
                    fields: "*",
                    start: { sheetId: expect.toBeNumber(), rowIndex: 1, columnIndex: 0 },
                    rows: expect.toBeArray(),
                },
            },
        ];
        const expectedBatchUpdate = {
            spreadsheetId: expect.any(String),
            auth: expect.any(String),
            requestBody: {
                requests: expectedRequests,
            },
        };

        expect(mockBatchUpdate).toBeCalledTimes(1);
        expect(mockBatchUpdate).toBeCalledWith(expectedBatchUpdate);
    });

    it("should contain the correct amount of cells", () => {
        expect(values).toBeArrayOfSize(11);
    });

    it("should have a first cell with correctly formatted date", () => {
        const dateCell = values[0];
        expect(dateCell).toEqual({ userEnteredValue: { stringValue: expect.stringMatching(/\d{4}-\d{2}-\d{2}/) } });
    });

    it("should leave a blank cell for ratings", () => {
        const ratingCells = [values[5], values[10]];
        // eslint-disable-next-line @typescript-eslint/ban-types
        ratingCells.forEach((cell: object) =>
            expect(cell).toEqual(expect.objectContaining({ userEnteredValue: { stringValue: " " } }))
        );
    });

    it("should format the owner names correctly", () => {
        const ownerCells = [values[1], values[6]];
        expect(ownerCells).toEqual([
            { userEnteredValue: { stringValue: trade.creator!.name } },
            { userEnteredValue: { stringValue: trade.tradeParticipants![1].team.name } },
        ]);
    });

    it("should leave cells empty if no trade of that type was made", () => {
        const creatorReceivedPlayers = values[2];
        const creatorReceivedPicks = values[4];
        const receiverProspects = values[8];
        // eslint-disable-next-line @typescript-eslint/ban-types
        [creatorReceivedPlayers, creatorReceivedPicks, receiverProspects].forEach((cell: object) =>
            expect(cell).toEqual(expect.objectContaining({ userEnteredValue: { stringValue: "" } }))
        );
    });

    it("should format the major league players received correctly", () => {
        const receiverMajors = values[7];
        const majorPlayer1 = trade.majorPlayers[0];
        const majorPlayer2 = trade.majorPlayers[1];
        const expectedText = `${majorPlayer1.name} FROM ${trade.creator!.name},\n${majorPlayer2.name} FROM ${
            trade.creator!.name
        }`;
        expect(receiverMajors).toEqual({ userEnteredValue: { stringValue: expectedText } });
    });

    it("should format the minor league players received correctly", () => {
        const receivedMinors = values[3];
        const expectedText = `${trade.minorPlayers[0].name} FROM ${trade.recipients[0]!.name}`;
        expect(receivedMinors).toEqual({ userEnteredValue: { stringValue: expectedText } });
    });

    it("should format picks received correctly", () => {
        const expectedPick = trade.picks[0];
        const receivedMinors = values[9];
        const expectedText = "2020 Low Minors - round 1 - Squirtle Squad's pick FROM CREATOR_TEAM";
        expect(receivedMinors).toEqual({ userEnteredValue: { stringValue: expectedText } });
    });

    it("should add all trade participants items even if more than 3-team trade", async () => {
        const bigTrade = TradeFactory.getTrade();
        const thirdTeam = TeamFactory.getTeam("THIRD TEAM");
        const fourthTeam = TeamFactory.getTeam("FOURTH TEAM");
        bigTrade.tradeParticipants!.push(TradeFactory.getTradeRecipient(thirdTeam));
        bigTrade.tradeParticipants!.push(TradeFactory.getTradeRecipient(fourthTeam));
        bigTrade.tradeItems!.push(
            TradeFactory.getTradedMajorPlayer(PlayerFactory.getPlayer("Jose Bautista"), bigTrade.creator, thirdTeam)
        );
        bigTrade.tradeItems!.push(
            TradeFactory.getTradedMajorPlayer(PlayerFactory.getPlayer("Max Sherzer"), fourthTeam, bigTrade.creator)
        );

        mockBatchUpdate.mockResolvedValue(undefined);
        await appendNewTrade(bigTrade);
        values = getCellValues(mockBatchUpdate.mock);

        expect(values).toBeArrayOfSize(21);
    });
});
/* eslint-enable @typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unsafe-assignment */
