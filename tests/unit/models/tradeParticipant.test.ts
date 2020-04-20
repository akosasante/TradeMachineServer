import "jest";
import "jest-extended";
import { TradeParticipantType } from "../../../src/models/tradeParticipant";
import { TeamFactory } from "../../factories/TeamFactory";
import { TradeFactory } from "../../factories/TradeFactory";

describe("Trade Participant Class", () => {
    const team = TeamFactory.getTeam(undefined, undefined, {id: 1});
    const trade = TradeFactory.getTrade(undefined, undefined, {id: 1});
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
