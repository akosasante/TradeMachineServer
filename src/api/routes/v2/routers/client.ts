import { publicProcedure, router, withTracing } from "../trpc";
import { addSpanAttributes, addSpanEvent } from "../../../../utils/tracing";
import logger from "../../../../bootstrap/logger";

export const clientRouter = router({
    getIP: publicProcedure.query(
        withTracing("trpc.client.getIP", async (input, ctx, span) => {
            logger.debug("tRPC client IP request");

            addSpanAttributes({
                "client.action": "getIP",
                "client.method": "trpc"
            });

            addSpanEvent("get_ip.start");

            // Extract IP from headers set by reverse proxies or direct connection
            const xForwardedFor = ctx.req.headers["x-forwarded-for"];
            const xRealIp = ctx.req.headers["x-real-ip"];
            const remoteAddress = ctx.req.connection?.remoteAddress || ctx.req.socket?.remoteAddress;

            // Determine the client IP following standard proxy header precedence
            let clientIP: string;

            if (xForwardedFor) {
                // x-forwarded-for can contain multiple IPs, take the first one (original client)
                clientIP = Array.isArray(xForwardedFor) ? xForwardedFor[0] : xForwardedFor.split(",")[0].trim();
            } else if (xRealIp) {
                clientIP = Array.isArray(xRealIp) ? xRealIp[0] : xRealIp;
            } else {
                clientIP = remoteAddress || "unknown";
            }

            addSpanAttributes({
                "client.ip": clientIP,
                "client.ip_source": xForwardedFor ? "x-forwarded-for" : xRealIp ? "x-real-ip" : "direct",
                "client.has_proxy_headers": !!(xForwardedFor || xRealIp)
            });

            addSpanEvent("get_ip.success", {
                ip: clientIP,
                source: xForwardedFor ? "x-forwarded-for" : xRealIp ? "x-real-ip" : "direct"
            });

            logger.debug(`Client IP detected: ${clientIP}`);

            return { ip: clientIP };
        })
    )
});
