import logger from "../../../src/bootstrap/logger";
import UserDAO from "../../../src/DAO/UserDAO";
import User from "../../../src/models/user";
import { UserFactory } from "../../factories/UserFactory";
import { mockDeleteChain, mockExecute, MockObj, mockWhereInIds } from "./daoHelpers";
import { Repository } from "typeorm";

describe("UserDAO", () => {
    const mockUserDb: MockObj = {
        find: jest.fn(),
        findOneOrFail: jest.fn(),
        findOne: jest.fn(),
        insert: jest.fn(),
        update: jest.fn(),
        createQueryBuilder: jest.fn(),
    };

    const testUser = UserFactory.getUser();
    const userDAO: UserDAO = new UserDAO(mockUserDb as unknown as Repository<User>);

    afterEach(async () => {
        Object.values(mockUserDb).forEach(mockFn => mockFn.mockReset());

        mockExecute.mockClear();
        mockWhereInIds.mockClear();
    });
    beforeAll(() => {
        logger.debug("~~~~~~USER DAO TESTS BEGIN~~~~~~");
    });
    afterAll(() => {
        logger.debug("~~~~~~USER DAO TESTS COMPLETE~~~~~~");
    });

    describe("getAllUsers", () => {
        it("should return an array of users as result of db call", async () => {
            mockUserDb.find.mockResolvedValueOnce([testUser]);
            const res = await userDAO.getAllUsers();
            const defaultOptions = { order: { id: "ASC" } };

            expect(mockUserDb.find).toHaveBeenCalledTimes(1);
            expect(mockUserDb.find).toHaveBeenCalledWith(defaultOptions);

            expect(res).toEqual([testUser]);
        });
    });

    describe("getAllUsersWithTeams", () => {
        it("should return an array of users as result of db call with the team relation", async () => {
            mockUserDb.find.mockResolvedValueOnce([testUser]);
            const res = await userDAO.getAllUsersWithTeams();
            const options = { order: { id: "ASC" }, relations: ["team"] };

            expect(mockUserDb.find).toHaveBeenCalledTimes(1);
            expect(mockUserDb.find).toHaveBeenCalledWith(options);

            expect(res).toEqual([testUser]);
        });
    });

    describe("getUserById", () => {
        it("should return a single user as result of db call", async () => {
            mockUserDb.findOneOrFail.mockResolvedValueOnce(testUser);
            const res = await userDAO.getUserById(testUser.id!);

            expect(mockUserDb.findOneOrFail).toHaveBeenCalledTimes(1);
            expect(mockUserDb.findOneOrFail).toHaveBeenCalledWith(testUser.id, {});

            expect(res).toEqual(testUser);
        });
    });

    describe("findUser", () => {
        const condition = { email: testUser.email };
        it("should pass a query object to db and return a single user", async () => {
            mockUserDb.findOneOrFail.mockResolvedValueOnce(testUser);
            const res = await userDAO.findUser(condition);

            expect(mockUserDb.findOneOrFail).toHaveBeenCalledTimes(1);
            expect(mockUserDb.findOneOrFail).toHaveBeenCalledWith(condition);

            expect(res).toEqual(testUser);
            expect(res).toBeInstanceOf(User);
        });
        it("should use the findOne method if the param passed is false", async () => {
            mockUserDb.findOne.mockResolvedValueOnce(testUser);
            const res = await userDAO.findUser(condition, false);

            expect(mockUserDb.findOne).toHaveBeenCalledTimes(1);
            expect(mockUserDb.findOne).toHaveBeenCalledWith(condition);

            expect(res).toEqual(testUser);
        });
    });

    describe("findUsers", () => {
        it("should pass a query object to the find method and return an array", async () => {
            mockUserDb.find.mockResolvedValueOnce([testUser]);
            const condition = { email: testUser.email };
            const res = await userDAO.findUsers(condition);

            expect(mockUserDb.find).toHaveBeenCalledTimes(1);
            expect(mockUserDb.find).toHaveBeenCalledWith({ where: condition });

            expect(res).toEqual([testUser]);
        });
    });

    describe("findUserWithPasswordByEmail", () => {
        it("should pass a query object to the find method and return an array", async () => {
            const getOneFn = jest.fn().mockResolvedValueOnce(testUser);
            const whereFn = jest.fn();
            const addSelectFn = jest.fn();
            const selectFn = jest.fn();
            const findUserWithPasswordChain = {
                select: selectFn.mockReturnThis(),
                addSelect: addSelectFn.mockReturnThis(),
                where: whereFn.mockReturnThis(),
                getOne: getOneFn,
            };
            mockUserDb.createQueryBuilder.mockReturnValueOnce(findUserWithPasswordChain);

            const condition = testUser.email;
            const res = await userDAO.findUserWithPasswordByEmail(condition);

            expect(whereFn).toHaveBeenCalledWith("user.email ILIKE :email", { email: testUser.email });
            expect(addSelectFn).toHaveBeenCalledWith("user.password");
            expect(addSelectFn).toHaveBeenCalledWith("user.email");
            expect(selectFn).toHaveBeenCalledWith("user.id");
            expect(mockUserDb.createQueryBuilder).toHaveBeenCalledWith("user");
            expect(res).toEqual(testUser);
        });
    });

    describe("createUsers", () => {
        it("should create users in the db for all the objs passed in", async () => {
            mockUserDb.insert.mockResolvedValueOnce({
                identifiers: [{ id: testUser.id! }],
                generatedMaps: [],
                raw: [],
            });
            mockUserDb.find.mockResolvedValueOnce([testUser]);
            const res = await userDAO.createUsers([testUser.parse()]);

            expect(mockUserDb.insert).toHaveBeenCalledTimes(1);
            expect(mockUserDb.insert).toHaveBeenCalledWith([testUser.parse()]);
            expect(mockUserDb.find).toHaveBeenCalledTimes(1);
            expect(mockUserDb.find).toHaveBeenCalledWith({
                id: {
                    _multipleParameters: true,
                    _type: "in",
                    _useParameter: true,
                    _value: [testUser.id],
                },
            });

            expect(res).toEqual([testUser]);
        });
    });

    describe("updateUser", () => {
        it("should call update the user in the db then return the result of getUserById", async () => {
            mockUserDb.findOneOrFail.mockResolvedValueOnce(testUser);
            const res = await userDAO.updateUser(testUser.id!, testUser.parse());

            expect(mockUserDb.update).toHaveBeenCalledTimes(1);
            expect(mockUserDb.update).toHaveBeenCalledWith({ id: testUser.id }, testUser.parse());
            expect(mockUserDb.findOneOrFail).toHaveBeenCalledTimes(1);
            expect(mockUserDb.findOneOrFail).toHaveBeenCalledWith(testUser.id, {});

            expect(res).toEqual(testUser);
        });
    });

    describe("deleteUser", () => {
        it("should return a delete result", async () => {
            mockUserDb.findOneOrFail.mockResolvedValueOnce(testUser);
            mockUserDb.createQueryBuilder.mockReturnValueOnce(mockDeleteChain);
            const deleteResult = { affected: 1, raw: { id: testUser.id! } };
            mockExecute.mockResolvedValueOnce(deleteResult);
            const res = await userDAO.deleteUser(testUser.id!);

            expect(mockUserDb.findOneOrFail).toHaveBeenCalledTimes(1);
            expect(mockUserDb.findOneOrFail).toHaveBeenCalledWith(testUser.id!, {});
            expect(mockUserDb.createQueryBuilder).toHaveBeenCalledTimes(1);
            expect(mockWhereInIds).toHaveBeenCalledWith(testUser.id!);

            expect(res).toEqual(deleteResult);
        });
    });

    describe("setPasswordExpires", () => {
        it("should return successfully if db call has on errors", async () => {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            const updatePartial = { passwordResetExpiresOn: expect.any(Date), passwordResetToken: expect.any(String) };
            const res = await userDAO.setPasswordExpires(testUser.id!);

            expect(mockUserDb.update).toHaveBeenCalledTimes(1);
            expect(mockUserDb.update).toHaveBeenCalledWith({ id: testUser.id! }, updatePartial);

            expect(res).toBeUndefined();
        });
    });
});
