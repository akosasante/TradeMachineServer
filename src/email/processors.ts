import { Job } from "bull";
import logger from "../bootstrap/logger";
import { EMAILER, SendInBlueSendResponse } from "./mailer";
import User from "../models/user";
import { EmailStatusEvent } from "../api/routes/EmailController";
import EmailDAO from "../DAO/EmailDAO";
import Trade from "../models/trade";
import { TradeItemType } from "../models/tradeItem";
import DraftPick from "../models/draftPick";
import Player from "../models/player";
import Email from "../models/email";

export type EmailJobName =
    | "reset_pass"
    | "registration_email"
    | "test_email"
    | "handle_webhook"
    | "request_trade"
    | "trade_declined"
    | "trade_accepted";

type AuthEmailFunction = (u: User) => Promise<SendInBlueSendResponse | undefined>;
type TradeEmailFunction = (r: string, t: Trade) => Promise<SendInBlueSendResponse | undefined>;
type WebhookEmailFunction = (event: any, dao?: any) => Promise<void>;

export interface EmailJob {
    user?: string; // JSON representation of user
    event?: string; // JSON representation of email_event
}

export interface TradeEmail {
    trade: string; // JSON representation of trade
    recipient: string;
}

/* eslint-disable @typescript-eslint/naming-convention */
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
    reset_pass: EMAILER.sendPasswordResetEmail,
    test_email: EMAILER.sendTestEmail,
    registration_email: EMAILER.sendRegistrationEmail,
    handle_webhook: handleWebhookResponse,
    request_trade: EMAILER.sendTradeRequestEmail,
    trade_declined: EMAILER.sendTradeDeclinedEmail,
    trade_accepted: EMAILER.sendTradeSubmissionEmail,
};
/* eslint-enable @typescript-eslint/naming-convention */

const authEmailTasks = ["reset_pass", "test_email", "registration_email"];

export async function handleEmailJob(emailJob: Job<EmailJob>): Promise<SendInBlueSendResponse | void> {
    logger.debug(`processing ${emailJob.name} email job#${emailJob.id}`);
    const emailTask = emailCallbacks[emailJob.name as EmailJobName];

    if (emailJob.name === "handle_webhook" && emailJob.data.event) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const event = JSON.parse(emailJob.data.event);
        return (emailTask as WebhookEmailFunction)(event);
    } else if (authEmailTasks.includes(emailJob.name) && emailJob.data.user) {
        const user = new User(JSON.parse(emailJob.data.user) as Partial<User> & Required<Pick<User, "email">>);
        return (emailTask as AuthEmailFunction)(user);
    }
}

export async function handleTradeEmailJob(emailJob: Job<TradeEmail>): Promise<SendInBlueSendResponse | void> {
    logger.debug(`processing ${emailJob.name} email job#${emailJob.id}`);
    const emailTask = emailCallbacks[emailJob.name as EmailJobName];

    if (emailJob.data.trade && emailJob.data.recipient) {
        const trade = new Trade(JSON.parse(emailJob.data.trade) as Partial<Trade>);
        for (const item of trade.tradeItems || []) {
            if (item.tradeItemType === TradeItemType.PLAYER) {
                item.entity = new Player(item.entity as Partial<Player> & Required<Pick<Player, "name">>);
            }
            if (item.tradeItemType === TradeItemType.PICK) {
                item.entity = new DraftPick(
                    item.entity as Partial<DraftPick> & Required<Pick<DraftPick, "season" | "round" | "type">>
                );
            }
        }
        return emailTask(emailJob.data.recipient, trade);
    }
}

export async function handleWebhookResponse(event: EmailStatusEvent, dao?: EmailDAO): Promise<void> {
    const emailDAO = dao || new EmailDAO();
    const email =
        (await emailDAO.getEmailByMessageId(event["message-id"])) || new Email({ messageId: event["message-id"] });
    email.status = event.event;
    await emailDAO.updateEmail(email);
}
