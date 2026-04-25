import { Request, Response } from "express";
import type { Session } from "express-session";
import logger from "../../bootstrap/logger";

/** Must match getSessionCookieName() in bootstrap/express.ts */
function getSessionCookieNameForPatch(): string {
    return process.env.APP_ENV === "staging" ? "staging_trades.sid" : "trades.sid";
}

/** V3 beta on this hostname uses the same cookie-domain stripping as Netlify previews. */
const ALLOWED_AKOSUA_UI_ORIGINS = ["https://ffftemp.akosua.xyz"] as const;

/**
 * Extract origin from a URL string.
 *
 * Handles URLs with or without trailing slashes, query params, and paths
 */
function extractOriginFromUrl(url: string): string | null {
    try {
        // Remove trailing slash if present
        const cleanedUrl = url.trim().replace(/\/$/, "");
        const urlObj = new URL(cleanedUrl);
        return urlObj.origin;
    } catch (error) {
        logger.debug(`Failed to parse URL: ${url}`, error);
        return null;
    }
}

function isHttpsNetlifyAppOrigin(extractedOrigin: string): boolean {
    try {
        const u = new URL(extractedOrigin);
        return u.protocol === "https:" && u.hostname.endsWith(".netlify.app");
    } catch {
        return false;
    }
}

function originNeedsNetlifyStyleSessionCookie(extractedOrigin: string): boolean {
    return (
        (ALLOWED_AKOSUA_UI_ORIGINS as readonly string[]).includes(extractedOrigin) ||
        isHttpsNetlifyAppOrigin(extractedOrigin)
    );
}

/**
 * Check if the request origin should use Netlify-style session cookies (strip Domain on Set-Cookie).
 *
 * @param req Express request object
 * @returns true if the origin matches an allowed Netlify origin, false otherwise
 */
export function isNetlifyOrigin(req: Request): boolean {
    // Check Origin header first (most reliable for CORS requests)
    const origin = req.get("Origin");
    if (origin) {
        const extractedOrigin = extractOriginFromUrl(origin);
        if (extractedOrigin && originNeedsNetlifyStyleSessionCookie(extractedOrigin)) {
            logger.debug(`Detected Netlify-style UI origin from Origin header: ${extractedOrigin}`);
            return true;
        }
        // If Origin header exists but doesn't match, return false immediately
        // (don't fall back to Referer - Origin takes priority)
        return false;
    }

    // Fall back to Referer header only if Origin is not available
    const referer = req.get("Referer");
    if (referer) {
        const extractedOrigin = extractOriginFromUrl(referer);
        if (extractedOrigin && originNeedsNetlifyStyleSessionCookie(extractedOrigin)) {
            logger.debug(`Detected Netlify-style UI origin from Referer header: ${extractedOrigin}`);
            return true;
        }
    }

    return false;
}

/**
 * When the V3 UI is hosted on Netlify (*.netlify.app) or the beta akosua host, browsers can reject
 * session cookies that still carry Domain=.akosua.xyz from the API. Patch outgoing Set-Cookie headers
 * to drop Domain (host-only on the API), matching auth.login.
 */
export function applyNetlifySessionCookieHeaderPatch(req: Request, res: Response): void {
    if (!isNetlifyOrigin(req)) {
        return;
    }
    const cookieName = getSessionCookieNameForPatch();
    const originalSetHeader = res.setHeader.bind(res);
    res.setHeader = function (name: string, value: string | string[]) {
        if (name.toLowerCase() === "set-cookie") {
            const cookies = Array.isArray(value) ? value : [value];
            const modifiedCookies = cookies.map(cookie => {
                if (cookie.includes(cookieName)) {
                    const modified = cookie.replace(/;\s*Domain=[^;]*/gi, "");
                    logger.debug(
                        `Removed Domain attribute from Set-Cookie header for Netlify-style origin: ${cookieName}`
                    );
                    return modified;
                }
                return cookie;
            });
            return originalSetHeader(name, modifiedCookies);
        }
        return originalSetHeader(name, value);
    };
}

export function saveExpressSession(session: Session): Promise<void> {
    return new Promise((resolve, reject) => {
        session.save(err => {
            if (err) {
                logger.error("Could not save session:", err);
                reject(new Error("Could not save session"));
            } else {
                resolve();
            }
        });
    });
}
