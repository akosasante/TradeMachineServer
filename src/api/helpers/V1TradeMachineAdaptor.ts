// @ts-ignore
import v1MemberMap from "./v1MemberMap.json";
import v1PickMap from "./v1PickMap.json";
import TradeItem, { TradeItemType } from "../../models/tradeItem";
import TeamDAO from "../../DAO/TeamDAO";
import PlayerDAO from "../../DAO/PlayerDAO";
import Trade from "../../models/trade";
import { PlayerLeagueType } from "../../models/player";
import DraftPickDAO from "../../DAO/DraftPickDAO";
import UserDAO from "../../DAO/UserDAO";
import DraftPick, { LeagueLevel } from "../../models/draftPick";
import TradeParticipant, { TradeParticipantType } from "../../models/tradeParticipant";
import logger from "../../bootstrap/logger";
import { inspect } from "util";

interface V1TradedPlayer {
    player: string;
    rec: keyof typeof v1MemberMap;
}

interface V1TradedProspect {
    prospect: string;
    rec: keyof typeof v1MemberMap;
}

interface V1TradedPick {
    pick: keyof typeof v1PickMap;
    round: number;
    type: "major" | "high" | "low";
    rec: keyof typeof v1MemberMap;
}

interface V1TradedItemSet {
    sender: keyof typeof v1MemberMap;
    players: V1TradedPlayer[];
    prospects: V1TradedProspect[];
    picks: V1TradedPick[];
}

interface V1TradeItems extends Array<V1TradedItemSet> {
    [index: number]: V1TradedItemSet;
}

interface V1Player {
    "_id": { "$oid": keyof typeof v1MemberMap };
    name: string;
    email: string;
    userId: string;
    username: string;
}

interface V1TradeParticipants extends Array<V1Player> {
    [index: number]: V1Player;
}

export interface V1Payload {
    [index: number]: V1TradeItems | V1TradeParticipants;
}

interface V1TradeMachineAdaptor {
    teamDao: undefined | TeamDAO;
    playerDao: undefined | PlayerDAO;
    userDao: undefined | UserDAO;
    pickDao: undefined | DraftPickDAO;
    init: (teamDao?: TeamDAO, playerDao?: PlayerDAO, userDao?: UserDAO, pickDao?: DraftPickDAO) => this;
    getTrade: (payload: V1Payload) => Promise<Trade>;
}

async function getTradeItemPlayersFromSet(teamDao: TeamDAO, playerDao: PlayerDAO, tradeItemSet: V1TradedItemSet) {
    const senderTeam = await teamDao.getTeamById(v1MemberMap[tradeItemSet.sender].v2TeamId);
    const players = tradeItemSet.players || [];
    return players.map(async p => {
        const recipientTeam = await teamDao.getTeamById(v1MemberMap[p.rec].v2TeamId);
        let player = await playerDao.getPlayerByName(p.player);
        if (!player) {
            player = (await playerDao.batchUpsertPlayers([{name: p.player, league: PlayerLeagueType.MAJOR}]))[0];
        }
        logger.debug(`got player: ${inspect(player)}`);
        return new TradeItem({
            tradeItemType: TradeItemType.PLAYER,
            tradeItemId: player?.id,
            sender: senderTeam,
            recipient: recipientTeam,
        });
    });
}

async function getTradeItemProspectsFromSet(teamDao: TeamDAO, playerDao: PlayerDAO, tradeItemSet: V1TradedItemSet) {
    const senderTeam = await teamDao.getTeamById(v1MemberMap[tradeItemSet.sender].v2TeamId);
    const prospects = tradeItemSet.prospects || [];
    return prospects.map(async p => {
        const recipientTeam = await teamDao.getTeamById(v1MemberMap[p.rec].v2TeamId);
        let prospect = await playerDao.getPlayerByName(p.prospect);
        if (!prospect) {
            prospect = (await playerDao.batchUpsertPlayers([{name: p.prospect, league: PlayerLeagueType.MINOR}]))[0];
        }
        logger.debug(`got prospect: ${inspect(prospect)}`);
        return new TradeItem({
            tradeItemType: TradeItemType.PLAYER,
            tradeItemId: prospect?.id,
            sender: senderTeam,
            recipient: recipientTeam,
        });
    });
}

async function getTradeItemPicksFromSet(teamDao: TeamDAO, userDao: UserDAO, pickDao: DraftPickDAO, tradeItemSet: V1TradedItemSet) {
    const senderTeam = await teamDao.getTeamById(v1MemberMap[tradeItemSet.sender].v2TeamId);
    const picks = tradeItemSet.picks || [];
    return picks.map(async p => {
        const originalOwner = await userDao.getUserById(v1PickMap[p.pick].v2UserId, true);
        const originalOwnerTeam = originalOwner?.team;
        const recipientTeam = await teamDao.getTeamById(v1MemberMap[p.rec].v2TeamId);
        const v1Pick: Partial<DraftPick> = {round: p.round, type: getPickType(p.type), originalOwner: originalOwnerTeam};
        let pick = (await pickDao.findPicks(v1Pick))[0];
        if (pick) {
            logger.debug("updating pick with current owner");
            pick = (await pickDao.updatePick(pick.id!, {season: 2020, currentOwner: recipientTeam}));
        } else {
            logger.debug("creating new pick");
            pick = (await pickDao.createPicks([{...v1Pick, season: 2020, currentOwner: recipientTeam}]))[0];
        }
        logger.debug(`got pick: ${inspect(pick)}`);
        return new TradeItem({
            tradeItemType: TradeItemType.PICK,
            tradeItemId: pick?.id,
            sender: senderTeam,
            recipient: recipientTeam,
        });
    });
}

function getPickType(type: string) {
    switch (type) {
        case "major":
            return LeagueLevel.MAJORS;
        case "high":
            return LeagueLevel.HIGH;
        case "low":
            return LeagueLevel.LOW;
    }
}

async function getTradeItems(payload: V1Payload, teamDao: TeamDAO, playerDao: PlayerDAO, userDao: UserDAO, pickDao: DraftPickDAO) {
    const tradeItemsBySender = payload[0] as V1TradeItems;
    let tradeItems: TradeItem[] = [];
    for (const tradeItemSet of tradeItemsBySender) {
        const players = await getTradeItemPlayersFromSet(teamDao, playerDao, tradeItemSet);
        const prospects = await getTradeItemProspectsFromSet(teamDao, playerDao, tradeItemSet);
        const picks = await getTradeItemPicksFromSet(teamDao, userDao, pickDao, tradeItemSet);

        const tradeItemsFromSender = await Promise.all(players.concat(prospects).concat(picks));
        tradeItems = tradeItems.concat(tradeItemsFromSender);
    }
    return tradeItems;
}

function getTradeParticipants(payload: V1Payload, teamDao: TeamDAO) {
    const createTradeParticipant = async (player: V1Player, isCreator: boolean = false) => {
        const team = await teamDao.getTeamById(v1MemberMap[player._id.$oid].v2TeamId);
        return new TradeParticipant({team, participantType: isCreator ? TradeParticipantType.CREATOR : TradeParticipantType.RECIPIENT});
    };
    const participants = payload[1] as V1TradeParticipants;
    const creator = participants[0];
    const recipients = participants.slice(1);
    return [createTradeParticipant(creator, true)].concat(recipients.map(r => createTradeParticipant(r)));
}

export const V1TradeMachineAdaptor: V1TradeMachineAdaptor = {
    teamDao: undefined,
    playerDao: undefined,
    userDao: undefined,
    pickDao: undefined,
    init(teamDao?: TeamDAO, playerDao?: PlayerDAO, userDao?: UserDAO, pickDao?: DraftPickDAO) {
        logger.debug("Initializing adaptor");
        this.teamDao = teamDao || new TeamDAO();
        this.playerDao = playerDao || new PlayerDAO();
        this.userDao = userDao || new UserDAO();
        this.pickDao = pickDao || new DraftPickDAO();
        return this;
    },
    async getTrade(payload) {
        logger.debug("getting trade items");
        const tradeItems = await getTradeItems(payload, this.teamDao!, this.playerDao!, this.userDao!, this.pickDao!);
        logger.debug(`trade items: ${inspect(tradeItems)}`);
        logger.debug("getting trade participants");
        const tradeParticipants = await Promise.all(getTradeParticipants(payload, this.teamDao!));
        logger.debug(`trade participants: ${inspect(tradeParticipants)}`);
        logger.debug("returning trade");
        return new Trade({tradeItems, tradeParticipants});
    },
};

