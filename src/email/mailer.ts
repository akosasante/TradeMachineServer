import Email from "email-templates";
import nodemailer from "nodemailer";
import SendinBlueTransport, { SendInBlueTransportOptions } from "nodemailer-sendinblue-v3-transport";
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

const SEND_IN_BLUE_OPTS: SendInBlueTransportOptions = {
    apiKey: process.env.EMAIL_KEY_V3 || "",
    apiUrl: process.env.EMAIL_API_URL_V3 || "",
};

const sendInBlueTransport = nodemailer.createTransport(SendinBlueTransport(SEND_IN_BLUE_OPTS), {debug: true, logger: true, transactionLog: true});

const baseDomain = process.env.BASE_URL;

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
        /* eslint-disable @typescript-eslint/no-unsafe-member-access */
        const team = player.meta?.minorLeaguePlayerFromSheet?.mlbTeam as string;
        const position = player.meta?.minorLeaguePlayerFromSheet?.position as string;
        const league = player.meta?.minorLeaguePlayerFromSheet?.leagueLevel as string;
        /* eslint-enable @typescript-eslint/no-unsafe-member-access */
        if (team && position) {
            return ` (${team} - ${position} - ${league || ""} Minors)`;
        } else if (team && league) {
            return ` (${team} - ${league} Minors)`;
        } else if (position && league) {
            return ` (${position} - ${league} Minors)`;
        } else if (team || position || league) {
            return ` (${team || position || league} - ${league ? league + " Minors" : "Minors"})`;
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

interface TradeTextObject {
    sender: string;
    majors: string[];
    minors: string[];
    picks: string[];
}

function getTradeTextForRequest(trade: Trade): TradeTextObject[] | undefined {
    return trade.tradeParticipants?.map(participant => {
        const receivedPlayers = TradeItem.itemsReceivedBy(
            TradeItem.filterPlayers(trade.tradeItems),
            participant.team
        ).map(item => [item.entity as Player, item.sender.name]);
        const [receivedMajors, receivedMinors] = partition(
            receivedPlayers,
            ([player, _sender]) => (player as Player).league === PlayerLeagueType.MAJOR
        );
        const receivedPicks = TradeItem.itemsReceivedBy(TradeItem.filterPicks(trade.tradeItems), participant.team).map(
            item => [item.entity as DraftPick, item.sender.name]
        );
        return {
            sender: participant.team.name,
            majors: receivedMajors.map(
                ([player, sender]) => `${(player as Player).name}${getPlayerDetails(player as Player)} from ${sender}`
            ),
            minors: receivedMinors.map(
                ([player, sender]) => `${(player as Player).name}${getPlayerDetails(player as Player)} from ${sender}`
            ),
            picks: receivedPicks.map(
                ([pick, sender]) =>
                    `${(pick as DraftPick).originalOwner?.name}'s ${(pick as DraftPick).season} ${ordinal(
                        (pick as DraftPick).round
                    )} round ${getPickTypeString((pick as DraftPick).type)} pick${
                        (pick as DraftPick)?.pickNumber ? ` (#${(pick as DraftPick).pickNumber})` : ""
                    } from ${sender}`
            ),
        };
    });
}

function emailIsCreatorOfTrade(email: string, trade: Trade) {
    const ownerEmails = trade.creator?.owners?.map(o => o.email);
    return (ownerEmails || []).includes(email);
}

function getParticipantById(id: string, trade: Trade) {
    return trade.tradeParticipants?.find(tp => tp.team.owners?.find(u => u.id === id));
}

function replaceToEmailIfStaging(email: string) {
    if (process.env.ORM_CONFIG === "staging") {
        const emailPrefix = email.split("@")[0];
        return `tripleabatt+${emailPrefix}@gmail.com`;
    } else {
        return email;
    }
}

export const EMAILER = {
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
        transport: sendInBlueTransport,
        views: {
            root: path.resolve(__dirname, "templates"),
        },
    }),

    dao: new EmailDAO(),

    async sendPasswordResetEmail(user: User): Promise<SendInBlueSendResponse> {
        const resetPassPage = `${baseDomain}/reset_password?u=${encodeURI(user.passwordResetToken!)}`;
        logger.debug("sending password reset email");
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return,@typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access
        return EMAILER.emailer
            .send({
                template: "reset_password",
                message: {
                    to: replaceToEmailIfStaging(user.email),
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
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return,@typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access
        return EMAILER.emailer
            .send({
                template: "test_email",
                message: {
                    to: replaceToEmailIfStaging(user.email),
                    subject: "Test Email",
                },
                locals: {
                    name: user.displayName || user.email,
                },
            })
            .then(async (res: SendInBlueSendResponse) => {
                logger.info(`Successfully sent test email: ${inspect(res.messageId)}`);
                if (res.messageId) {
                    await EMAILER.dao.createEmail(new DbEmail({ messageId: res.messageId || "", status: "sent" }));
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
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return,@typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access
        return EMAILER.emailer
            .send({
                template: "registration_email",
                message: {
                    to: replaceToEmailIfStaging(user.email),
                },
                locals: {
                    name: user.displayName || user.email,
                    url: registrationLink,
                },
            })
            .then(async (res: SendInBlueSendResponse) => {
                logger.info(`Successfully sent registration email: ${inspect(res.messageId)}`);
                if (res.messageId) {
                    await EMAILER.dao.createEmail(new DbEmail({ messageId: res.messageId || "", status: "sent" }));
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

        const acceptUrl = `${baseDomain}/trade/${trade.id}/accept`;
        const acceptText = "Accept Trade";
        const rejectUrl = `${baseDomain}/trade/${trade.id}/reject`;

        logger.debug(`sending trade request email to=${recipient}, acceptUrl=${acceptUrl}, rejectUrl=${rejectUrl}`);
        rollbar.info("sendTradeRequestEmail", { recipient, id: trade.id });

        // eslint-disable-next-line @typescript-eslint/no-unsafe-return,@typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access
        return EMAILER.emailer
            .send({
                template: "trade_request",
                message: {
                    to: replaceToEmailIfStaging(recipient),
                },
                locals: {
                    tradeSender: trade.creator!.name,
                    titleText: getTitleText(trade),
                    tradesByRecipient: getTradeTextForRequest(trade),
                    acceptUrl,
                    acceptText,
                    rejectUrl,
                },
            })
            .then(async (res: SendInBlueSendResponse) => {
                logger.info(`Successfully sent trade request email: ${inspect(res.messageId)}`);
                if (res.messageId) {
                    rollbar.info("sendTradeRequestEmail", { recipient, id: trade.id, messageId: res.messageId });
                    await EMAILER.dao.createEmail(
                        new DbEmail({ messageId: res.messageId || "", status: "sent", trade })
                    );
                } else {
                    rollbar.error("sendTradeRequestEmail_NoEmailId", { recipient, id: trade.id });
                    logger.error("No message id found, not saving email to db.");
                }
                return res;
            })
            .catch((err: Error) => {
                logger.error(`Ran into an error while sending trade request email: ${inspect(err)}`);
                rollbar.error(err, { recipient, id: trade.id });
                return undefined;
            });
    },

    async sendTradeDeclinedEmail(recipient: string, trade: Trade): Promise<SendInBlueSendResponse> {
        logger.debug(`got a trade decline email request for tradeId: ${trade.id}, declined by: ${trade.declinedById}`);
        rollbar.info("sendTradeDeclinedEmail", { recipient, id: trade.id });

        // eslint-disable-next-line @typescript-eslint/no-unsafe-return,@typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access
        return EMAILER.emailer
            .send({
                template: "trade_declined",
                message: {
                    to: replaceToEmailIfStaging(recipient),
                },
                locals: {
                    isCreator: emailIsCreatorOfTrade(recipient, trade),
                    reason: trade.declinedReason,
                    decliningTeam: getParticipantById(trade.declinedById || "", trade)?.team.name,
                    tradesByRecipient: getTradeTextForRequest(trade),
                },
            })
            .then(async (res: SendInBlueSendResponse) => {
                logger.info(`Successfully sent trade declined email: ${inspect(res.messageId)}`);
                if (res.messageId) {
                    rollbar.info("sendTradeDeclinedEmail", { recipient, id: trade.id, messageId: res.messageId });

                    await EMAILER.dao.createEmail(
                        new DbEmail({ messageId: res.messageId || "", status: "sent", trade })
                    );
                } else {
                    rollbar.error("sendTradeDeclinedEmail_NoEmailId", { recipient, id: trade.id });

                    logger.error("No message id found, not saving email to db.");
                }
                return res;
            })
            .catch((err: Error) => {
                logger.error(`Ran into an error while sending trade declined email: ${inspect(err)}`);
                rollbar.error(err, { recipient, id: trade.id });
                return undefined;
            });
    },

    async sendTradeSubmissionEmail(recipient: string, trade: Trade): Promise<SendInBlueSendResponse> {
        logger.debug(`got a trade submission email request for tradeId: ${trade.id}.`);
        const acceptUrl = `${baseDomain}/trade/${trade.id}/submit`;
        // const discardUrl = `${baseDomain}/trade/${trade!.id}/discard`
        logger.debug(`sending trade submission email to=${recipient}, acceptUrl=${acceptUrl}, discardUrl=""`);
        rollbar.info("sendTradeSubmissionEmail", { recipient, id: trade.id });

        // eslint-disable-next-line @typescript-eslint/no-unsafe-return,@typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access
        return EMAILER.emailer
            .send({
                template: "trade_accepted",
                message: {
                    to: replaceToEmailIfStaging(recipient),
                },
                locals: {
                    acceptUrl,
                    // discardUrl, // TODO: Implement discarding trade
                    tradesByRecipient: getTradeTextForRequest(trade),
                },
            })
            .then(async (res: SendInBlueSendResponse) => {
                logger.info(`Successfully sent trade submission email: ${inspect(res.messageId)}`);
                if (res.messageId) {
                    rollbar.info("sendTradeSubmissionEmail", { recipient, id: trade.id, messageId: res.messageId });
                    await EMAILER.dao.createEmail(
                        new DbEmail({ messageId: res.messageId || "", status: "sent", trade })
                    );
                } else {
                    rollbar.error("sendTradeSubmissionEmail_NoEmailId", { recipient, id: trade.id });
                    logger.error("No message id found, not saving email to db.");
                }
                return res;
            })
            .catch((err: Error) => {
                logger.error(`Ran into an error while sending trade submission email: ${inspect(err)}`);
                rollbar.error(err, { recipient, id: trade.id });
                return undefined;
            });
    },
};

Object.freeze(EMAILER);
