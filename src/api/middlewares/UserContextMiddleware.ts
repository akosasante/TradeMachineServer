import { NextFunction, Request, Response } from "express";
import { trace } from "@opentelemetry/api";
import { requestContext } from "../../utils/requestContext";

/**
 * Sets user identity and IP address on the active OTel span so that every
 * request trace in Tempo is queryable by user.id / user.email.
 *
 * Also runs the rest of the request inside an AsyncLocalStorage context so that
 * Winston log entries emitted from code without access to `req` (e.g. DAOs) will
 * automatically include userId / userEmail / ip.
 *
 * Must be registered after express-session middleware in express.ts.
 */
export function userContextMiddleware(req: Request, _res: Response, next: NextFunction): void {
    const userId = req.session?.user;
    const userEmail = req.session?.userEmail;
    const userName = req.session?.userName;
    const ip = req.ip;

    // Set attributes on the active OTel span (created by auto-instrumentation)
    const span = trace.getActiveSpan();
    if (span) {
        if (userId) span.setAttribute("user.id", userId);
        if (userEmail) span.setAttribute("user.email", userEmail);
        if (userName) span.setAttribute("user.name", userName);
        if (ip) span.setAttribute("client.address", ip);
    }

    // Run downstream middleware and handlers inside ALS so Winston can pick up context
    const store = { userId, userEmail, userName, ip };
    requestContext.run(store, () => next());
}
