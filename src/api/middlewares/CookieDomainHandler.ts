import { Request } from "express";
import logger from "../../bootstrap/logger";

/**
 * Allowed Netlify origins that should have cookies set with .netlify.app domain
 */
const ALLOWED_NETLIFY_ORIGINS = [
    "https://staging--ffftemp.netlify.app",
    "https://ffftemp.akosua.xyz",
] as const;

/**
 * Extract origin from a URL string
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

/**
 * Check if the request origin matches one of the allowed Netlify origins
 * @param req Express request object
 * @returns true if the origin matches an allowed Netlify origin, false otherwise
 */
export function isNetlifyOrigin(req: Request): boolean {
    // Check Origin header first (most reliable for CORS requests)
    const origin = req.get("Origin");
    if (origin) {
        const extractedOrigin = extractOriginFromUrl(origin);
        if (extractedOrigin && ALLOWED_NETLIFY_ORIGINS.includes(extractedOrigin as any)) {
            logger.debug(`Detected Netlify origin from Origin header: ${extractedOrigin}`);
            return true;
        }
    }

    // Fall back to Referer header if Origin is not available
    const referer = req.get("Referer");
    if (referer) {
        const extractedOrigin = extractOriginFromUrl(referer);
        if (extractedOrigin && ALLOWED_NETLIFY_ORIGINS.includes(extractedOrigin as any)) {
            logger.debug(`Detected Netlify origin from Referer header: ${extractedOrigin}`);
            return true;
        }
    }

    return false;
}
