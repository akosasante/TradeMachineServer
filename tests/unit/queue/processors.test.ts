import "jest";
import "jest-extended";
import { UserFactory } from "../../factories/UserFactory";
import { processEmailJob } from "../../../src/queues/processors";
import {Emailer} from "../../../src/email/mailer";

jest.mock( "../../../src/email/mailer", () => ({
    Emailer: {
        sendPasswordResetEmail: jest.fn(),
        sendTestEmail: jest.fn(),
        sendRegistrationEmail: jest.fn(),
    },
}));

const user = UserFactory.getUser();
const userJson = JSON.stringify(user);

describe("Queue processors", () => {
    it("processEmailJob/1 - it should call the appropriate Emailer methods with the right arguments", async () => {
        // @ts-ignore
        await processEmailJob({ data: { mailType: "reset_pass", user: userJson } });
        expect(Emailer.sendPasswordResetEmail).toBeCalledTimes(1);
        expect(Emailer.sendPasswordResetEmail).toBeCalledWith(user);

        // @ts-ignore
        await processEmailJob({ data: { mailType: "test_email", user: userJson } });
        expect(Emailer.sendTestEmail).toBeCalledTimes(1);
        expect(Emailer.sendTestEmail).toBeCalledWith(user);

        // @ts-ignore
        await processEmailJob({ data: { mailType: "registration_email", user: userJson } });
        expect(Emailer.sendRegistrationEmail).toBeCalledTimes(1);
        expect(Emailer.sendRegistrationEmail).toBeCalledWith(user);
    });
});
