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
import DraftPick, { LeagueLevel } from "../models/draftPick";
import ordinal from "ordinal";
import { rollbar } from "../bootstrap/rollbar";
import EmailDAO from "../DAO/EmailDAO";
import DbEmail from "../models/email";

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
const v1BaseDomain = process.env.V1_BASE_URL;

function getTitleText(trade: Trade) {
    if (trade.tradeParticipants?.length === 2) {
        return `${trade.creator?.name} requested a trade with you:`;
    } else {
        return `${trade.creator?.name} requested a trade with you and others`;
    }
}

function getPlayerDetails(player: Player) {
    if (player.league === PlayerLeagueType.MAJOR) {
        const team = player.mlbTeam;
        const positions = player.getEspnEligiblePositions();
        if (team && positions) {
            return ` (${team} - ${positions})`;
        } else if (team || positions) {
            return ` (${team || positions})`;
        } else {
            return " ";
        }
    } else if (player.league === PlayerLeagueType.MINOR) {
        const team = player.meta?.minorLeaguePlayerFromSheet?.mlbTeam;
        const position = player.meta?.minorLeaguePlayerFromSheet?.position;
        const league = player.meta?.minorLeaguePlayerFromSheet?.leagueLevel;
        if (team && position) {
            return ` (${team} - ${position} - ${league || ""} Minors)`;
        } else if (team && league) {
            return ` (${team} - ${league} Minors)`;
        } else if (position && league) {
            return ` (${position} - ${league} Minors)`;
        } else if (team || position || league) {
            return ` (${team || position || league} - ${league ? (league + " Minors") : "Minors"})`;
        } else {
            return " (Minors)";
        }
    }
}

function getPickTypeString(pickType: LeagueLevel) {
    switch (pickType) {
        case LeagueLevel.MAJORS:
            return "Majors";
        case LeagueLevel.HIGH:
            return "High Minors";
        case LeagueLevel.LOW:
            return "Low Minors";
    }
}

function getTradeTextForRequest(trade: Trade) {
    return trade.tradeParticipants?.map(participant => {
        const receivedPlayers = TradeItem.itemsReceivedBy(TradeItem.filterPlayers(trade.tradeItems), participant.team).map(item => [item.entity as Player, item.sender.name]);
        const [receivedMajors, receivedMinors] = partition(receivedPlayers, ([player, _sender]) => (player as Player).league === PlayerLeagueType.MAJOR);
        const receivedPicks = TradeItem.itemsReceivedBy(TradeItem.filterPicks(trade.tradeItems), participant.team).map(item => [item.entity as DraftPick, item.sender.name]);
        return {
            sender: participant.team.name,
            majors: receivedMajors.map(([player, sender]) => `${(player as Player).name}${getPlayerDetails(player as Player)} from ${sender}`),
            minors: receivedMinors.map(([player, sender]) => `${(player as Player).name}${getPlayerDetails(player as Player)} from ${sender}`),
            picks: receivedPicks.map(([pick, sender]) => `${(pick as DraftPick).originalOwner?.name}'s ${(pick as DraftPick).season} ${ordinal((pick as DraftPick).round)} round ${getPickTypeString((pick as DraftPick).type)} pick from ${sender}`),
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

    dao: new EmailDAO(),

    v2Emails: process.env.V2_EMAILS!.split(","),

    sendToV2(email: string) {
        return Emailer.v2Emails.includes(email);
    },

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
            rollbar.error(err);
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
        .then(async (res: SendInBlueSendResponse) => {
            logger.info(`Successfully sent test email: ${inspect(res.messageId)}`);
            if (res.messageId) {
                await Emailer.dao.createEmail(new DbEmail({messageId: res.messageId || "", status: "sent"}));
            } else {
                logger.error("No message id found, not saving email to db.");
            }
            return res;
        })
        .catch((err: Error) => {
            logger.error(`Ran into an error while sending test email: ${inspect(err)}`);
            rollbar.error(err);
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
        .then(async (res: SendInBlueSendResponse) => {
            logger.info(`Successfully sent registration email: ${inspect(res.messageId)}`);
            if (res.messageId) {
                await Emailer.dao.createEmail(new DbEmail({messageId: res.messageId || "", status: "sent"}));
            } else {
                logger.error("No message id found, not saving email to db.");
            }
            return res;
        })
        .catch((err: Error) => {
            logger.error(`Ran into an error while sending registration email: ${inspect(err)}`);
            rollbar.error(err);
            return undefined;
        });
    },

    async sendTradeRequestEmail(recipient: string, trade: Trade): Promise<SendInBlueSendResponse> {
        logger.debug(`preparing trade req email for tradeId: ${trade.id}.`);

        const emailPrefix = recipient.split("@")[0];
        const sendToV2 = Emailer.sendToV2(recipient);
        const acceptUrl = sendToV2 ? `${baseDomain}/trade/${trade!.id}/accept` : `${v1BaseDomain}/confirm/${trade.id}_${emailPrefix}`;
        const acceptText = sendToV2 ? "Accept Trade" : "Review Trade";
        const rejectUrl = sendToV2 ? `${baseDomain}/trade/${trade!.id}/reject` : "";

        logger.debug(`sending trade request email to=${recipient}, v2=${sendToV2}, acceptUrl=${acceptUrl}, rejectUrl=${rejectUrl}`);
        rollbar.info("sendTradeRequestEmail", {recipient, sendToV2, id: trade.id});

        return Emailer.emailer.send({
            template: "trade_request",
            message: {
                to: recipient,
            },
            locals: {
                tradeSender: trade!.creator!.name,
                titleText: getTitleText(trade!),
                tradesByRecipient: getTradeTextForRequest(trade!),
                acceptUrl,
                acceptText,
                rejectUrl,
            },
        })
            .then(async (res: SendInBlueSendResponse) => {
                logger.info(`Successfully sent trade request email: ${inspect(res.messageId)}`);
                if (res.messageId) {
                    rollbar.info("sendTradeRequestEmail", {recipient, sendToV2, id: trade.id, messageId: res.messageId});
                    await Emailer.dao.createEmail(new DbEmail({messageId: res.messageId || "", status: "sent", trade}));
                } else {
                    rollbar.error("sendTradeRequestEmail_NoEmailId", {recipient, sendToV2, id: trade.id});
                    logger.error("No message id found, not saving email to db.");
                }
                return res;
            })
            .catch((err: Error) => {
                logger.error(`Ran into an error while sending trade request email: ${inspect(err)}`);
                rollbar.error(err, {recipient, sendToV2, id: trade.id});
                return undefined;
            });
    },

    async sendTradeDeclinedEmail(recipient: string, trade: Trade): Promise<SendInBlueSendResponse> {
        logger.debug(`got a trade decline email request for tradeId: ${trade.id}`);
        rollbar.info("sendTradeDeclinedEmail", {recipient, id: trade.id});

        return Emailer.emailer.send({
            template: "trade_declined",
            message: {
                to: recipient,
            },
            locals: {
                isCreator: emailIsCreatorOfTrade(recipient, trade),
                reason: trade.declinedReason,
                decliningTeam: getParticipantById(trade.declinedById || "", trade)?.team.name,
                tradesByRecipient: getTradeTextForRequest(trade!),
            },
        })
            .then(async (res: SendInBlueSendResponse) => {
                logger.info(`Successfully sent trade declined email: ${inspect(res.messageId)}`);
                if (res.messageId) {
                    rollbar.info("sendTradeDeclinedEmail", {recipient, id: trade.id, messageId: res.messageId});

                    await Emailer.dao.createEmail(new DbEmail({messageId: res.messageId || "", status: "sent", trade}));
                } else {
                    rollbar.error("sendTradeDeclinedEmail_NoEmailId", {recipient, id: trade.id});

                    logger.error("No message id found, not saving email to db.");
                }
                return res;
            })
            .catch((err: Error) => {
                logger.error(`Ran into an error while sending trade declined email: ${inspect(err)}`);
                rollbar.error(err, {recipient, id: trade.id});
                return undefined;
            });
    },

    async sendTradeSubmissionEmail(recipient: string, trade: Trade): Promise<SendInBlueSendResponse> {
        logger.debug(`got a trade submission email request for tradeId: ${trade.id}.`);
        const emailPrefix = recipient.split("@")[0];
        const sendToV2 = Emailer.sendToV2(recipient);
        const acceptUrl = sendToV2 ? `${baseDomain}/trade/${trade!.id}/submit` : `${v1BaseDomain}/send/${trade.id}_${emailPrefix}`;
       // const discardUrl = `${baseDomain}/trade/${trade!.id}/discard`
        logger.debug(`sending trade submission email to=${recipient}, v2=${sendToV2}, acceptUrl=${acceptUrl}, discardUrl=""`);
        rollbar.info("sendTradeSubmissionEmail", {recipient, sendToV2, id: trade.id});

        return Emailer.emailer.send({
            template: "trade_accepted",
            message: {
                to: recipient,
            },
            locals: {
                acceptUrl,
                // discardUrl, // TODO: Implement discarding trade
                tradesByRecipient: getTradeTextForRequest(trade!),
            },
        })
            .then(async (res: SendInBlueSendResponse) => {
                logger.info(`Successfully sent trade submission email: ${inspect(res.messageId)}`);
                if (res.messageId) {
                    rollbar.info("sendTradeSubmissionEmail", {recipient, sendToV2, id: trade.id, messageId: res.messageId});
                    await Emailer.dao.createEmail(new DbEmail({messageId: res.messageId || "", status: "sent", trade}));
                } else {
                    rollbar.error("sendTradeSubmissionEmail_NoEmailId", {recipient, sendToV2, id: trade.id});
                    logger.error("No message id found, not saving email to db.");
                }
                return res;
            })
            .catch((err: Error) => {
                logger.error(`Ran into an error while sending trade submission email: ${inspect(err)}`);
                rollbar.error(err, {recipient, sendToV2, id: trade.id});
                return undefined;
            });
    },
};

Object.freeze(Emailer);
