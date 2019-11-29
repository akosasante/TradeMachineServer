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
import {EntityNotFoundError} from "typeorm/browser/error/EntityNotFoundError";

describe("UserDAO", () => {
    const mockUserDb = {
        find: jest.fn(),
        findOneOrFail: jest.fn(),
        findOne: jest.fn(),
        // save: jest.fn(),
        // update: jest.fn(),
        // createQueryBuilder: jest.fn(),
    };
    
    const testUser = UserFactory.getUser();
    const testUserModel = testUser.toUserModel();
    afterEach(async () => {
        Object.keys(mockUserDb).forEach((action: string) => {
            // @ts-ignore
            (mockUserDb[action] as jest.Mock).mockClear();
        });

        // mockExecute.mockClear();
        // mockWhereInIds.mockClear();
    });
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
            mockUserDb.find.mockReturnValueOnce([testUser]);
            const res = await userDAO.getAllUsers();
            const defaultOptions = {order: {id: "ASC"}};

            // Testing that the correct db function is called with the correct params
            expect(mockUserDb.find).toHaveBeenCalledTimes(1);
            expect(mockUserDb.find).toHaveBeenCalledWith(defaultOptions);

            // Testing that we return as expected
            expect(res).toEqual([testUserModel]);
        });
    });

    describe("getAllUsersWithTeams", () => {
        it("should return an array of users as result of db call with the team relation", async () => {
            mockUserDb.find.mockReturnValueOnce([testUser]);
            const res = await userDAO.getAllUsersWithTeams();
            const options = { order: { id: "ASC" }, relations: ["team"]};
           
            // Testing that the correct db function is called with the correct params
            expect(mockUserDb.find).toHaveBeenCalledTimes(1);
            expect(mockUserDb.find).toHaveBeenCalledWith(options);
            
            // Testing that we return as expected
            expect(res).toEqual([testUserModel]);
        });
    });

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
    });

    describe("findUser", () => {
        it("should pass a query object to db and return a single user", async () => {
            mockUserDb.findOneOrFail.mockReturnValueOnce(testUser);
            const res = await userDAO.findUser({email: testUser.email});
            
            // Testing that the correct db function is called with the correct params
            expect(mockUserDb.findOneOrFail).toHaveBeenCalledTimes(1);
            expect(mockUserDb.findOneOrFail).toHaveBeenCalledWith({where: {email: testUser.email}});
           
            // Testing that we return as expected
            expect(res).toEqual(testUserModel);
        });
        it("should use the findOne method if the param passed is false", async () => {
            mockUserDb.findOne.mockReturnValueOnce(testUser);
            const res = await userDAO.findUser({email: testUser.email}, false);
            
            // Testing that the correct db function is called with the correct params
            expect(mockUserDb.findOne).toHaveBeenCalledTimes(1);
            expect(mockUserDb.findOne).toHaveBeenCalledWith({where: {email: testUser.email}});

            // Testing that we return as expected
            expect(res).toEqual(testUserModel);
        });
    });

    describe("findUsers", () => {
        it("should pass a query object to the find method and return an array", async () => {
            mockUserDb.find.mockReturnValueOnce([testUser]);
            const condition = {email: testUser.email};
            const res = await userDAO.findUsers(condition);

            // Testing that the correct db function is called with the correct params
            expect(mockUserDb.find).toHaveBeenCalledTimes(1);
            expect(mockUserDb.find).toHaveBeenCalledWith({where: condition});

            // Testing that we return as expected
            expect(res).toEqual([testUserModel]);
        });
    });

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
