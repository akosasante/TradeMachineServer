import { PlayerLeagueType } from "../../src/models/player";
import Trade, { TradeStatus } from "../../src/models/trade";
import TradeItem, { TradeItemType } from "../../src/models/tradeItem";
import TradeParticipant, { TradeParticipantType } from "../../src/models/tradeParticipant";
import { DraftPickFactory } from "./DraftPickFactory";
import { PlayerFactory } from "./PlayerFactory";
import { TeamFactory } from "./TeamFactory";
import { v4 as uuid } from "uuid";
import Team from "../../src/models/team";

export class TradeFactory {
    public static getTradeObject(tradeItems = TradeFactory.getTradeItems(),
                                 tradeParticipants: TradeParticipant[] = TradeFactory.getTradeParticipants(), status = TradeStatus.DRAFT,
                                 rest: Partial<Trade> = {}) {
        return {tradeItems, tradeParticipants, status, id: uuid(), ...rest};
    }

    public static getTrade(items?: TradeItem[],
                           participants?: TradeParticipant[],
                           status = TradeStatus.DRAFT,
                           rest: Partial<Trade> = {}) {
        const tradeParticipants = participants || TradeFactory.getTradeParticipants();
        const tradeItems = items || TradeFactory.getTradeItems(tradeParticipants[0].team, tradeParticipants[1].team);
        return new Trade(TradeFactory.getTradeObject(tradeItems, tradeParticipants, status, rest));
    }

    public static getTradeItems(sender?: Team, recipient?: Team) {
        const majorPlayer = TradeFactory.getTradedMajorPlayer(PlayerFactory.getPlayer("Pete Buttjudge", PlayerLeagueType.MAJOR), sender, recipient);
        const minorPlayer = TradeFactory.getTradedMinorPlayer(PlayerFactory.getPlayer(), recipient, sender);
        const pick = TradeFactory.getTradedPick(DraftPickFactory.getPick(), sender, recipient);
        return [majorPlayer, minorPlayer, pick];
    }

    public static getTradeParticipants(teamA = TeamFactory.getTeam(), teamB = TeamFactory.getTeam("Ditto Duo", 2)) {
        const creator = TradeFactory.getTradeCreator(teamA);
        const recipient = TradeFactory.getTradeRecipient(teamB);
        return [creator, recipient];
    }

    public static getTradedMinorPlayer(player = PlayerFactory.getPlayer(),
                                       sender = TeamFactory.getTeam(),
                                       recipient = TeamFactory.getTeam(),
                                       rest = {}) {
        return new TradeItem({id: uuid(), tradeItemType: TradeItemType.PLAYER, tradeItemId: player.id!, entity: player, sender, recipient, ...rest});
    }

    public static getTradedMajorPlayer(player = PlayerFactory.getPlayer(undefined, PlayerLeagueType.MAJOR),
                                       sender = TeamFactory.getTeam(),
                                       recipient = TeamFactory.getTeam(),
                                       rest = {}) {
        return new TradeItem({id: uuid(), tradeItemType: TradeItemType.PLAYER, tradeItemId: player.id!, entity: player, sender, recipient, ...rest});
    }

    public static getTradedPick(pick = DraftPickFactory.getPick(),
                                sender = TeamFactory.getTeam(),
                                recipient = TeamFactory.getTeam(),
                                rest = {}) {
        return new TradeItem({id: uuid(), tradeItemType: TradeItemType.PICK, tradeItemId: pick.id!, entity: pick, sender, recipient, ...rest});
    }

    public static getTradeCreator(team?: Team, trade?: Trade) {
        return new TradeParticipant({id: uuid(), participantType: TradeParticipantType.CREATOR, team, trade});
    }

    public static getTradeRecipient(team?: Team, trade?: Trade) {
        return new TradeParticipant({id: uuid(), participantType: TradeParticipantType.RECIPIENT, trade, team});
    }
}
