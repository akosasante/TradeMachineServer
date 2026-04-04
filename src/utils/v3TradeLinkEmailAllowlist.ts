/**
 * When USE_V3_TRADE_LINKS and V3_BASE_URL are enabled, optionally restrict which recipient
 * emails receive V3 magic-link URLs (vs classic /trade/... links).
 *
 * V3_TRADE_LINK_EMAIL_ALLOWLIST — comma-separated addresses, case-insensitive.
 * If unset or empty after parsing, all recipients with V3 enabled globally get V3 links.
 */

let cachedAllowlist: Set<string> | null | undefined;

function parseAllowlist(): Set<string> | null {
    const raw = process.env.V3_TRADE_LINK_EMAIL_ALLOWLIST?.trim();
    if (!raw) {
        return null;
    }
    const entries = raw
        .split(",")
        .map(e => e.trim().toLowerCase())
        .filter(Boolean);
    if (entries.length === 0) {
        return null;
    }
    return new Set(entries);
}

function getAllowlist(): Set<string> | null {
    if (cachedAllowlist === undefined) {
        cachedAllowlist = parseAllowlist();
    }
    return cachedAllowlist;
}

/** Test hook: clear cached env parse. */
export function resetV3TradeLinkEmailAllowlistCacheForTests(): void {
    cachedAllowlist = undefined;
}

/**
 * True when this recipient should get V3 URLs in trade emails (tokens, /trades/...).
 * False when USE_V3_TRADE_LINKS or V3_BASE_URL is off, email missing, or allowlist excludes them.
 */
export function shouldUseV3TradeLinkForEmail(email: string | null | undefined): boolean {
    if (process.env.USE_V3_TRADE_LINKS !== "true" || !process.env.V3_BASE_URL?.trim()) {
        return false;
    }
    const normalized = email?.trim().toLowerCase();
    if (!normalized) {
        return false;
    }
    const allowlist = getAllowlist();
    if (allowlist === null) {
        return true;
    }
    return allowlist.has(normalized);
}
