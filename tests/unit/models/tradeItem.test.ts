import "jest";
import "jest-extended";
import { clone } from "lodash";
import { LeagueLevel } from "../../../src/models/player";
import Trade from "../../../src/models/trade";
import TradeItem, { TradeItemType } from "../../../src/models/tradeItem";
import { DraftPickFactory } from "../../factories/DraftPickFactory";
import { PlayerFactory } from "../../factories/PlayerFactory";
import { TeamFactory } from "../../factories/TeamFactory";
import {TradeFactory} from "../../factories/TradeFactory";

describe("Trade Item Class", () => {
    const player = PlayerFactory.getPlayer();
    const pick = DraftPickFactory.getPick();
    const [sender, recipient] = TeamFactory.getTeams(2);
    const tradedPlayer = TradeFactory.getTradedMinorPlayer(player, sender, recipient);
    const tradedPick = TradeFactory.getTradedPick(pick, recipient, sender);

    describe("constructor", () => {
        it("should construct the obj as expected", () => {
            expect(tradedPlayer.tradeItemType).toEqual(TradeItemType.PLAYER);
            expect(tradedPlayer.entity).toEqual(player);
            expect(tradedPlayer.sender).toEqual(sender);
            expect(tradedPlayer.recipient).toEqual(recipient);
            expect(tradedPlayer.tradeItemId).toEqual(player.id);
            expect(tradedPlayer.trade).toBeUndefined();
        });
    });

    describe("getters", () => {
        it("entity/0 - should return the correct entity or null", () => {
            expect(tradedPlayer.entity).toEqual(player);
            expect(tradedPick.entity).toEqual(pick);
        });
    });

    describe("instance methods", () => {
        it("toString/0 - should return a string with the UUID", () => {
            expect(tradedPlayer.toString()).toMatch(tradedPlayer.id!);
            expect(tradedPlayer.toString()).toMatch("TradeItem#");
        });
    });

    describe("static methods", () => {
        const tradedMajorPlayer = TradeFactory.getTradedMajorPlayer(undefined, recipient, sender);
        const tradedItems = [tradedPlayer, tradedPick, tradedMajorPlayer];

        it("filterPlayers/1 - return only Player items", () => {
            expect(TradeItem.filterPlayers(tradedItems)).toEqual([tradedPlayer, tradedMajorPlayer]);
        });
        it("filterPicks/1 - return only draft picks", () => {
            expect(TradeItem.filterPicks(tradedItems)).toEqual([tradedPick]);
        });
        it("itemsSentBy/2 - return only items sent by the passed in team", () => {
            expect(TradeItem.itemsSentBy(tradedItems, sender)).toIncludeSameMembers([tradedPlayer]);
            expect(TradeItem.itemsSentBy(tradedItems, recipient)).toIncludeSameMembers([tradedMajorPlayer, tradedPick]);
        });
        it("itemsReceivedBy/2 - return only items received by the passed in team", () => {
            expect(TradeItem.itemsReceivedBy(tradedItems, recipient)).toIncludeSameMembers([tradedPlayer]);
            expect(TradeItem.itemsReceivedBy(tradedItems, sender)).toIncludeSameMembers([tradedMajorPlayer, tradedPick]);
        });
    });
});
