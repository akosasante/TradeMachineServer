import "jest";
import "jest-extended";
import { clone } from "lodash";
import DraftPick from "../../../src/models/draftPick";
import Player, { LeagueLevel } from "../../../src/models/player";
import Team from "../../../src/models/team";
import Trade from "../../../src/models/trade";
import TradeItem, { TradeItemType } from "../../../src/models/tradeItem";

describe("Trade Item Class", () => {
    const player = new Player({name: "Honus Wiener", league: LeagueLevel.HIGH});
    const pick = new DraftPick({id: 99, round: 1, pickNumber: 12, type: LeagueLevel.LOW});
    const sender = new Team({name: "Squirtle Squad", espnId: 1});
    const recipient = new Team({name: "Ditto Duo", espnId: 2});
    const trade = new Trade({id: 1, tradeItems: [], tradeParticipants: []});
    const tradedPlayerObj = {
        tradeItemType: TradeItemType.PLAYER,
        trade, player, sender, recipient };
    const tradedPlayer = new TradeItem(tradedPlayerObj);

    const tradedPickObj = {
        tradeItemType: TradeItemType.PICK,
        trade, pick, sender, recipient };
    const tradedPick = new TradeItem(tradedPickObj);

    describe("constructor", () => {
        it("should construct the obj as expected", () => {
            expect(tradedPlayer.tradeItemType).toEqual(TradeItemType.PLAYER);
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
        it("entity/0 - should return undefined if tradeItemType is not set", () => {
            const invalidEntity = clone(tradedPlayer);
            // @ts-ignore
            invalidEntity.tradeItemType = undefined;
            expect(invalidEntity.entity).toBeUndefined();
        });
    });

    describe("instance methods", () => {
        it("toString/0", () => {
            expect(tradedPlayer.toString()).toMatch(/TI#\d*: Player\d* for trade#\d*/);
            expect(tradedPick.toString()).toMatch(/TI#\d*: Pick#\d* for trade#\d*/);
        });

        it("isValid/0 - should return true if the entity is not null", () => {
            expect(tradedPlayer.isValid()).toBeTrue();
            expect(tradedPick.isValid()).toBeTrue();
        });
        it("isValid/0 - should return false if the entity is null", () => {
            const invalidTradeItem = new TradeItem({
                tradeItemType: TradeItemType.PLAYER,
                trade, sender, recipient });
            expect(invalidTradeItem.isValid()).toBeFalse();
        });
        it("isValid/0 - should return false if the tradeItemType is not set", () => {
            const invalidTradeItem = new TradeItem({trade, player, sender, recipient });
            expect(invalidTradeItem.isValid()).toBeFalse();
        });
    });

    describe("static methods", () => {
        const majorPlayer = clone(player);
        majorPlayer.league = LeagueLevel.MAJOR;
        const tradedMajorPlayer = clone(tradedPlayer);
        tradedMajorPlayer.player = majorPlayer;
        tradedMajorPlayer.sender = recipient;
        tradedMajorPlayer.recipient = sender;
        const tradedItems = [tradedPlayer, tradedPick, tradedMajorPlayer];

        it("filteredPlayers/1 - return only Player items", () => {
            expect(TradeItem.filterPlayers(tradedItems)).toEqual([tradedPlayer, tradedMajorPlayer]);
        });
        it("filteredMajorPlayers/1 - return only Major League players", () => {
            expect(TradeItem.filterMajorPlayers(tradedItems)).toEqual([tradedMajorPlayer]);
        });
        it("filteredMinorPlayers/1 - return only Minor League players", () => {
            expect(TradeItem.filterMinorPlayers(tradedItems)).toEqual([tradedPlayer]);
        });
        it("filterPicks/1 - return only draft picks", () => {
            expect(TradeItem.filterPicks(tradedItems)).toEqual([tradedPick]);
        });
        it("itemsSentBy/2 - return only items sent by the passed in team", () => {
            expect(TradeItem.itemsSentBy(tradedItems, sender)).toEqual([tradedPlayer, tradedPick]);
            expect(TradeItem.itemsSentBy(tradedItems, recipient)).toEqual([tradedMajorPlayer]);
        });
        it("itemsReceivedBy/2 - return only items received by the passed in team", () => {
            expect(TradeItem.itemsReceivedBy(tradedItems, sender)).toEqual([tradedMajorPlayer]);
            expect(TradeItem.itemsReceivedBy(tradedItems, recipient)).toEqual([tradedPlayer, tradedPick]);
        });
    });
});
