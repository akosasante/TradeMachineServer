import "jest";
import "jest-extended";
import { EmailPublisher } from "../../../src/queues/publishers";
import Bull from "bull";
import { UserFactory } from "../../factories/UserFactory";

const mockQueue = {
    add: jest.fn(),
};

afterEach(() => {
    mockQueue.add.mockClear();
});

describe("EmailPublisher", () => {
    const publisher = EmailPublisher.getInstance(mockQueue as unknown as Bull.Queue);
    const user = UserFactory.getUser();
    const userJson = JSON.stringify(user);

    it("queueResetEmail/1 - should add email job with correct parameters to the emailQueue", async () => {
        await publisher.queueResetEmail(user);
        expect(mockQueue.add).toBeCalledTimes(1);
        expect(mockQueue.add).toHaveBeenCalledWith({user: userJson, mailType: "reset_pass"});
    });

    it("queueRegistrationEmail/1 - should add email job with correct parameters to the emailQueue", async () => {
        await publisher.queueRegistrationEmail(user);
        expect(mockQueue.add).toBeCalledTimes(1);
        expect(mockQueue.add).toHaveBeenCalledWith({user: userJson, mailType: "registration_email"});
    });

    it("queueTestEmail/1 - should add email job with correct parameters to the emailQueue", async () => {
        await publisher.queueTestEmail(user);
        expect(mockQueue.add).toBeCalledTimes(1);
        expect(mockQueue.add).toHaveBeenCalledWith({user: userJson, mailType: "test_email"});
    });
});
