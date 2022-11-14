import UserController from "../../../../../src/api/routes/v2/UserController";
import UserDAO from "../../../../../src/DAO/v2/UserDAO";
import { mockDeep, mockClear } from "jest-mock-extended";
import logger from "../../../../../src/bootstrap/logger";
import { UserFactory } from "../../../../factories/UserFactory";
import { User } from "@prisma/client";

describe("[V2] UserController", () => {
    const testUser: User = UserFactory.getPrismaUser();
    const testPublicUser = UserDAO.publicUser(testUser);
    const Users = mockDeep<UserDAO>();
    const userController = new UserController(Users);

    afterEach(() => {
        mockClear(Users);
    });
    beforeAll(() => {
        logger.debug("~~~~~~PRISMA USER CONTROLLER TESTS BEGIN~~~~~~");
    });
    afterAll(() => {
        logger.debug("~~~~~~PRISMA USER CONTROLLER TESTS COMPLETE~~~~~~");
    });

    describe("getAll()", () => {
        it("should return an array of public users", async () => {
            Users.getAllUsers.mockResolvedValueOnce([testPublicUser]);
            const res = await userController.getAll();

            expect(Users.getAllUsers).toHaveBeenCalledTimes(1);
            expect(Users.getAllUsers).toHaveBeenCalledWith();

            expect(res).toEqual([testPublicUser]);
        });
    });
});
