import {
    normalizeV3BaseUrl,
    resetV3TradeLinkEmailAllowlistCacheForTests,
    shouldUseV3TradeLinkForEmail,
} from "../../../src/utils/v3TradeLinkEmailAllowlist";

describe("v3TradeLinkEmailAllowlist", () => {
    const prev = { ...process.env };

    afterEach(() => {
        process.env = { ...prev };
        resetV3TradeLinkEmailAllowlistCacheForTests();
    });

    it("returns false when USE_V3_TRADE_LINKS is not true", () => {
        delete process.env.USE_V3_TRADE_LINKS;
        process.env.V3_BASE_URL = "https://v3.example";
        expect(shouldUseV3TradeLinkForEmail("a@example.com")).toBe(false);
    });

    it("returns false when V3_BASE_URL is missing", () => {
        process.env.USE_V3_TRADE_LINKS = "true";
        delete process.env.V3_BASE_URL;
        expect(shouldUseV3TradeLinkForEmail("a@example.com")).toBe(false);
    });

    it("treats V3_BASE_URL with only whitespace as missing", () => {
        process.env.USE_V3_TRADE_LINKS = "true";
        process.env.V3_BASE_URL = "   ";
        expect(shouldUseV3TradeLinkForEmail("a@example.com")).toBe(false);
    });

    it("accepts V3_BASE_URL with trailing slashes for allowlist gating", () => {
        process.env.USE_V3_TRADE_LINKS = "true";
        process.env.V3_BASE_URL = "https://v3.example///";
        process.env.V3_TRADE_LINK_EMAIL_ALLOWLIST = "*";
        resetV3TradeLinkEmailAllowlistCacheForTests();
        expect(shouldUseV3TradeLinkForEmail("a@example.com")).toBe(true);
    });

    it("returns false for empty email", () => {
        process.env.USE_V3_TRADE_LINKS = "true";
        process.env.V3_BASE_URL = "https://v3.example";
        expect(shouldUseV3TradeLinkForEmail("")).toBe(false);
        expect(shouldUseV3TradeLinkForEmail(null)).toBe(false);
    });

    it("returns false when allowlist env is unset (safe default)", () => {
        process.env.USE_V3_TRADE_LINKS = "true";
        process.env.V3_BASE_URL = "https://v3.example";
        delete process.env.V3_TRADE_LINK_EMAIL_ALLOWLIST;
        expect(shouldUseV3TradeLinkForEmail("Anyone@Example.COM")).toBe(false);
    });

    it("returns true for any email when allowlist is a single asterisk", () => {
        process.env.USE_V3_TRADE_LINKS = "true";
        process.env.V3_BASE_URL = "https://v3.example";
        process.env.V3_TRADE_LINK_EMAIL_ALLOWLIST = "*";
        resetV3TradeLinkEmailAllowlistCacheForTests();
        expect(shouldUseV3TradeLinkForEmail("Anyone@Example.COM")).toBe(true);
    });

    it("restricts to allowlisted emails when set", () => {
        process.env.USE_V3_TRADE_LINKS = "true";
        process.env.V3_BASE_URL = "https://v3.example";
        process.env.V3_TRADE_LINK_EMAIL_ALLOWLIST = " Beta@Example.com , other@x.test ";
        resetV3TradeLinkEmailAllowlistCacheForTests();
        expect(shouldUseV3TradeLinkForEmail("beta@example.com")).toBe(true);
        expect(shouldUseV3TradeLinkForEmail("other@x.test")).toBe(true);
        expect(shouldUseV3TradeLinkForEmail("nope@example.com")).toBe(false);
    });
});

describe("normalizeV3BaseUrl", () => {
    it("returns undefined for empty input", () => {
        expect(normalizeV3BaseUrl(undefined)).toBeUndefined();
        expect(normalizeV3BaseUrl("")).toBeUndefined();
        expect(normalizeV3BaseUrl("  ")).toBeUndefined();
    });

    it("strips trailing slashes and whitespace", () => {
        expect(normalizeV3BaseUrl("https://ffftemp.akosua.xyz/")).toBe("https://ffftemp.akosua.xyz");
        expect(normalizeV3BaseUrl("  https://x.test///  ")).toBe("https://x.test");
    });
});
