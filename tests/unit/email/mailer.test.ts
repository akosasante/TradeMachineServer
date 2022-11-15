import { EMAILER } from "../../../src/email/mailer";
import { UserFactory } from "../../factories/UserFactory";
import logger from "../../../src/bootstrap/logger";
import { TradeFactory } from "../../factories/TradeFactory";
import { DraftPickFactory } from "../../factories/DraftPickFactory";
import { PlayerFactory } from "../../factories/PlayerFactory";
import { PlayerLeagueType } from "../../../src/models/player";

jest.mock("../../../src/DAO/EmailDAO");

describe("EMAILER Class", () => {
    beforeAll(() => {
        logger.debug("~~~~~~EMAILER TESTS BEGIN~~~~~~");
    });
    afterAll(() => {
        logger.debug("~~~~~~EMAILER TESTS COMPLETE~~~~~~");
    });
    const testUser = UserFactory.getUser("test@example.com", "Jatheesh", undefined, undefined, {
        id: "test-uuid",
        passwordResetToken: "random-token",
    });
    const testItems = [
        TradeFactory.getTradedMajorPlayer(
            PlayerFactory.getPlayer(undefined, PlayerLeagueType.MAJOR, {
                mlbTeam: "Pirates",
                meta: { espnPlayer: { player: { eligibleSlots: [0, 1, 7] } } },
            })
        ),
        TradeFactory.getTradedMinorPlayer(
            PlayerFactory.getPlayer("MiniMe", undefined, {
                meta: {
                    minorLeaguePlayerFromSheet: {
                        mlbTeam: "Jays",
                        position: "P",
                        leagueLevel: "Low",
                    },
                },
            })
        ),
        TradeFactory.getTradedPick(DraftPickFactory.getPick(undefined, undefined, undefined, undefined)),
    ];
    const testTrade = TradeFactory.getTrade(testItems, undefined, undefined, { id: "test-uuid" });

    describe("email snapshots", () => {
        // each test removes dynamic message/messageId values that we don't want to match on in our snapshots
        it("sendTestEmail", async () => {
            const email = await EMAILER.sendTestEmail(testUser);
            if (!email) {
                throw new Error("sendTestEmail returned undefined");
            }
            const { message, messageId, ...res } = email;
            expect(res).toMatchSnapshot();
        });

        it("sendRegistrationEmail", async () => {
            const email = await EMAILER.sendRegistrationEmail(testUser);
            if (!email) {
                throw new Error("sendRegistrationEmail returned undefined");
            }
            const { message, messageId, ...res } = email;
            expect(res).toMatchSnapshot();
        });

        it("sendPasswordResetEmail", async () => {
            const email = await EMAILER.sendPasswordResetEmail(testUser);
            if (!email) {
                throw new Error("sendPasswordResetEmail returned undefined");
            }
            const { message, messageId, ...res } = email;
            expect(res).toMatchSnapshot();
        });

        it("sendTradeRequestEmail", async () => {
            const email = await EMAILER.sendTradeRequestEmail(testUser.email, testTrade);
            if (!email) {
                throw new Error("sendTradeRequestEmail returned undefined");
            }
            const { message, messageId, ...res } = email;
            expect(res).toMatchSnapshot();
        });

        it("sendTradeSubmissionEmail", async () => {
            const email = await EMAILER.sendTradeSubmissionEmail(testUser.email, testTrade);
            if (!email) {
                throw new Error("sendTradeSubmissionEmail returned undefined");
            }
            const { message, messageId, ...res } = email;
            expect(res).toMatchSnapshot();
        });

        it("sendTradeDeclinedEmail", async () => {
            testTrade.recipients[0].owners = [UserFactory.getOwnerUser()];
            testTrade.declinedById = testTrade.recipients[0].owners?.[0].id;
            testTrade.declinedReason = "horrible mismatch for me";
            const email = await EMAILER.sendTradeDeclinedEmail(testUser.email, testTrade);
            if (!email) {
                throw new Error("sendTradeDeclinedEmail returned undefined");
            }
            const { message, messageId, ...res } = email;
            expect(res).toMatchSnapshot();
        });
    });
});
