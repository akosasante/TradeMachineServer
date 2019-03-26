import "jest";
import "jest-extended";
import * as typeorm from "typeorm";
import UserDAO from "../../../src/DAO/UserDAO";
import mockUserDb, { testUser } from "../mocks/mockUserDb";

jest.spyOn(typeorm, "getConnection")
    .mockReturnValue({getRepository: jest.fn().mockReturnValue(mockUserDb)});

describe("UserDAO", () => {
    let userDAO: UserDAO;

    describe("getAllUsers", () => {
        beforeAll(() => {
            userDAO = new UserDAO();
        });
        afterAll(async () => {
            await userDAO.connection.close();
        });

        it("should return an array of users as result of db call", async () => {
            const res = await userDAO.getAllUsers();
            // Testing that the correct db function is called with the correct params
            expect(mockUserDb.find).toHaveBeenCalledTimes(1);
            expect(mockUserDb.find).toHaveBeenCalledWith();
            // Testing that we return as expected
            expect(res).toEqual([testUser]);
        });
    });

    describe("getUserById", () => {
        beforeAll(() => {
            userDAO = new UserDAO();
        });

        it("should return a single user as result of db call", async () => {
            const res = await userDAO.getUserById(testUser.id!);
            // Testing that the correct db function is called with the correct params
            expect(mockUserDb.findOneOrFail).toHaveBeenCalledTimes(1);
            expect(mockUserDb.findOneOrFail).toHaveBeenCalledWith(testUser.id);
            // Testing that we return as expected
            expect(res).toEqual(testUser);
        });
    });

    describe("findUser", () => {
        beforeAll(() => {
            userDAO = new UserDAO();
        });

        it("should pass a query object to db and return a single user", async () => {
            const res = await userDAO.findUser({email: testUser.email});
            // Testing that the correct db function is called with the correct params
            expect(mockUserDb.findOneOrFail).toHaveBeenCalledTimes(2);
            expect(mockUserDb.findOneOrFail).toHaveBeenCalledWith({where: {email: testUser.email}});
            // Testing that we return as expected
            expect(res).toEqual(testUser);
        });
        it("should use the findOne method if the param passed is false", async () => {
            const res = await userDAO.findUser({email: testUser.email}, false);
            expect(mockUserDb.findOne).toHaveBeenCalledTimes(1);
            expect(mockUserDb.findOne).toHaveBeenCalledWith({where: {email: testUser.email}});
            expect(res).toEqual(testUser);
        });
    });

    describe("createUser", () => {
        beforeAll(() => {
            userDAO = new UserDAO();
        });

        it("should a user instance and hash any included password before insert", async () => {
            const expectedUser = expect.objectContaining({email: expect.any(String)});
            const res = await userDAO.createUser(testUser.parse());
            // Testing that the correct db function is called with the correct params
            expect(mockUserDb.save).toHaveBeenCalledTimes(1);
            expect(mockUserDb.save).toHaveBeenCalledWith(expectedUser);
            // Testing that we return as expected
            expect(testUser.equals(res)).toBeTrue();
        });
    });

    describe("updateUser", () => {
        beforeAll(() => {
            userDAO = new UserDAO();
        });

        it("should call getUsrsById and associated db call then return single user", async () => {
            const res = await userDAO.updateUser(testUser.id!, testUser.parse());
            // Testing that the correct db function is called with the correct params
            expect(mockUserDb.update).toHaveBeenCalledTimes(1);
            expect(mockUserDb.update).toHaveBeenCalledWith({id: testUser.id}, testUser.parse());
            expect(mockUserDb.findOneOrFail).toHaveBeenCalledTimes(3);
            expect(mockUserDb.findOneOrFail).toHaveBeenCalledWith(testUser.id);
            // Testing that we return as expected
            expect(res).toEqual(testUser);
        });
    });

    describe("deleteUser", () => {
        beforeAll(() => {
            userDAO = new UserDAO();
        });

        it("should return a delete result", async () => {
            const res = await userDAO.deleteUser(testUser.id!);
            // Testing that the correct db function is called with the correct params
            expect(mockUserDb.delete).toHaveBeenCalledTimes(1);
            expect(mockUserDb.delete).toHaveBeenCalledWith(testUser.id);
            // Testing that we return as expected
            expect(res).toEqual({ deleted: true });
        });
    });
});
