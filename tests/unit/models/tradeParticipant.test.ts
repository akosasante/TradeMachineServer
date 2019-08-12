import "jest";
import "jest-extended";
import TradeParticipant, { TradeParticipantType } from "../../../src/models/tradeParticipant";
import { TeamFactory } from "../../factories/TeamFactory";
import { TradeFactory } from "../../factories/TradeFactory";

describe("Trade Participant Class", () => {
    const team = TeamFactory.getTeam(undefined, undefined, {id: 1});
    const trade = TradeFactory.getTrade(undefined, undefined, {id: 1});
    const participant = new TradeParticipant({participantType: TradeParticipantType.RECIPIENT, trade,
        team, tradeParticipantId: 1});

    describe("constructor", () => {
        it("should construct the obj as expected", () => {
            expect(participant.participantType).toEqual(TradeParticipantType.RECIPIENT);
            expect(participant.trade).toEqual(trade);
            expect(participant.team).toEqual(team);
        });
    });

    describe("instance methods", () => {
        it("toString/0", () => {
            expect(participant.toString()).toMatch(/TP#\d+ for trade#\d+ and team#\d+/);
        });
    });
});
