import { Job } from "bull";
import logger from "../bootstrap/logger";
import { Emailer, SendInBlueSendResponse } from "./mailer";
import User from "../models/user";
import { EmailStatusEvent } from "../api/routes/EmailController";
import EmailDAO from "../DAO/EmailDAO";
import Trade from "../models/trade";
import { TradeItemType } from "../models/tradeItem";
import DraftPick from "../models/draftPick";
import Player from "../models/player";

export type EmailJobName = "reset_pass" | "registration_email" | "test_email" | "handle_webhook" | "request_trade" | "trade_declined" | "trade_accepted";

type AuthEmailFunction = (u: User) => Promise<SendInBlueSendResponse>;
type TradeEmailFunction = (r: string, t: Trade) => Promise<SendInBlueSendResponse>;
type WebhookEmailFunction = (event: any, dao?: any) => Promise<void>;

export interface EmailJob {
    user?: string; // JSON representation of user
    event?: string; // JSON representation of email_event
}

export interface TradeEmail {
    trade: string; // JSON representation of trade
    recipient: string;
}

interface EmailCallbacks {
    reset_pass: AuthEmailFunction;
    test_email: AuthEmailFunction;
    registration_email: AuthEmailFunction;
    handle_webhook: WebhookEmailFunction;
    request_trade: TradeEmailFunction;
    trade_declined: TradeEmailFunction;
    trade_accepted: TradeEmailFunction;
}

export const emailCallbacks: EmailCallbacks = {
    reset_pass: Emailer.sendPasswordResetEmail,
    test_email: Emailer.sendTestEmail,
    registration_email: Emailer.sendRegistrationEmail,
    handle_webhook: handleWebhookResponse,
    request_trade: Emailer.sendTradeRequestEmail,
    trade_declined: Emailer.sendTradeDeclinedEmail,
    trade_accepted: Emailer.sendTradeSubmissionEmail,
};

const authEmailTasks = ["reset_pass", "test_email", "registration_email"];

export async function handleEmailJob(emailJob: Job<EmailJob>) {
    logger.debug(`processing ${emailJob.name} email job#${emailJob.id}`);
    const emailTask = emailCallbacks[emailJob.name as EmailJobName];

    if (emailJob.name === "handle_webhook" && emailJob.data.user) {
        const event = JSON.parse(emailJob.data.user);
        return await (emailTask as WebhookEmailFunction)(event);
    } else if (authEmailTasks.includes(emailJob.name) && emailJob.data.user) {
        const user = new User(JSON.parse(emailJob.data.user));
        return await (emailTask as AuthEmailFunction)(user);
    }
}

export async function handleTradeEmailJob(emailJob: Job<TradeEmail>) {
    logger.debug(`processing ${emailJob.name} email job#${emailJob.id}`);
    const emailTask = emailCallbacks[emailJob.name as EmailJobName];

    if (emailJob.data.trade && emailJob.data.recipient) {
        const trade = new Trade(JSON.parse(emailJob.data.trade));
        for (const item of (trade.tradeItems || [])) {
            if (item.tradeItemType === TradeItemType.PLAYER) {
                item.entity = new Player(item.entity as Partial<Player> & Required<Pick<Player, "name">>);
            }
            if (item.tradeItemType === TradeItemType.PICK) {
                item.entity = new DraftPick(item.entity as Partial<DraftPick> & Required<Pick<DraftPick, "season" | "round" | "type">>);
            }
        }
        return await emailTask(trade, emailJob.data.recipient);
    }
}

export async function handleWebhookResponse(event: EmailStatusEvent, dao?: EmailDAO): Promise<void> {
    const emailDAO = dao || new EmailDAO();
    const email = await emailDAO.getEmailByMessageId(event["message-id"]);
    if (email) {
        email.status = event.event;
        await emailDAO.updateEmail(email);
    }
}
