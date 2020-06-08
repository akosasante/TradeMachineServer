import "jest";
import "jest-extended";
import { TradeParticipantType } from "../../../src/models/tradeParticipant";
import { TeamFactory } from "../../factories/TeamFactory";
import { TradeFactory } from "../../factories/TradeFactory";
import logger from "../../../src/bootstrap/logger";

describe("Trade Participant Class", () => {
    beforeAll(() => {
        logger.debug("~~~~~~TRADE PARTICIPANT TESTS BEGIN~~~~~~");
    });
    afterAll(() => {
        logger.debug("~~~~~~TRADE PARTICIPANT TESTS COMPLETE~~~~~~");
    });
    const team = TeamFactory.getTeam(undefined, undefined);
    const trade = TradeFactory.getTrade(undefined, undefined);
    const participant = TradeFactory.getTradeRecipient(team, trade);

    describe("constructor", () => {
        it("should construct the obj as expected", () => {
            expect(participant.participantType).toEqual(TradeParticipantType.RECIPIENT);
            expect(participant.trade).toEqual(trade);
            expect(participant.team).toEqual(team);
        });
    });

    describe("instance methods", () => {
        it("toString/0 - should return a string with the UUID", () => {
            expect(participant.toString()).toMatch(participant.id!);
            expect(participant.toString()).toMatch("TradeParticipant#");
        });
    });
});
