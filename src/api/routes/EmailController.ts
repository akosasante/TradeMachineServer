import { Request, Response } from "express";
import { Body, BodyParam, Controller, NotFoundError, Post, Req, Res } from "routing-controllers";
import { inspect } from "util";
import logger from "../../bootstrap/logger";
import UserDAO from "../../DAO/UserDAO";
import { EmailPublisher } from "../../email/publishers";
import { rollbar } from "../../bootstrap/rollbar";
import { getPrismaClientFromRequest } from "../../bootstrap/prisma-db";
import ObanDAO, { WebhookStatusJobData } from "../../DAO/v2/ObanDAO";
import { extractTraceContext } from "../../utils/tracing";

export interface EmailStatusEvent {
    id: number;
    event: string;
    email: string;
    date: string;
    /* eslint-disable @typescript-eslint/naming-convention */
    "message-id": string;
    ts_epoch?: number;
    ts_event?: number;
    /* eslint-enable @typescript-eslint/naming-convention */
    ts?: number;
    subject?: string;
    tag?: string;
    tags?: string[];
    reason?: string;
    link?: string;
}

function envFromTags(tags?: string[]): WebhookStatusJobData["env"] {
    if (tags?.includes("staging")) return "staging";
    return "production";
}

@Controller("/email")
export default class EmailController {
    private userDao: UserDAO;
    private emailPublisher: EmailPublisher;

    constructor(userDAO?: UserDAO, publisher?: EmailPublisher) {
        this.userDao = userDAO || new UserDAO();
        this.emailPublisher = publisher || EmailPublisher.getInstance();
    }

    @Post("/sendInMailWebhook")
    public async receiveSendInMailWebhook(
        @Body() event: EmailStatusEvent,
        @Res() response: Response,
        @Req() request: Request
    ): Promise<Response> {
        rollbar.info("receiveSendInMailWebhook", { event }, request);
        logger.debug(`Received email webhook: ${inspect(event)}`);

        const prisma = getPrismaClientFromRequest(request);
        if (!prisma || !prisma.obanJob) {
            logger.error("obanJob model not available in Prisma client");
            return response.status(500).json({ error: "obanJob not available in Prisma client" });
        }

        const obanDao = new ObanDAO(prisma.obanJob);
        const traceContext = extractTraceContext();
        await obanDao.enqueueEmailWebhookJob({
            env: envFromTags(event.tags),
            message_id: event["message-id"],
            event: event.event,
            email: event.email,
            reason: event.reason,
            trace_context: traceContext || undefined,
        });

        return response.status(200).json({});
    }

    @Post("/testEmail")
    public async sendTestEmail(
        @BodyParam("email") email: string,
        @Res() response: Response,
        @Req() request?: Request
    ): Promise<Response> {
        rollbar.info("sendTestEmail", { email }, request);
        logger.debug(`Preparing to send test email to: ${email}`);
        const user = await this.userDao.findUser({ email });

        if (!user) {
            throw new NotFoundError("No user found with the given email.");
        } else {
            // Queue send email with current user
            await this.emailPublisher.queueTestEmail(user);
            return response.status(202).json({ status: "email queued" });
        }
    }
}
