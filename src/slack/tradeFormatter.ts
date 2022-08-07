import TradeItem from "../models/tradeItem";
import PlayerDAO from "../DAO/PlayerDAO";
import Player, { PlayerLeagueType } from "../models/player";
import DraftPickDAO from "../DAO/DraftPickDAO";
import DraftPick, { LeagueLevel } from "../models/draftPick";
import ordinal from "ordinal";
import Trade from "../models/trade";
import TradeParticipant from "../models/tradeParticipant";
import logger from "../bootstrap/logger";
import Team from "../models/team";
import User from "../models/user";
import { partition, zip } from "lodash";

interface TradeFormatterDeps {
    playerDao: PlayerDAO;
    pickDao: DraftPickDAO;
}

// eslint-disable-next-line @typescript-eslint/naming-convention
const TradeFormatter = {
    async prepPlayerText(twoPlayerTrade: boolean, tradedPlayers: TradeItem[], dao?: PlayerDAO): Promise<string> {
        logger.info(`Rendering text for ${tradedPlayers.length} players`);

        function getMinorLeaguePlayerText(player: Player) {
            const playerMetaInfo = player.meta
                ? // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                  `(${player.meta?.minorLeaguePlayerFromSheet?.position} - ${player.meta?.minorLeaguePlayerFromSheet?.leagueLevel} Minors - ${player.meta?.minorLeaguePlayerFromSheet?.mlbTeam})`
                : "(Minors)";
            const text = `• *${player.name}* ${playerMetaInfo}`;
            if (!twoPlayerTrade) {
                const tradedPlayer = tradedPlayers.find(pl => pl.tradeItemId === player.id);
                return `${text} from _${tradedPlayer?.sender.name}_`;
            } else {
                return text;
            }
        }

        function getMajorLeaguePlayerText(player: Player) {
            const playerMetaInfo = player.meta
                ? `(${player.getEspnEligiblePositions()} - Majors - ${player.mlbTeam})`
                : "(Majors)";
            const text = `• *${player.name}* ${playerMetaInfo}`;
            if (!twoPlayerTrade) {
                const tradedPlayer = tradedPlayers.find(pl => pl.tradeItemId === player.id);
                return `${text} from _${tradedPlayer?.sender.name}_`;
            } else {
                return text;
            }
        }

        const playerDao = dao || new PlayerDAO();
        const players = await Promise.all(
            tradedPlayers.map(async (tradedPlayer: TradeItem) => {
                return await playerDao.getPlayerById(tradedPlayer.tradeItemId);
            })
        );

        const [minorLeaguePlayers, majorLeaguePlayers] = partition(
            players,
            player => player.league === PlayerLeagueType.MINOR
        );
        const minorLeaguePlayersString = minorLeaguePlayers.map(getMinorLeaguePlayerText).join("\n");
        const majorLeaguePlayersString = majorLeaguePlayers.map(getMajorLeaguePlayerText).join("\n");
        return `${majorLeaguePlayersString}\n\n${minorLeaguePlayersString}`.trim();
    },

    async prepPickText(twoPlayerTrade: boolean, tradedPicks: TradeItem[], dao?: DraftPickDAO): Promise<string> {
        logger.info(`Rendering text for ${tradedPicks.length} picks`);
        const pickDao = dao || new DraftPickDAO();
        if (!twoPlayerTrade) {
            tradedPicks.sort((tp1, tp2) => tp1.id!.localeCompare(tp2.id!));
        }
        const picks = await Promise.all(
            tradedPicks.map(async (tradedPick: TradeItem) => {
                return await pickDao.getPickById(tradedPick.tradeItemId);
            })
        );
        if (!twoPlayerTrade) {
            return zip(tradedPicks, picks)
                .map(([tradedPick, pick]) => {
                    return `• *${pick!.originalOwner?.name}'s* ${pick!.season} \
${ordinal(pick!.round)} round ${this.getPickTypeString(pick!.type)} pick${
                        pick?.pickNumber ? ` (#${pick.pickNumber})` : ""
                    } from _${tradedPick!.sender.name}_`;
                })
                .join("\n")
                .trim();
        } else {
            return picks
                .map((pick: DraftPick) => {
                    return `• *${pick.originalOwner?.name}'s* ${pick.season} ${ordinal(
                        pick.round
                    )} round ${this.getPickTypeString(pick.type)} pick${
                        pick?.pickNumber ? ` (#${pick.pickNumber})` : ""
                    }`;
                })
                .join("\n")
                .trim();
        }
    },

    async getTradeTextForParticipant(
        twoPlayerTrade: boolean,
        trade: Trade,
        participant: TradeParticipant,
        deps?: TradeFormatterDeps
    ) {
        logger.info(`Rendering trade items received by ${participant.team.name} for ${trade}`);
        const header = `*${participant.team.name} receives:*`;
        const receivedItems = TradeItem.itemsReceivedBy(trade.tradeItems!, participant.team);
        const playerText = await this.prepPlayerText(
            twoPlayerTrade,
            TradeItem.filterPlayers(receivedItems),
            deps?.playerDao
        );
        const pickText = await this.prepPickText(twoPlayerTrade, TradeItem.filterPicks(receivedItems), deps?.pickDao);
        logger.debug("Header: " + header);
        logger.debug("Players: " + playerText);
        logger.debug("Picks: " + pickText);
        return `${header}\n${playerText ? playerText + "\n\n" : ""}${pickText}`;
    },

    getSubtitleText(trade: Trade) {
        logger.info("Rendering subtitle text");

        function getSlackUsernamesForOwners(owners: User[]) {
            return owners
                .filter(owner => !!owner.slackUsername)
                .map(owner => `<@${owner.slackUsername}>`)
                .join(", ");
        }

        function tradeUpholdTime() {
            const nowUTC = new Date();
            const now = new Date(nowUTC.toLocaleString("en-US", { timeZone: "America/Toronto" }));
            let upholdTime = new Date();
            const addDaysToDate = (dateToModify: Date, dateToAddTo: Date, days: number) =>
                new Date(dateToModify.setDate(dateToAddTo.getDate() + days));

            if (now.getHours() < 23) {
                // It is before 11PM, so trade will be upheld by tomorrow at 11pm.
                upholdTime = addDaysToDate(upholdTime, now, 1);
            } else {
                // It is after 11PM, so trade won't be upheld until the day-after-tomorrow at 11pm.
                upholdTime = addDaysToDate(upholdTime, now, 2);
            }
            upholdTime.setHours(23, 0, 0, 0);
            return upholdTime.toLocaleString("en-CA");
        }

        return `*${new Date().toDateString()}* \
| Trade requested by ${getSlackUsernamesForOwners(trade.creator!.owners!)} \
- Trading with: ${getSlackUsernamesForOwners(trade.recipients.flatMap(r => r.owners!))} \
| Trade will be upheld after: ${tradeUpholdTime()} (Eastern)`;
    },

    getNotificationText: (trade: Trade) => {
        logger.info("Rendering notification text");
        return `Trade submitted between ${trade.creator!.name} \
& ${trade.recipients.map((r: Team) => r.name).join(" & ")}`;
    },

    getTitleText: () => {
        logger.info("Rendering title text");
        return ":loud_sound:  *A Trade Has Been Submitted*  :loud_sound:";
    },

    getLinkText: () => {
        logger.info("Rendering link text");
        return ":link: Submit trades on the <https://trades.flexfoxfantasy.com|FlexFoxFantasy TradeMachine> by 11:00PM ET";
    },

    getPickTypeString(pickType: LeagueLevel) {
        switch (pickType) {
            case LeagueLevel.MAJORS:
                return "Major League";
            case LeagueLevel.HIGH:
                return "High Minors";
            case LeagueLevel.LOW:
                return "Low Minors";
        }
    },
};

export default TradeFormatter;
