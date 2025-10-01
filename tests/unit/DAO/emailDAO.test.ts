import EmailDAO from "../../../src/DAO/EmailDAO";
import { Repository } from "typeorm";
import { mockDeep } from "jest-mock-extended";
import Email from "../../../src/models/email";
import logger from "../../../src/bootstrap/logger";

describe("EmailDAO", () => {
    const mockEmailDb = mockDeep<Repository<Email>>();

    const testEmailData = { messageId: "<5d0e2800bbddbd4ed05cc56a@domain.com>", status: "opened" };
    const testEmail = new Email(testEmailData);
    const emailDAO: EmailDAO = new EmailDAO(mockEmailDb as any);

    afterEach(() => {
        jest.clearAllMocks();
    });
    beforeAll(() => {
        logger.debug("~~~~~~EMAIL DAO TESTS BEGIN~~~~~~");
    });
    afterAll(() => {
        logger.debug("~~~~~~EMAIL DAO TESTS COMPLETE~~~~~~");
    });

    it("getEmailByMessageId - should call the db findOne once with id", async () => {
        mockEmailDb.findOne.mockResolvedValueOnce(testEmail);
        const res = await emailDAO.getEmailByMessageId(testEmail.messageId!);

        expect(mockEmailDb.findOne).toHaveBeenCalledTimes(1);
        expect(mockEmailDb.findOne).toHaveBeenCalledWith({ where: { messageId: testEmail.messageId } });
        expect(res).toEqual(testEmail);
    });

    it("createEmail/1 - should call the db save method once with the email object", async () => {
        const expectedEmail = new Email(testEmailData);
        mockEmailDb.save.mockResolvedValueOnce(expectedEmail);
        const res = await emailDAO.createEmail(testEmailData);

        expect(mockEmailDb.save).toHaveBeenCalledTimes(1);
        expect(mockEmailDb.save).toHaveBeenCalledWith(testEmailData);
        expect(res).toEqual(expectedEmail);
    });

    it("updateEmail/1 - should call the db save method once with the email object", async () => {
        const expectedEmail = new Email(testEmailData);
        mockEmailDb.save.mockResolvedValueOnce(expectedEmail);
        const res = await emailDAO.createEmail(testEmailData);

        expect(mockEmailDb.save).toHaveBeenCalledTimes(1);
        expect(mockEmailDb.save).toHaveBeenCalledWith(testEmailData);
        expect(res).toEqual(expectedEmail);
    });
});
