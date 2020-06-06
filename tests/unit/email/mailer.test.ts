import "jest";
import "jest-extended";
import { Emailer } from "../../../src/email/mailer";
import { UserFactory } from "../../factories/UserFactory";
import { config as dotenvConfig } from "dotenv";
import { resolve as resolvePath } from "path";
import logger from "../../../src/bootstrap/logger";

dotenvConfig({path: resolvePath(__dirname, "../../.env")}); // required for api keys

describe("Emailer Class", () => {
    beforeAll(() => {
        logger.debug("~~~~~~EMAILER TESTS BEGIN~~~~~~");
    });
    afterAll(() => {
        logger.debug("~~~~~~EMAILER TESTS COMPLETE~~~~~~");
    });
    const testUser = UserFactory.getUser("test@example.com", "Jatheesh", undefined, undefined, {id: "test-uuid"});

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
    });
});
