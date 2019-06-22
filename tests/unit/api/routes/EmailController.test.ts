import axios, { AxiosPromise } from "axios";
import { Response } from "express";
import "jest";
import "jest-extended";
import { clone } from "lodash";
import { NotFoundError } from "routing-controllers";
import { mocked } from "ts-jest/utils";
import EmailController from "../../../../src/api/routes/EmailController";
import UserDAO from "../../../../src/DAO/UserDAO";
import User from "../../../../src/models/user";
import { MailQueue } from "../../../../src/queue/mailQueue";

jest.mock("axios");
const mockedAxios = mocked(axios);

describe("EmailController", () => {
    const mockUserDAO: any = {
        findUser: jest.fn(),
        setPasswordExpires: jest.fn(),
    };
    const mockMailQueue: any = {
        addEmail: jest.fn(),
    };
    const testUser = new User({id: 1, name: "Jatheesh", password: "pswd", email: "jat@example.com"});

    const mockRes = {
        status: jest.fn(function() {
            // @ts-ignore
            return this;
        }),
        json: jest.fn(function() {
            // @ts-ignore
            return this;
        }),
    };

    afterEach(() => {
        const clearMock = (mockInstance: object) =>
            Object.entries(mockInstance).forEach((kvp: [string, jest.Mock<any, any>]) => {
                kvp[1].mockClear();
            });
        [mockUserDAO, mockRes, mockMailQueue].forEach(clearMock);
    });

    describe("sendResetEmail method", () => {
        it("should find a user, set a new password expiry date, and call mailQueue", async () => {
            mockUserDAO.findUser.mockReturnValueOnce(testUser);
            const expectedQueueMessage = `{"topic":"reset_pass","args":[${JSON.stringify(testUser)}]}`;

            const emailController = new EmailController(mockUserDAO as UserDAO, mockMailQueue as MailQueue);
            await emailController.sendResetEmail(testUser.email!, mockRes as unknown as Response);

            expect(mockUserDAO.findUser).toHaveBeenCalledTimes(1);
            expect(mockUserDAO.findUser).toHaveBeenCalledWith({email: testUser.email});
            expect(mockUserDAO.setPasswordExpires).toHaveBeenCalledTimes(1);
            expect(mockUserDAO.setPasswordExpires).toHaveBeenCalledWith(testUser.id);
            expect(mockMailQueue.addEmail).toHaveBeenCalledTimes(1);
            expect(mockMailQueue.addEmail).toHaveBeenCalledWith(expectedQueueMessage);
            expect(mockRes.status).toHaveBeenCalledTimes(1);
            expect(mockRes.status).toHaveBeenCalledWith(202);
            expect(mockRes.json).toHaveBeenCalledTimes(1);
        });

        it("should throw an error if there's something wrong inside", async () => {
            mockUserDAO.findUser.mockImplementationOnce(() => {
                throw new Error("Generic Error");
            });

            const emailController = new EmailController(mockUserDAO as UserDAO, mockMailQueue as MailQueue);
            await expect(emailController.sendResetEmail(testUser.email!, mockRes as unknown as Response))
                .rejects.toThrow(Error);
            expect(mockRes.status).toHaveBeenCalledTimes(0);
            expect(mockRes.json).toHaveBeenCalledTimes(0);
        });
    });

    describe("sendTestEmail method", () => {
        it("should find a user and call mailQueue", async () => {
            mockUserDAO.findUser.mockReturnValueOnce(testUser);
            const expectedQueueMessage = `{"topic":"test_email","args":[${JSON.stringify(testUser)}]}`;

            const emailController = new EmailController(mockUserDAO as UserDAO, mockMailQueue as MailQueue);
            await emailController.sendTestEmail(testUser.email!, mockRes as unknown as Response);

            expect(mockUserDAO.findUser).toHaveBeenCalledTimes(1);
            expect(mockUserDAO.findUser).toHaveBeenCalledWith({email: testUser.email});
            expect(mockUserDAO.setPasswordExpires).toHaveBeenCalledTimes(0);
            expect(mockMailQueue.addEmail).toHaveBeenCalledTimes(1);
            expect(mockMailQueue.addEmail).toHaveBeenCalledWith(expectedQueueMessage);
            expect(mockRes.status).toHaveBeenCalledTimes(1);
            expect(mockRes.status).toHaveBeenCalledWith(202);
            expect(mockRes.json).toHaveBeenCalledTimes(1);
        });

        it("should throw an error if there's something wrong inside", async () => {
            mockUserDAO.findUser.mockImplementationOnce(() => {
                throw new Error("Generic Error");
            });

            const emailController = new EmailController(mockUserDAO as UserDAO, mockMailQueue as MailQueue);
            await expect(emailController.sendTestEmail(testUser.email!, mockRes as unknown as Response))
                .rejects.toThrow(Error);
            expect(mockRes.status).toHaveBeenCalledTimes(0);
            expect(mockRes.json).toHaveBeenCalledTimes(0);
        });
    });

    describe("sendRegistrationEmail method", () => {
        it("should find a user and call mailQueue", async () => {
            mockUserDAO.findUser.mockReturnValueOnce(testUser);
            const expectedQueueMessage = `{"topic":"registration_email","args":[${JSON.stringify(testUser)}]}`;

            const emailController = new EmailController(mockUserDAO as UserDAO, mockMailQueue as MailQueue);
            await emailController.sendRegistrationEmail(testUser.email!, mockRes as unknown as Response);

            expect(mockUserDAO.findUser).toHaveBeenCalledTimes(1);
            expect(mockUserDAO.findUser).toHaveBeenCalledWith({email: testUser.email});
            expect(mockUserDAO.setPasswordExpires).toHaveBeenCalledTimes(0);
            expect(mockMailQueue.addEmail).toHaveBeenCalledTimes(1);
            expect(mockMailQueue.addEmail).toHaveBeenCalledWith(expectedQueueMessage);
            expect(mockRes.status).toHaveBeenCalledTimes(1);
            expect(mockRes.status).toHaveBeenCalledWith(202);
            expect(mockRes.json).toHaveBeenCalledTimes(1);
        });

        it("should throw an error if there's something wrong inside", async () => {
            mockUserDAO.findUser.mockImplementationOnce(() => {
                throw new Error("Generic Error");
            });

            const emailController = new EmailController(mockUserDAO as UserDAO, mockMailQueue as MailQueue);
            await expect(emailController.sendRegistrationEmail(testUser.email!, mockRes as unknown as Response))
                .rejects.toThrow(Error);
            expect(mockRes.status).toHaveBeenCalledTimes(0);
            expect(mockRes.json).toHaveBeenCalledTimes(0);
        });
    });

    describe("getEmailStatus method", () => {
        const testMessageId = "<201906021719.39947793162@smtp-relay.sendinblue.com>";
        const testData = {
            code: "success",
            message: "Report generated",
            data: [
                {
                    "date": "2019-06-02 11:20:06",
                    "message-id": "<201906021719.39947793162@smtp-relay.sendinblue.com>",
                    "email": "adamlee380@hotmail.com",
                    "from": "tradebot@flexfoxfantasy.com",
                    "subject": "Your Fantasy Baseball Trade Proposal is ready for submission,  Flex Fox!",
                    "ip": "172.58.59.27",
                    "event": "views",
                },
                {
                    "date": "2019-06-02 11:19:36",
                    "message-id": "<201906021719.39947793162@smtp-relay.sendinblue.com>",
                    "email": "adamlee380@hotmail.com",
                    "from": "tradebot@flexfoxfantasy.com",
                    "subject": "Your Fantasy Baseball Trade Proposal is ready for submission,  Flex Fox!",
                    "reason": "sent",
                    "event": "delivery",
                },
                {
                    "date": "2019-06-02 11:19:34",
                    "message-id": "<201906021719.39947793162@smtp-relay.sendinblue.com>",
                    "email": "adamlee380@hotmail.com",
                    "from": "tradebot@flexfoxfantasy.com",
                    "subject": "Your Fantasy Baseball Trade Proposal is ready for submission,  Flex Fox!",
                    "reason": "sent",
                    "event": "requests",
                },
                {
                    "date": "2019-06-02 11:19:30",
                    "message-id": "<201906021719.39947793162@smtp-relay.sendinblue.com>",
                    "email": "jemiljuson@hotmail.com",
                    "from": "tradebot@flexfoxfantasy.com",
                    "subject": "Fantasy Baseball Trade Proposal from Adam Lee!",
                    "ip": "142.112.137.182",
                    "link": "http://trades.flexfoxfantasy.com/confirm/Jemil...",
                    "event": "clicks",
                },
            ],
        };
        it("should make a request to the mail providers report endpoint for an email id", async () => {
            mockedAxios.post = jest.fn(() => {
                return Promise.resolve( {
                    data: testData,
                }) as AxiosPromise;
            });

            const expectedResult = {
                id: testMessageId,
                events: [
                    {date: new Date("2019-06-02 11:20:06"), type: "views"},
                    {date: new Date("2019-06-02 11:19:36"), type: "delivery", reason: "sent"},
                    {date: new Date("2019-06-02 11:19:34"), type: "requests", reason: "sent"},
                    {date: new Date("2019-06-02 11:19:30"), type: "clicks"},
                ],
            };
            const emailController = new EmailController(mockUserDAO as UserDAO, mockMailQueue as MailQueue);

            const res = await emailController.getEmailStatus(testMessageId);
            expect(res).toEqual(expectedResult);
        });
        it("should throw a NotFoundError if the code attribute is not 'success'", async () => {
            const testDataUnsucessful = clone(testData);
            testDataUnsucessful.code = "failed";
            mockedAxios.post = jest.fn(() => {
                return Promise.resolve( {
                    data: testDataUnsucessful,
                }) as AxiosPromise;
            });

            const emailController = new EmailController(mockUserDAO as UserDAO, mockMailQueue as MailQueue);

            await expect(emailController.getEmailStatus(testMessageId)).rejects.toThrow(NotFoundError);
        });
        it("should throw an Error if the request fails (non-200)", async () => {
            mockedAxios.post = jest.fn(() => {
                return Promise.reject(new Error("400 Response"));
            });

            const emailController = new EmailController(mockUserDAO as UserDAO, mockMailQueue as MailQueue);

            await expect(emailController.getEmailStatus(testMessageId)).rejects.toThrow(Error);
        });
    });
});
