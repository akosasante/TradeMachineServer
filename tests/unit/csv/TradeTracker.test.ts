import "jest";
import "jest-extended";
import {TradeFactory} from "../../factories/TradeFactory";
import {appendNewTrade} from "../../../src/csv/TradeTracker";
import {google} from "googleapis";
import {mocked} from "ts-jest";

jest.mock("googleapis");
const mockedGoogleSheets = mocked(google);
const mockBatchUpdate = jest.fn().mockResolvedValue(undefined);
mockedGoogleSheets.sheets = jest.fn(() => {
    return {
        spreadsheets: {
            batchUpdate: mockBatchUpdate,
        },
    };
});
mockedGoogleSheets.auth = {
    getClient: jest.fn().mockResolvedValue("authed"),
};

describe("TradeTracker.appendNewTrade/1", () => {
    it("should call the spreadsheet batchUpdate api method once and with the expected BatchUpdateRequest shape", async () => {
        const trade = TradeFactory.getTrade();
        const expectedRequests = [
            {insertDimension: {range: {sheetId: expect.toBeNumber(), startIndex: 1, endIndex: 2, dimension: "ROWS"}}},
            {updateCells: {fields: "*", start: {sheetId: expect.toBeNumber(), rowIndex: 1, columnIndex: 0}, rows: expect.toBeArray()}},
        ];
        const expectedBatchUpdate = {
            spreadsheetId: expect.toBeString(),
            auth: expect.toBeString(),
            requestBody: {
                requests: expectedRequests,
            },
        };

        await appendNewTrade(trade);

        expect(mockBatchUpdate).toBeCalledTimes(1);
        expect(mockBatchUpdate).toBeCalledWith(expectedBatchUpdate);
    });

    it("should start with the creators received trade items");

    it("should add all trade participants items even if more than 3-team trade");

    it("should format the major league players received correctly");

    it("should format the minor league players received correctly");

    it("should format picks received correctly");

    it("should leave a blank cell for ratings");
});
