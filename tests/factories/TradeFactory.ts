import { LeagueLevel } from "../../src/models/player";
import Trade from "../../src/models/trade";
import TradeItem, { TradeItemType } from "../../src/models/tradeItem";
import TradeParticipant, { TradeParticipantType } from "../../src/models/tradeParticipant";
import { DraftPickFactory } from "./DraftPickFactory";
import { PlayerFactory } from "./PlayerFactory";
import { TeamFactory } from "./TeamFactory";

export class TradeFactory {
    public static getTradeObject(tradeItems = TradeFactory.getTradeItems(),
                                 tradeParticipants = TradeFactory.getTradeParticipants(), rest = {}) {
        return {tradeItems, tradeParticipants, ...rest};
    }

    public static getTrade(tradeItems = TradeFactory.getTradeItems(),
                           tradeParticipants = TradeFactory.getTradeParticipants(), rest = {}) {
        return new Trade(TradeFactory.getTradeObject(tradeItems, tradeParticipants, rest));
    }

    public static getTradeItems() {
        const majorPlayer = TradeFactory.getTradedMajorPlayer(PlayerFactory.getPlayer("Pete Buttjudge"));
        const minorPlayer = TradeFactory.getTradedMinorPlayer(PlayerFactory.getPlayer());
        const pick = TradeFactory.getTradedPick();
        return [majorPlayer, minorPlayer, pick];
    }

    public static getTradeParticipants() {
        const creator = TradeFactory.getTradeCreator(TeamFactory.getTeam());
        const recipient = TradeFactory.getTradeRecipient(TeamFactory.getTeam("Ditto Duo", 2));
        return [creator, recipient];
    }

    public static getTradedMinorPlayer(player = PlayerFactory.getPlayer(), sender = TeamFactory.getTeam(),
                                       recipient = TeamFactory.getTeam(), rest = {}) {
        return new TradeItem({tradeItemType: TradeItemType.PLAYER, player, sender, recipient, ...rest});
    }

    public static getTradedMajorPlayer(player = PlayerFactory.getPlayer(undefined, LeagueLevel.MAJOR),
                                       sender = TeamFactory.getTeam(), recipient = TeamFactory.getTeam(), rest = {}) {
        return new TradeItem({tradeItemType: TradeItemType.PLAYER, player, sender, recipient, ...rest});
    }

    public static getTradedPick(pick = DraftPickFactory.getPick(), sender = TeamFactory.getTeam(),
                                recipient = TeamFactory.getTeam(), rest = {}) {
        return new TradeItem({tradeItemType: TradeItemType.PICK, pick, sender, recipient, ...rest});
    }

    public static getTradeCreator(team = TeamFactory.getTeam()) {
        return new TradeParticipant({participantType: TradeParticipantType.CREATOR, team});
    }

    public static getTradeRecipient(team = TeamFactory.getTeam()) {
        return new TradeParticipant({participantType: TradeParticipantType.RECIPIENT, team});
    }
}
