// import logger from "../../../src/bootstrap/logger";
// import UserDO from "../../../src/models/user";
// import { User } from "trade-machine-models/lib";
//
// export const testUser = new UserDO({
//     id: "abc-123", email: "test@example.com", displayName: "Jatheesh", password: "pswd" });
//
// export default {
//     find: jest.fn()
//         .mockImplementation(async () => {
//             logger.debug("mocking for getAllUsers");
//             return await [testUser];
//         }),
//     findOneOrFail: jest.fn()
//         .mockImplementation(async id => {
//             logger.debug("mocking for getByUserById");
//             return testUser;
//         })
//         .mockImplementation(async queryObj => {
//             logger.debug("mocking for findUser");
//             return testUser;
//         })
//         .mockImplementation(async id => {
//             logger.debug("mocking for updateUser");
//             return testUser;
//         }),
//     findOne: jest.fn()
//         .mockImplementation(async queryObj => {
//             logger.debug("mocking for findUser with false param");
//             return testUser;
//         }),
//     save: jest.fn()
//         .mockImplementation(async user => {
//             logger.debug("mocking for createUser");
//             return user;
//         }),
//     update: jest.fn()
//         .mockImplementation(async (query, userObj) => {
//             return { updated: true };
//         }),
//     delete: jest.fn()
//         .mockImplementation(async id => {
//             return { deleted: true };
//         }),
//     createQueryBuilder: jest.fn()
//         .mockImplementation(async () => {
//             return { affected: 1, raw: [{id: 1}]};
//         }),
// };
