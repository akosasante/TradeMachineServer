import logger from "../../../src/bootstrap/logger";
import User from "../../../src/models/user";

export const testUser = new User({id: 1, email: "test@example.com", name: "Jatheesh", password: "pswd"});

export default {
    find: jest.fn()
        .mockImplementationOnce(async () => {
            logger.debug("mocking for getAllUsers");
            return await [testUser];
        }),
    findOneOrFail: jest.fn()
        .mockImplementationOnce(async id => {
            logger.debug("mocking for getByUserById");
            return testUser;
        })
        .mockImplementationOnce(async queryObj => {
            logger.debug("mocking for findUser");
            return testUser;
        })
        .mockImplementationOnce(async id => {
            logger.debug("mocking for updateUser");
            return testUser;
        }),
    findOne: jest.fn()
        .mockImplementationOnce(async queryObj => {
            logger.debug("mocking for findUser with false param");
            return testUser;
        }),
    save: jest.fn()
        .mockImplementationOnce(async user => {
            logger.debug("mocking for createUser");
            return user;
        }),
    update: jest.fn()
        .mockImplementationOnce(async (query, userObj) => {
            return { updated: true };
        }),
    delete: jest.fn()
        .mockImplementationOnce(async id => {
            return { deleted: true };
        }),
};
