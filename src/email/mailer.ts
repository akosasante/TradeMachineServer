import Email from "email-templates";
import nodemailer from "nodemailer";
// @ts-ignore
import SendinBlueTransport from "nodemailer-sendinblue-transport";
import path from "path";
import { inspect } from "util";
import logger from "../bootstrap/logger";
import User from "../models/user";
import Trade from "../models/trade";
import TradeItem from "../models/tradeItem";
import Player, { PlayerLeagueType } from "../models/player";
import { partition } from "lodash";
import DraftPick from "../models/draftPick";
import ordinal from "ordinal";

export interface SendInBlueSendResponse {
    envelope: {
        from: string;
        to: string[];
    };
    messageId?: string;
    message: string;
    originalMessage: {
        to: string;
        from: string;
        subject: string;
        html: string;
        text: string;
        attachments: object[];
    };
}

const SendInBlueOpts = {
    apiKey: process.env.EMAIL_KEY,
    apiUrl: process.env.EMAIL_API_URL,
};

const SendInBlueTransport = nodemailer.createTransport(SendinBlueTransport(SendInBlueOpts));

const baseDomain = process.env.BASE_URL;

function getTitleText(trade: Trade) {
    if (trade.tradeParticipants?.length === 2) {
        return `${trade.creator?.name} requested a trade with you:`;
    } else {
        return `${trade.creator?.name} requested a trade with you and others`;
    }
}

function getTradeTextForRequest(trade: Trade) {
    return trade.tradeParticipants?.map(participant => {
        const sentPlayers = TradeItem.itemsSentBy(TradeItem.filterPlayers(trade.tradeItems), participant.team).map(item => item.entity as Player);
        const [sentMajors, sentMinors] = partition(sentPlayers, player => player.league === PlayerLeagueType.MAJOR);
        const sentPicks = TradeItem.itemsSentBy(TradeItem.filterPicks(trade.tradeItems), participant.team).map(item => item.entity as DraftPick);
        return {
            sender: participant.team.name,
            majors: sentMajors.map(player => `${player.name} - ${player.mlbTeam} - ${player.getEspnEligiblePositions()}`),
            minors: sentMinors.map(player => `${player.name} - ${player.meta?.minorLeaguePlayer?.team} - ${player.meta?.minorLeaguePlayer?.primary_position}`),
            picks: sentPicks.map(pick => `${pick!.originalOwner?.name}'s ${pick!.season} ${ordinal(pick!.round)} round pick`),
        };
    });
}

export const Emailer = {
    emailer: new Email({
        juice: true,
        juiceResources: {
            webResources: {
                relativeTo: path.resolve("./src/email/templates"),
                images: false,
            },
        },
        message: {
            from: "tradebot@flexfoxfantasy.com",
        },
        subjectPrefix: "FlexFoxFantasy TradeMachine - ",
        transport: SendInBlueTransport,
        views: {
            root: path.resolve("./src/email/templates"),
        },
        send: true,
    }),

    async sendPasswordResetEmail(user: User): Promise<SendInBlueSendResponse> {
        const resetPassPage = `${baseDomain}/reset_password?u=${encodeURI(user.id!)}`;
        logger.debug("sending password reset email");
        return Emailer.emailer.send({
            template: "reset_password",
            message: {
                to: user.email,
            },
            locals: {
                name: user.displayName || user.email,
                url: resetPassPage,
            },
        })
        .then((res: SendInBlueSendResponse) => {
            logger.info(`Successfully sent password reset email: ${inspect(res.messageId)}`);
            return res;
        })
        .catch((err: Error) => {
            logger.error(`Ran into an error while sending password reset email: ${inspect(err)}`);
            return undefined;
        });
    },

    async sendTestEmail(user: User): Promise<SendInBlueSendResponse> {
        logger.debug(`sending test email to user: ${user}`);
        return Emailer.emailer.send({
            template: "test_email",
            message: {
                to: user.email,
                subject: "Test Email",
            },
            locals: {
                name: user.displayName || user.email,
            },
        })
        .then((res: SendInBlueSendResponse) => {
            logger.info(`Successfully sent test email: ${inspect(res.messageId)}`);
            return res;
        })
        .catch((err: Error) => {
            logger.error(`Ran into an error while sending test email: ${inspect(err)}`);
            return undefined;
        });
    },

    async sendRegistrationEmail(user: User): Promise<SendInBlueSendResponse> {
        logger.debug("sending registration email");
        const registrationLink = `${baseDomain}/register`;
        return Emailer.emailer.send({
            template: "registration_email",
            message: {
                to: user.email,
            },
            locals: {
                name: user.displayName || user.email,
                url: registrationLink,
            },
        })
        .then((res: SendInBlueSendResponse) => {
            logger.info(`Successfully sent registration email: ${inspect(res.messageId)}`);
            return res;
        })
        .catch((err: Error) => {
            logger.error(`Ran into an error while sending registration email: ${inspect(err)}`);
            return undefined;
        });
    },

    async sendTradeRequestEmail(user?: User, trade?: Trade): Promise<SendInBlueSendResponse> {
        logger.debug(inspect(getTradeTextForRequest(trade!)));
        return Emailer.emailer.send({
            template: "trade_request",
            message: {
                to: "tripleabatt@gmail.com",
            },
            locals: {
                tradeSender: trade!.creator!.name,
                titleText: getTitleText(trade!),
                tradesBySender: getTradeTextForRequest(trade!),
                acceptUrl: `${baseDomain}/trade/${trade!.id}/acccept`,
                rejectUrl: `${baseDomain}/trade/${trade!.id}/reject`,
            },
        })
            .then((res: SendInBlueSendResponse) => {
                logger.info(`Successfully sent trade request email: ${inspect(res.messageId)}`);
                return res;
            })
            .catch((err: Error) => {
                logger.error(`Ran into an error while sending trade request email: ${inspect(err)}`);
                return undefined;
            });
    },
};

Object.freeze(Emailer);
