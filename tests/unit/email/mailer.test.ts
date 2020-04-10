import "jest";
import "jest-extended";
import { Emailer } from "../../../src/email/mailer";
import { UserFactory } from "../../factories/UserFactory";
import { config as dotenvConfig } from "dotenv";
import { resolve as resolvePath } from "path";

dotenvConfig({path: resolvePath(__dirname, "../../.env")}); // required for api keys

describe("Emailer Class", () => {
    const emailer = new Emailer();
    const testUser = UserFactory.getUser("test@example.com", "Jatheesh");

    describe("email snapshots", () => {
        it("sendTestEmail", async () => {
            const res = await emailer.sendTestEmail(testUser);
            delete res.messageId; // value varies so keep it out of the snapshot
            expect(res).toMatchSnapshot();
        });

        it("sendRegistrationEmail", async () => {
            const res = await emailer.sendRegistrationEmail(testUser);
            delete res.messageId; // value varies so keep it out of the snapshot
            expect(res).toMatchSnapshot();
        });

        it("sendPasswordResetEmail", async () => {
            const res = await emailer.sendPasswordResetEmail(testUser);
            delete res.messageId; // value varies so keep it out of the snapshot
            expect(res).toMatchSnapshot();
        });
    });
});
