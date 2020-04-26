import { IncomingWebhook } from "@slack/webhook";
import Trade from "../models/trade";
import TradeItem from "../models/tradeItem";
import Player from "../models/player";
import User from "../models/user";
import TradeDAO from "../DAO/TradeDAO";
import initializeDb from "../bootstrap/db";
import PlayerDAO from "../DAO/PlayerDAO";
import DraftPickDAO from "../DAO/DraftPickDAO";
import ordinal from "ordinal";
import DraftPick from "../models/draftPick";
import TradeParticipant from "../models/tradeParticipant";
import { flatten } from "lodash";

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
            return `
• ${player.name}${twoPlayerTrade ? "" : " from _" + tradedPlayers[0].sender + "_"}`;
        }).join("");
    }

    private static async prepPickText(tradedPicks: TradeItem[]): Promise<string> {
        const pickDao = new DraftPickDAO();
        const picks = await Promise.all(tradedPicks.map(async (tradedPick: TradeItem) => {
            return await pickDao.getPickById(tradedPick.tradeItemId);
        }));
        return picks.map((pick: DraftPick) => {
            return `
• ${pick.originalOwner}'s ${pick.season} ${ordinal(pick.round)} round pick`;
        }).join("");
    }


    private static async getTradeTextForParticipant(twoPlayerTrade: boolean, trade: Trade, participant: TradeParticipant) {
        const header = `*${participant.team.name} receives:*`;
        const receivedItems = TradeItem.itemsReceivedBy(trade.tradeItems!, participant.team);
        console.dir(receivedItems);
        const playerText = await SlackTradeAnnouncer.prepPlayerText(twoPlayerTrade, TradeItem.filterPlayers(receivedItems));
        console.log(playerText);
        const pickText = await SlackTradeAnnouncer.prepPickText(TradeItem.filterPicks(receivedItems));
        console.log(pickText);
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
                EspnBlocks.context([`*${new Date().toDateString()}* | Initiated by ${trade.creator!.owners!.map((user: User) => "<@" + user.slackUsername + ">")}`]),
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
        console.log("building trade");
        const res = await SlackTradeAnnouncer.buildTradeAnnouncementMsg(trade);
        console.log(res);
        return await SlackTradeAnnouncer.webhook.send(res);
    }

    // tslint:disable-next-line:no-empty
    constructor() {}
}

async function run() {
    await initializeDb(true);
    const tradeDao = new TradeDAO();
    const trade = await tradeDao.getTradeById("256cd0ed-35e9-47e3-9464-5087a80082af");
    console.dir(trade);
    return SlackTradeAnnouncer.sendTradeAnnouncement(trade);
}

run();
