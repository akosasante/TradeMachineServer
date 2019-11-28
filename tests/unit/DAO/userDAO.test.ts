import "jest";
import "jest-extended";
import { NotFoundError } from "routing-controllers";
import { mocked } from "ts-jest";
import * as typeorm from "typeorm";
import { Connection } from "typeorm";
import logger from "../../../src/bootstrap/logger";
import UserDAO from "../../../src/DAO/UserDAO";
import { UserFactory } from "../../factories/UserFactory";
// import { testUser } from "../mocks/mockUserDb";
import { mockDeleteChain, mockExecute, mockWhereInIds } from "./daoHelpers";

describe("UserDAO", () => {
    const mockUserDb = {
        find: jest.fn(),
        findOneOrFail: jest.fn(),
        // save: jest.fn(),
        // update: jest.fn(),
        // createQueryBuilder: jest.fn(),
    };
    
    const testUser = UserFactory.getUser();
    const testUserModel = testUser.toUserModel();
    // afterEach(async () => {
    //     Object.keys(mockUserDb).forEach((action: string) => {
    //         // @ts-ignore
    //         (mockUserDb[action] as jest.Mock).mockClear();
    //     });
    //
    //     mockExecute.mockClear();
    //     mockWhereInIds.mockClear();
    // });
    beforeAll(() => {
        logger.debug("~~~~~~USER DAO TESTS BEGIN~~~~~~");
    });
    afterAll(() => {
        logger.debug("~~~~~~USER DAO TESTS COMPLETE~~~~~~");
    });

    // @ts-ignore
    const userDAO: UserDAO = new UserDAO(mockUserDb);

    describe("getAllUsers", () => {
        it("should return an array of users as result of db call", async () => {
            mockUserDb.find.mockReturnValue([testUser]);
            const res = await userDAO.getAllUsers();
            const defaultOptions = {order: {id: "ASC"}};

            // Testing that the correct db function is called with the correct params
            expect(mockUserDb.find).toHaveBeenCalledTimes(1);
            expect(mockUserDb.find).toHaveBeenCalledWith(defaultOptions);

            // Testing that we return as expected
            expect(res).toEqual([testUserModel]);
        });
    });

    // describe("getAllUsersWithTeams", () => {
    //     it("should return an array of users as result of db call with the team relation", async () => {
    //         const res = await userDAO.getAllUsersWithTeams();
    //         const options = { order: { id: "ASC" }, relations: ["team"]};
    //         // Testing that the correct db function is called with the correct params
    //         expect(mockUserDb.find).toHaveBeenCalledTimes(1);
    //         expect(mockUserDb.find).toHaveBeenCalledWith(options);
    //         // Testing that we return as expected
    //         expect(res).toEqual([testUser]);
    //     });
    // });

    describe("getUserById", () => {
        it("should return a single user as result of db call", async () => {
            mockUserDb.findOneOrFail.mockReturnValueOnce(testUser);
            const res = await userDAO.getUserById(testUser.id!);
            // Testing that the correct db function is called with the correct params
            expect(mockUserDb.findOneOrFail).toHaveBeenCalledTimes(1);
            expect(mockUserDb.findOneOrFail).toHaveBeenCalledWith(testUser.id);
            // Testing that we return as expected
            expect(res).toEqual(testUserModel);
        });
        // it("should throw a NotFoundError if no id is passed in", async () => {
        //     // This can happen if like user.id is passed in and we expect it to always be a number
        //     // But for some reason it's undefined.
        //     // @ts-ignore
        //     await expect(userDAO.getUserById(undefined)).rejects.toThrow(NotFoundError);
        // });
    });

    // describe("getUserByUUID", () => {
    //     it("should return a single user as a result of db call", async () => {
    //         const res = await userDAO.getUserByUUID(testUser.userIdToken!);
    //
    //         expect(mockUserDb.findOneOrFail).toHaveBeenCalledTimes(1);
    //         expect(mockUserDb.findOneOrFail).toHaveBeenCalledWith({where: {userIdToken: testUser.userIdToken}});
    //
    //         expect(res).toEqual(testUser);
    //     });
    //     it("should throw a NotFoundError if no UUID is passed in", async () => {
    //         // @ts-ignore
    //         await expect(userDAO.getUserByUUID(undefined)).rejects.toThrow(NotFoundError);
    //     });
    // });

    // describe("findUser", () => {
    //     it("should pass a query object to db and return a single user", async () => {
    //         const res = await userDAO.findUser({email: testUser.email});
    //         // Testing that the correct db function is called with the correct params
    //         expect(mockUserDb.findOneOrFail).toHaveBeenCalledTimes(1);
    //         expect(mockUserDb.findOneOrFail).toHaveBeenCalledWith({where: {email: testUser.email}});
    //         // Testing that we return as expected
    //         expect(res).toEqual(testUser);
    //     });
    //     it("should use the findOne method if the param passed is false", async () => {
    //         const res = await userDAO.findUser({email: testUser.email}, false);
    //         expect(mockUserDb.findOne).toHaveBeenCalledTimes(1);
    //         expect(mockUserDb.findOne).toHaveBeenCalledWith({where: {email: testUser.email}});
    //         expect(res).toEqual(testUser);
    //     });
    // });

    // describe("findUsers", () => {
    //     const condition = {email: testUser.email};
    //     it("should pass a query object to the find method and return an array", async () => {
    //         const res = await userDAO.findUsers(condition, false);
    //         expect(mockUserDb.find).toHaveBeenCalledTimes(1);
    //         expect(mockUserDb.find).toHaveBeenCalledWith({where: condition});
    //         expect(res).toEqual([testUser]);
    //         mockUserDb.find.mockClear();
    //     });
    //     it("should return an empty array if failIfNotFound is falsy", async () => {
    //         mockUserDb.find.mockImplementationOnce(() => []);
    //         const res = await userDAO.findUsers(condition, false);
    //         expect(mockUserDb.find).toHaveBeenCalledTimes(1);
    //         expect(mockUserDb.find).toHaveBeenCalledWith({where: condition});
    //         expect(res).toEqual([]);
    //     });
    //     it("should throw a NotFoundError if the failIfNotFound arg is true", async () => {
    //         mockUserDb.find.mockImplementationOnce(() => []);
    //         await expect(userDAO.findUsers(condition, true)).rejects.toThrow(NotFoundError);
    //     });
    // });

    // describe("createUser", () => {
    //     it("should a user instance and hash any included password before insert", async () => {
    //         const expectedUser = expect.objectContaining({email: expect.any(String)});
    //         const res = await userDAO.createUser(testUser.parse());
    //         // Testing that the correct db function is called with the correct params
    //         expect(mockUserDb.save).toHaveBeenCalledTimes(1);
    //         expect(mockUserDb.save).toHaveBeenCalledWith(expectedUser);
    //         // Testing that we return as expected
    //         expect(testUser.equals(res)).toBeTrue();
    //     });
    // });

    // describe("updateUser", () => {
    //
    //     it("should call getUsersById and associated db call then return single user", async () => {
    //         const res = await userDAO.updateUser(testUser.id!, testUser.parse());
    //         // Testing that the correct db function is called with the correct params
    //         expect(mockUserDb.update).toHaveBeenCalledTimes(1);
    //         expect(mockUserDb.update).toHaveBeenCalledWith({id: testUser.id}, testUser.parse());
    //         expect(mockUserDb.findOneOrFail).toHaveBeenCalledTimes(1);
    //         expect(mockUserDb.findOneOrFail).toHaveBeenCalledWith(testUser.id);
    //         // Testing that we return as expected
    //         expect(res).toEqual(testUser);
    //     });
    // });
    //
    // describe("deleteUser", () => {
    //     it("should return a delete result", async () => {
    //         mockUserDb.createQueryBuilder.mockReturnValueOnce(mockDeleteChain);
    //         const deleteResult = { affected: 1, raw: {id: testUser.id!} };
    //         mockExecute.mockReturnValueOnce(deleteResult);
    //         const res = await userDAO.deleteUser(testUser.id!);
    //         // Testing that the correct db function is called with the correct params
    //         expect(mockUserDb.findOneOrFail).toHaveBeenCalledTimes(1);
    //         expect(mockUserDb.findOneOrFail).toHaveBeenCalledWith(testUser.id!);
    //         expect(mockUserDb.createQueryBuilder).toHaveBeenCalledTimes(1);
    //         expect(mockWhereInIds).toHaveBeenCalledWith(testUser.id!);
    //         // Testing that we return as expected
    //         expect(res).toEqual(deleteResult);
    //     });
    // });
    //
    // describe("setPasswordExpires", () => {
    //     it("should return successfully if db call has on errors", async () => {
    //         const updatePartial = {passwordResetExpiresOn: expect.toBeDate(), passwordResetToken: expect.toBeString()};
    //         const res = await userDAO.setPasswordExpires(testUser.id!);
    //
    //         expect(mockUserDb.update).toHaveBeenCalledTimes(1);
    //         expect(mockUserDb.update).toHaveBeenCalledWith({id: testUser.id!}, updatePartial);
    //
    //         expect(res).toBeUndefined();
    //     });
    // });
});
