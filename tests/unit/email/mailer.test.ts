import "jest";
import "jest-extended";
import { Emailer } from "../../../src/email/mailer";
import { UserFactory } from "../../factories/UserFactory";
import logger from "../../../src/bootstrap/logger";
import { TradeFactory } from "../../factories/TradeFactory";

describe("Emailer Class", () => {
    beforeAll(() => {
        logger.debug("~~~~~~EMAILER TESTS BEGIN~~~~~~");
    });
    afterAll(() => {
        logger.debug("~~~~~~EMAILER TESTS COMPLETE~~~~~~");
    });
    const testUser = UserFactory.getUser("test@example.com", "Jatheesh", undefined, undefined, {id: "test-uuid"});
    const testTrade = TradeFactory.getTrade( undefined, undefined, undefined, {id: "test-uuid"});

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
    });
});
