import { PrismaClient, User } from "@prisma/client";
import logger from "../../../../src/bootstrap/logger";
import { mockDeep, mockClear } from "jest-mock-extended";
import UserDAO from "../../../../src/DAO/v2/UserDAO";
import { UserFactory } from "../../../factories/UserFactory";

describe("[PRISMA] UserDAO", () => {
    const testUser: User = UserFactory.getPrismaUser();
    const prisma = mockDeep<PrismaClient["user"]>();
    const Users: UserDAO = new UserDAO(prisma);

    afterEach(() => {
        mockClear(prisma);
    });

    beforeAll(() => {
        logger.debug("~~~~~~PRISMA USER DAO TESTS BEGIN~~~~~~");
    });
    afterAll(() => {
        logger.debug("~~~~~~PRISMA USER DAO TESTS COMPLETE~~~~~~");
    });

    describe("getAllUsers", () => {
        it("should return an array of public users by calling the db", async () => {
            prisma.findMany.mockResolvedValueOnce([testUser]);
            const publicUser = UserDAO.publicUser(testUser);
            const sortOptions = { orderBy: { id: "asc" } };

            const res = await Users.getAllUsers();

            expect(prisma.findMany).toHaveBeenCalledTimes(1);
            expect(prisma.findMany).toHaveBeenCalledWith(sortOptions);
            expect(res).toEqual([publicUser]);
        });
    });
});
