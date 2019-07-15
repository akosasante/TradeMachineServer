import "jest";
import "jest-extended";
import DraftPick from "../../../src/models/draftPick";
import Player, { LeagueLevel } from "../../../src/models/player";
import Team from "../../../src/models/team";
import Trade from "../../../src/models/trade";
import TradeItem, { TradeItemType } from "../../../src/models/tradeItem";

describe("Trade Item Class", () => {
    const player = new Player({name: "Honus Wiener", league: LeagueLevel.HIGH});
    const pick = new DraftPick({round: 1, pickNumber: 12, type: LeagueLevel.LOW});
    const sender = new Team({name: "Squirtle Squad", espnId: 1});
    const recipient = new Team({name: "Ditto Duo", espnId: 2});
    const trade = new Trade({id: 1, tradeItems: [], tradeParticipants: []});
    const tradedPlayerObj = {
        tradeItemType: TradeItemType.MAJOR_PLAYER,
        trade, player, sender, recipient };
    const tradedPlayer = new TradeItem(tradedPlayerObj);

    const tradedPickObj = {
        tradeItemType: TradeItemType.PICK,
        trade, pick, sender, recipient };
    const tradedPick = new TradeItem(tradedPickObj);

    describe("constructor", () => {
        it("should construct the obj as expected", () => {
            expect(tradedPlayer.tradeItemType).toEqual(TradeItemType.MAJOR_PLAYER);
            expect(tradedPlayer.trade).toEqual(trade);
            expect(tradedPlayer.player).toEqual(player);
            expect(tradedPlayer.sender).toEqual(sender);
            expect(tradedPlayer.recipient).toEqual(recipient);
            expect(tradedPlayer.pick).toBeUndefined();
        });
    });

    describe("getters", () => {
        it("entity/0 - should return the correct entity or null", () => {
            expect(tradedPlayer.entity).toEqual(player);
            expect(tradedPick.entity).toEqual(pick);
        });
    });

    describe("instance methods", () => {
        it("toString/0", () => {
            expect(tradedPlayer.toString()).toMatch("for trade#");
            expect(tradedPick.toString()).toMatch("for trade#");
        });

        it("isValid/0 - should return true if the entity is not null", () => {
            expect(tradedPlayer.isValid()).toBeTrue();
            expect(tradedPick.isValid()).toBeTrue();
        });
        it("isValid/0 - should return false if the entity is null", () => {
            const invalidTradeItem = new TradeItem({
                tradeItemType: TradeItemType.MAJOR_PLAYER,
                trade, sender, recipient });
            expect(invalidTradeItem.isValid()).toBeFalse();
        });
        it("isValid/0 - should return false if the tradeItemType is not set", () => {
            const invalidTradeItem = new TradeItem({trade, player, sender, recipient });
            expect(invalidTradeItem.isValid()).toBeFalse();
        });
    });
});
