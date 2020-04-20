import { MockObj } from "./daoHelpers";
import EmailDAO from "../../../src/DAO/EmailDAO";
import { Repository } from "typeorm";
import Email from "../../../src/models/email";
import logger from "../../../src/bootstrap/logger";

describe("EmailDAO", () => {
    const mockEmailDb: MockObj = {
        findOne: jest.fn(),
    };

    const testEmail = {messageId: "<5d0e2800bbddbd4ed05cc56a@domain.com>", status: "opened"};
    const emailDAO: EmailDAO = new EmailDAO(mockEmailDb as unknown as Repository<Email>);

    afterEach(() => {
        Object.keys(mockEmailDb).forEach((action: string) => {
            (mockEmailDb[action as keyof MockObj] as jest.Mock).mockClear();
        });
    });
    beforeAll(() => {
        logger.debug("~~~~~~EMAIL DAO TESTS BEGIN~~~~~~");
    });
    afterAll(() => {
        logger.debug("~~~~~~EMAIL DAO TESTS COMPLETE~~~~~~");
    });

    it("getEmailByMessageId - should call the db findOne once with id", async () => {
        mockEmailDb.findOne.mockResolvedValueOnce(testEmail);
        const res = await emailDAO.getEmailByMessageId(testEmail.messageId);

        expect(mockEmailDb.findOne).toHaveBeenCalledTimes(1);
        expect(mockEmailDb.findOne).toHaveBeenCalledWith(testEmail.messageId);
        expect(res).toEqual(testEmail);
    });
});
