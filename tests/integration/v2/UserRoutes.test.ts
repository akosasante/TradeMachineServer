import { Server } from "http";
import request from "supertest";
import "jest-extended";
import { redisClient } from "../../../src/bootstrap/express";
import logger from "../../../src/bootstrap/logger";
import initializeDb from "../../../src/bootstrap/prisma-db";
import startServer from "../../../src/bootstrap/app";
import { clearDb, clearPrismaDb, DatePatternRegex, makeGetRequest, setupOwnerAndAdminUsers } from "../helpers";
import { PrismaClient, Prisma } from "@prisma/client";
import User, { UserStatus, Role as UserRole } from "../../../src/models/user";
import { UserFactory } from "../../factories/UserFactory";
import UserDAO from "../../../src/DAO/UserDAO";

let app: Server;
let prismaConn: PrismaClient;
let ownerUser: User;
let adminUser: User;
let userDao: UserDAO;

async function shutdown() {
    try {
        await redisClient.disconnect();
    } catch (err) {
        logger.error(`Error while closing redis: ${err}`);
    }
}

beforeAll(async () => {
    logger.debug("~~~~~~[V2] USER ROUTES BEFORE ALL~~~~~~");
    app = await startServer();
    logger.debug("server started");
    prismaConn = initializeDb(true);
    logger.debug("prisma conn started");
    // Create admin and owner users in db for rest of this suite's use
    [adminUser, ownerUser] = await setupOwnerAndAdminUsers();
    logger.debug("users created");

    // TODO: Replace with Prisma dao once we've implemented creating users
    userDao = new UserDAO();

    return app;
    // TODO: Hopefully we can remove the timeout after not relying on TypeORM
}, 40000);

afterAll(async () => {
    logger.debug("~~~~~~[V2] USER ROUTES AFTER ALL~~~~~~");
    const shutdownRedis = await shutdown();
    if (app) {
        app.close(() => {
            logger.debug("CLOSED SERVER");
        });
    }
    return shutdownRedis;
});

describe("User V2 API Endpoints", () => {
    afterEach(async () => {
        logger.debug("aftereach test!");
        return await clearPrismaDb(prismaConn);
    });

    describe("GET /v2/users (get all users)", () => {
        logger.debug("GET test!");
        const getAllRequest = (status = 200) => makeGetRequest(request(app), "/v2/users", status);

        it("should return an array of all the users in the db", async () => {
            logger.debug("inside test!");
            // admin and owner user are inserted in beforeEach block; here we insert two additional users
            await userDao.createUsers([UserFactory.getUser("akos@example.com"), UserFactory.getUser()]);

            const { body } = await getAllRequest();

            expect(body).toBeArrayOfSize(4);
            const returnedAdmin = body.find((user: User) => user.id === adminUser.id);
            expect(returnedAdmin).toMatchObject({
                ...adminUser,
                role: User.getKeyByValue(UserRole, adminUser.role),
                status: User.getKeyByValue(UserStatus, adminUser.status),
                dateCreated: expect.stringMatching(DatePatternRegex),
                dateModified: expect.stringMatching(DatePatternRegex),
            });
            expect(returnedAdmin.password).toBeUndefined();
        });
    });
});
