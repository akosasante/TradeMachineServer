import logger from "../../../src/bootstrap/logger";
import Email from "../../../src/models/email";

const emailObj = {messageId: "<5d0e2800bbddbd4ed05cc56a@domain.com>"};
const email = new Email(emailObj);

describe("Email model class", () => {
    beforeAll(() => {
        logger.debug("~~~~~~EMAIL TESTS BEGIN~~~~~~");
    });
    afterAll(() => {
        logger.debug("~~~~~~EMAIL TESTS COMPLETE~~~~~~");
    });

    describe("constructor", () => {
        it("should construct the obj as expected", () => {
            expect(email.messageId).toBeDefined();
            expect(email.status).toBeUndefined();
        });
    });

    describe("instance methods", () => {
        it("toString/0 - should return a string with the messageId", () => {
            expect(email.toString()).toMatch(email.messageId);
            expect(email.toString()).toMatch("Email#");
        });

        it("parse/1 - should take an email and return a POJO", () => {
            expect(email).toBeInstanceOf(Email);
            expect(email.parse()).not.toBeInstanceOf(Email);
            expect(email.parse()).toEqual(emailObj);
            expect(email.parse()).toEqual(expect.any(Object));
        });
    });
});
