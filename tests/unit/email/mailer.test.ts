import "jest";
import "jest-extended";
import { Emailer } from "../../../src/email/mailer";
import { UserFactory } from "../../factories/UserFactory";
import logger from "../../../src/bootstrap/logger";
import { TradeFactory } from "../../factories/TradeFactory";
import { DraftPickFactory } from "../../factories/DraftPickFactory";
import { PlayerFactory } from "../../factories/PlayerFactory";
import { PlayerLeagueType } from "../../../src/models/player";

jest.mock("../../../src/DAO/EmailDAO");

describe("Emailer Class", () => {
    beforeAll(() => {
        logger.debug("~~~~~~EMAILER TESTS BEGIN~~~~~~");
    });
    afterAll(() => {
        logger.debug("~~~~~~EMAILER TESTS COMPLETE~~~~~~");
    });
    const testUser = UserFactory.getUser("test@example.com", "Jatheesh", undefined, undefined, {id: "test-uuid", passwordResetToken: "random-token"});
    const testItems = [
        TradeFactory.getTradedMajorPlayer(PlayerFactory.getPlayer(undefined, PlayerLeagueType.MAJOR, {mlbTeam: "Pirates", meta: {espnPlayer: {player: {eligibleSlots: [0, 1, 7]}}}})),
        TradeFactory.getTradedMinorPlayer(PlayerFactory.getPlayer("MiniMe", undefined, {meta: {minorLeaguePlayerFromSheet: {mlbTeam: "Jays", position: "P", leagueLevel: "Low"}}})),
        TradeFactory.getTradedPick(DraftPickFactory.getPick(undefined, undefined, undefined, undefined)),
    ];
    const testTrade = TradeFactory.getTrade( testItems, undefined, undefined, {id: "test-uuid"});

    describe("email snapshots", () => {
        // each test removes dynamic message/messageId values that we don't want to match on in our snapshots
        it("sendTestEmail", async () => {
            const {message, messageId, ...res} = await Emailer.sendTestEmail(testUser);
            expect(res).toMatchSnapshot();
        });

        it("sendRegistrationEmail", async () => {
            const {message, messageId, ...res} = await Emailer.sendRegistrationEmail(testUser);
            expect(res).toMatchSnapshot();
        });

        it("sendPasswordResetEmail", async () => {
            const {message, messageId, ...res} = await Emailer.sendPasswordResetEmail(testUser);
            expect(res).toMatchSnapshot();
        });

        it("sendTradeRequestEmail", async () => {
            const {message, messageId, ...res} = await Emailer.sendTradeRequestEmail(testUser.email, testTrade);
            expect(res).toMatchSnapshot();
        });

        it("sendTradeSubmissionEmail", async () => {
            const {message, messageId, ...res} = await Emailer.sendTradeSubmissionEmail(testUser.email, testTrade);
            expect(res).toMatchSnapshot();
        });

        it("sendTradeDeclinedEmail", async () => {
            const {message, messageId, ...res} = await Emailer.sendTradeDeclinedEmail(testUser.email, testTrade);
            expect(res).toMatchSnapshot();
        });
    });
});
