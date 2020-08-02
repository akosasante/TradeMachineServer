import "jest";
import "jest-extended";
import {Emailer} from "../../../src/email/mailer";
import {UserFactory} from "../../factories/UserFactory";
import logger from "../../../src/bootstrap/logger";
import {TradeFactory} from "../../factories/TradeFactory";
import {DraftPickFactory} from "../../factories/DraftPickFactory";
import {TeamFactory} from "../../factories/TeamFactory";
import {PlayerFactory} from "../../factories/PlayerFactory";
import {PlayerLeagueType} from "../../../src/models/player";

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
        TradeFactory.getTradedPick(DraftPickFactory.getPick(undefined, undefined, undefined, undefined, { originalOwner: TeamFactory.getTeam() })),
    ];
    const testTrade = TradeFactory.getTrade( testItems, undefined, undefined, {id: "test-uuid"});

    describe("email snapshots", () => {
        it("sendTestEmail", async () => {
            const res = await Emailer.sendTestEmail(testUser);
            delete res.message; // value varies due to include a dynamic messageId so keep it out of the snapshot
            delete res.messageId;
            expect(res).toMatchSnapshot();
        });

        it("sendRegistrationEmail", async () => {
            const res = await Emailer.sendRegistrationEmail(testUser);
            delete res.message; // value varies due to include a dynamic messageId so keep it out of the snapshot
            delete res.messageId;
            expect(res).toMatchSnapshot();
        });

        it("sendPasswordResetEmail", async () => {
            const res = await Emailer.sendPasswordResetEmail(testUser);
            delete res.message; // value varies due to include a dynamic messageId so keep it out of the snapshot
            delete res.messageId;
            expect(res).toMatchSnapshot();
        });

        it("sendTradeRequestEmail", async () => {
            const res = await Emailer.sendTradeRequestEmail("test@example.com", testTrade);
            delete res.message;
            delete res.messageId;
            expect(res).toMatchSnapshot();
        });

        it("sendTradeSubmissionEmail", async () => {
            const res = await Emailer.sendTradeSubmissionEmail("test@exaample.com", testTrade);
            delete res.message;
            delete res.messageId;
            expect(res).toMatchSnapshot();
        });
    });
});
