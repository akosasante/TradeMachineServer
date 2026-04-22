/**
 * When USE_V3_TRADE_LINKS and V3_BASE_URL are enabled, recipients get V3 magic-link URLs only
 * if they appear on V3_TRADE_LINK_EMAIL_ALLOWLIST (case-insensitive comma-separated emails).
 *
 * If the allowlist env is unset, empty, or parses only whitespace, no recipient gets V3 links (safe default).
 * Use a single "*" entry on the allowlist to treat all non-empty recipient emails as allowed.
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
 * Trim and strip trailing slashes from V3_BASE_URL so `${base}/trades/...` never becomes `//trades/...`.
 */
export function normalizeV3BaseUrl(raw: string | undefined): string | undefined {
    const t = raw?.trim();
    if (!t) {
        return undefined;
    }
    return t.replace(/\/+$/, "");
}

/**
 * True when this recipient should get V3 URLs in trade emails (tokens, /trades/...).
 * False when USE_V3_TRADE_LINKS or V3_BASE_URL is off, email missing, allowlist is unset/empty,
 * or the address is not allowlisted. Allowlist entry "*" alone matches any non-empty email.
 */
export function shouldUseV3TradeLinkForEmail(email: string | null | undefined): boolean {
    if (process.env.USE_V3_TRADE_LINKS !== "true" || !normalizeV3BaseUrl(process.env.V3_BASE_URL)) {
        return false;
    }
    const normalized = email?.trim().toLowerCase();
    if (!normalized) {
        return false;
    }
    const allowlist = getAllowlist();
    if (allowlist === null) {
        return false;
    }
    if (allowlist.has("*")) {
        return true;
    }
    return allowlist.has(normalized);
}
