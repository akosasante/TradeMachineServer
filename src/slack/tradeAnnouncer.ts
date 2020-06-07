import { IncomingWebhook } from "@slack/webhook";
import Trade from "../models/trade";
import TradeItem from "../models/tradeItem";
import Player, { PlayerLeagueType } from "../models/player";
import User from "../models/user";
import TradeDAO from "../DAO/TradeDAO";
import initializeDb from "../bootstrap/db";
import PlayerDAO from "../DAO/PlayerDAO";
import DraftPickDAO from "../DAO/DraftPickDAO";
import ordinal from "ordinal";
import DraftPick from "../models/draftPick";
import TradeParticipant from "../models/tradeParticipant";
import { flatten } from "lodash";
import logger from "../bootstrap/logger";
import { inspect } from "util";

const EspnBlocks = {
    divider: { type: "divider" },
    mrkdwnSection(text: string) {
        return {
            type: "section",
            text: {
                type: "mrkdwn",
                text,
            },
        };
    },
    context(elementTexts: string[]) {
        return {
            type: "context",
            elements: elementTexts.map((text: string) => ({
                type: "mrkdwn",
                text,
            })),
        };
    },
};

export class SlackTradeAnnouncer {
    private static url: string = process.env.SLACK_WEBHOOK_URL || "";
    private static webhook = new IncomingWebhook(SlackTradeAnnouncer.url);

    private static async prepPlayerText(twoPlayerTrade: boolean, tradedPlayers: TradeItem[]): Promise<string> {
        const playerDao = new PlayerDAO();
        const players = await Promise.all(tradedPlayers.map(async (tradedPlayer: TradeItem) => {
            return await playerDao.getPlayerById(tradedPlayer.tradeItemId);
        }));
        return players.map((player: Player) => {
            const position = player.league === PlayerLeagueType.MINOR ? player.meta.minorLeaguePlayer.primary_position : player.getEspnEligiblePositions();
            const league = player.league === PlayerLeagueType.MINOR ? player.meta.minorLeaguePlayer.sport : "Majors";
            const team = player.league === PlayerLeagueType.MINOR ? player.meta.minorLeaguePlayer.team : player.mlbTeam;
            const playerMetaInfo = `(${position} - ${league} - ${team})`;
            return `
• *${player.name}* ${playerMetaInfo}${twoPlayerTrade ? "" : " from _" + tradedPlayers[0].sender.name + "_"}`;
        }).join("");
    }

    private static async prepPickText(tradedPicks: TradeItem[]): Promise<string> {
        const pickDao = new DraftPickDAO();
        const picks = await Promise.all(tradedPicks.map(async (tradedPick: TradeItem) => {
            return await pickDao.getPickById(tradedPick.tradeItemId);
        }));
        return picks.map((pick: DraftPick) => {
            return `
• *${pick.originalOwner?.name}'s* ${pick.season} ${ordinal(pick.round)} round pick`;
        }).join("");
    }


    private static async getTradeTextForParticipant(twoPlayerTrade: boolean, trade: Trade, participant: TradeParticipant) {
        const header = `*${participant.team.name} receives:*`;
        const receivedItems = TradeItem.itemsReceivedBy(trade.tradeItems!, participant.team);
        logger.debug(inspect(receivedItems));
        const playerText = await SlackTradeAnnouncer.prepPlayerText(twoPlayerTrade, TradeItem.filterPlayers(receivedItems));
        logger.debug(playerText);
        const pickText = await SlackTradeAnnouncer.prepPickText(TradeItem.filterPicks(receivedItems));
        logger.debug(pickText);
        return header + playerText + pickText;
    }

    public static async buildTradeAnnouncementMsg(trade: Trade) {
        const twoPlayerTrade = trade.tradeParticipants!.length === 2;
        const tradeText = await Promise.all(trade.tradeParticipants!.map((participant: TradeParticipant) => {
            return SlackTradeAnnouncer.getTradeTextForParticipant(twoPlayerTrade, trade, participant);
        }));

        return {
            text: `Trade submitted between ${trade.creator!.name} & ${trade.recipients.map(r => r.name).join(" &")}`,
            blocks: [
                EspnBlocks.mrkdwnSection(":loud_sound:  *A Trade Has Been Submitted*  :loud_sound:"),
                EspnBlocks.context([`*${new Date().toDateString()}* | Trade requested by ${trade.creator!.owners!.map((user: User) => "<@" + user.slackUsername + ">")} - Trading with: ${trade.recipients.flatMap(r => r.owners!.map((user: User) => "<@" + user.slackUsername + ">")).join(", ")}`]),
                EspnBlocks.divider,
                ...flatten(tradeText.map((text: string) => [
                    EspnBlocks.mrkdwnSection(text),
                    EspnBlocks.divider,
                ])),
                EspnBlocks.context([":link: Submit trades on the <https://trades.flexfoxfantasy.com|FlexFoxFantasy TradeMachine> by 11:00PM ET"]),
            ],
        };
    }

    public static async sendTradeAnnouncement(trade: Trade) {
        logger.debug("building trade");
        const res = await SlackTradeAnnouncer.buildTradeAnnouncementMsg(trade);
        logger.debug(inspect(res));
        return await SlackTradeAnnouncer.webhook.send(res);
    }

    // tslint:disable-next-line:no-empty
    constructor() {}
}
//
// async function run() {
//     await initializeDb(true);
//     const tradeDao = new TradeDAO();
//     const trade = await tradeDao.getTradeById("f65cfb6c-0610-46bc-87a1-12ccef0c27e3");
//     console.dir(trade);
//     return SlackTradeAnnouncer.sendTradeAnnouncement(trade);
// }
//
// run().then(() => process.exit(0));
