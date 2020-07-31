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
            minors: sentMinors.map(player => `${player.name} - ${player.meta?.minorLeaguePlayerFromSheet?.mlbTeam} - ${player.meta?.minorLeaguePlayerFromSheet?.position}`),
            picks: sentPicks.map(pick => `${pick!.originalOwner?.name}'s ${pick!.season} ${ordinal(pick!.round)} round pick`),
        };
    });
}

function emailIsCreatorOfTrade(email: string, trade: Trade) {
    const ownerEmails = trade.creator?.owners?.map(o => o.email);
    return (ownerEmails || []).includes(email);
}

function getParticipantByEmail(email: string, trade: Trade) {
    return trade.tradeParticipants?.find(tp => tp.team.owners?.find(u => u.email === email));
}

function getParticipantById(id: string, trade: Trade) {
    return trade.tradeParticipants?.find(tp => tp.team.owners?.find(u => u.id === id));
}

export const Emailer = {
    emailer: new Email({
        juice: true,
        juiceResources: {
            webResources: {
                relativeTo: path.resolve(__dirname, "templates"),
                images: false,
            },
        },
        message: {
            from: "tradebot@flexfoxfantasy.com",
        },
        subjectPrefix: "FlexFoxFantasy TradeMachine - ",
        transport: SendInBlueTransport,
        views: {
            root: path.resolve(__dirname, "templates"),
        },
    }),

    async sendPasswordResetEmail(user: User): Promise<SendInBlueSendResponse> {
        const resetPassPage = `${baseDomain}/reset_password?u=${encodeURI(user.passwordResetToken!)}`;
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
        const userEmailEncoded = Buffer.from(user.email).toString("base64");
        const registrationLink = `${baseDomain}/register?e=${userEmailEncoded}`;
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

    async sendTradeRequestEmail(recipient: string, trade: Trade): Promise<SendInBlueSendResponse> {
        logger.debug(`preparing trade req email for tradeId: ${trade.id}`);
        return Emailer.emailer.send({
            template: "trade_request",
            message: {
                to: recipient,
            },
            locals: {
                tradeSender: trade!.creator!.name,
                titleText: getTitleText(trade!),
                tradesBySender: getTradeTextForRequest(trade!),
                acceptUrl: `${baseDomain}/trade/${trade!.id}/accept`,
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

    async sendTradeDeclinedEmail(recipient: string, trade: Trade): Promise<SendInBlueSendResponse> {
        logger.debug(`got a trade decline email request for tradeId: ${trade.id}`);
        return Emailer.emailer.send({
            template: "trade_declined",
            message: {
                to: recipient,
            },
            locals: {
                isCreator: emailIsCreatorOfTrade(recipient, trade),
                reason: trade.declinedReason,
                decliningTeam: getParticipantById(trade.declinedById || "", trade)?.team.name,
                tradesBySender: getTradeTextForRequest(trade!),
            },
        })
            .then((res: SendInBlueSendResponse) => {
                logger.info(`Successfully sent trade declined email: ${inspect(res.messageId)}`);
                return res;
            })
            .catch((err: Error) => {
                logger.error(`Ran into an error while sending trade declined email: ${inspect(err)}`);
                return undefined;
            });
    },

    async sendTradeSubmissionEmail(recipient: string, trade: Trade): Promise<SendInBlueSendResponse> {
        logger.debug(`got a trade submission email request for tradeId: ${trade.id}`);
        return Emailer.emailer.send({
            template: "trade_accepted",
            message: {
                to: recipient,
            },
            locals: {
                acceptUrl: `${baseDomain}/trade/${trade!.id}/submit`,
                rejectUrl: `${baseDomain}/trade/${trade!.id}/discard`,
                tradesBySender: getTradeTextForRequest(trade!),
            },
        })
            .then((res: SendInBlueSendResponse) => {
                logger.info(`Successfully sent trade submission email: ${inspect(res.messageId)}`);
                return res;
            })
            .catch((err: Error) => {
                logger.error(`Ran into an error while sending trade submission email: ${inspect(err)}`);
                return undefined;
            });
    },
};

Object.freeze(Emailer);
