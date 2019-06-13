import Email from "email-templates";
import "jest";
import "jest-extended";
import { mocked } from "ts-jest/utils";
import { Emailer } from "../../../src/email/mailer";
import User from "../../../src/models/user";

jest.mock("email-templates");
const mockedEmail = mocked(Email);

describe("Emailer Class", () => {
    const testUser = new User({
        id: 1, email: "test@example.com", name: "Jatheesh", password: "pswd", userIdToken: "abc-def-geh"});
    const sampleSendmailResponse = {
        messageId: "<something@smtp-relay.sendinblue.com>",
        code: "202 success",
        message: "some message",
        originalMessage: {to: "to@mail.com", from: "from@mail.com", text: "text", html: "html"},
    };
    const sendSpy = jest.fn();
    // @ts-ignore
    mockedEmail.mockImplementation(() => {
        return {
            send: sendSpy,
        };
    });
    const emailer = new Emailer();

    afterEach(() => {
        mockedEmail.mockClear();
        sendSpy.mockClear();
    });

    it("should create the expected email template when instantiated", () => {
        expect(mockedEmail.mock.instances).toBeArrayOfSize(1);
        expect(mockedEmail.mock.instances[0]).toBeInstanceOf(Email);
        expect(mockedEmail.mock.calls).toBeArrayOfSize(1);
        expect(mockedEmail.mock.calls[0]).toBeArrayOfSize(1);
        expect(mockedEmail.mock.calls[0][0].message.from).toEqual("tradebot@flexfoxfantasy.com");
    });

    describe("sendPasswordResetEmail", () => {
        it("should call emailer.send with the correct options", async () => {
            sendSpy.mockResolvedValueOnce(sampleSendmailResponse);

            const expectedUrl = expect.stringContaining("/reset_password?u=abcdefgeh");
            const expectedOptions = {
                template: "reset_password",
                message: { to: testUser.email },
                locals: { name: testUser.name, url: expectedUrl },
            };

            const res = await emailer.sendPasswordResetEmail(testUser);
            expect(sendSpy).toHaveBeenCalledTimes(1);
            expect(sendSpy).toHaveBeenCalledWith(expectedOptions);
            expect(res).toEqual(sampleSendmailResponse);
        });
        it("should catch any error but just return undefined", async () => {
            sendSpy.mockRejectedValueOnce(new Error("Error"));

            const res = await emailer.sendPasswordResetEmail(testUser);
            expect(res).toBeUndefined();
        });
    });

    describe("sendTestEmail", () => {
        it("should call emailer.send with the correct options", async () => {
            sendSpy.mockResolvedValueOnce(sampleSendmailResponse);

            const expectedOptions = {
                template: "test_email",
                message: { to: testUser.email },
                locals: { name: testUser.name },
            };

            const res = await emailer.sendTestEmail(testUser);
            expect(sendSpy).toHaveBeenCalledTimes(1);
            expect(sendSpy).toHaveBeenCalledWith(expectedOptions);
            expect(res).toEqual(sampleSendmailResponse);
        });
        it("should catch any error but just return undefined", async () => {
            sendSpy.mockRejectedValueOnce(new Error("Error"));

            const res = await emailer.sendTestEmail(testUser);
            expect(res).toBeUndefined();
        });
    });

    describe("sendRegistrationEmail", () => {
        it("should call emailer.send with the correct options", async () => {
            sendSpy.mockResolvedValueOnce(sampleSendmailResponse);

            const expectedUrl = expect.stringContaining("/register");
            const expectedOptions = {
                template: "registration_email",
                message: { to: testUser.email },
                locals: { name: testUser.name, url: expectedUrl },
            };

            const res = await emailer.sendRegistrationEmail(testUser);
            expect(sendSpy).toHaveBeenCalledTimes(1);
            expect(sendSpy).toHaveBeenCalledWith(expectedOptions);
            expect(res).toEqual(sampleSendmailResponse);
        });
        it("should catch any error but just return undefined", async () => {
            sendSpy.mockRejectedValueOnce(new Error("Error"));

            const res = await emailer.sendRegistrationEmail(testUser);
            expect(res).toBeUndefined();
        });
    });
});
