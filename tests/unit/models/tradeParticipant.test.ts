import "jest";
import "jest-extended";
import Team from "../../../src/models/team";
import Trade from "../../../src/models/trade";
import TradeParticipant, { TradeParticipantType } from "../../../src/models/tradeParticipant";

describe("Trade Participant Class", () => {
    const team = new Team({id: 1, name: "Squirtle Squad", espnId: 1});
    const trade = new Trade({id: 1, tradeItems: [], tradeParticipants: []});
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
