import { Job } from "bull";
import logger from "../bootstrap/logger";
import { EMAILER, SendInBlueSendResponse } from "./mailer";
import User from "../models/user";
import Trade from "../models/trade";
import { TradeItemType } from "../models/tradeItem";
import DraftPick from "../models/draftPick";
import Player from "../models/player";

export type EmailJobName =
    | "reset_pass"
    | "registration_email"
    | "test_email"
    | "request_trade"
    | "trade_declined"
    | "trade_accepted";

type AuthEmailFunction = (u: User) => Promise<SendInBlueSendResponse | undefined>;
type TradeEmailFunction = (r: string, t: Trade) => Promise<SendInBlueSendResponse | undefined>;

export interface EmailJob {
    user?: string; // JSON representation of user
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
    request_trade: TradeEmailFunction;
    trade_declined: TradeEmailFunction;
    trade_accepted: TradeEmailFunction;
}

export const emailCallbacks: EmailCallbacks = {
    reset_pass: EMAILER.sendPasswordResetEmail,
    test_email: EMAILER.sendTestEmail,
    registration_email: EMAILER.sendRegistrationEmail,
    request_trade: EMAILER.sendTradeRequestEmail,
    trade_declined: EMAILER.sendTradeDeclinedEmail,
    trade_accepted: EMAILER.sendTradeSubmissionEmail,
};
/* eslint-enable @typescript-eslint/naming-convention */

const authEmailTasks = ["reset_pass", "test_email", "registration_email"];

export async function handleEmailJob(emailJob: Job<EmailJob>): Promise<SendInBlueSendResponse | void> {
    logger.debug(`processing ${emailJob.name} email job#${emailJob.id}`);
    const emailTask = emailCallbacks[emailJob.name as EmailJobName];

    if (authEmailTasks.includes(emailJob.name) && emailJob.data.user) {
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
        return (emailTask as TradeEmailFunction)(emailJob.data.recipient, trade);
    }
}

