import { Server } from "http";
import request from "supertest";
import UserDAO from "../../src/DAO/UserDAO";
import { UserFactory } from "../factories/UserFactory";
import { generateHashedPassword } from "../../src/authentication/auth";
import { Connection } from "typeorm";
import User from "../../src/models/user";
import { PrismaClient } from "@prisma/client";
import logger from "../../src/bootstrap/logger";

export async function makeLoggedInRequest(
    agent: request.SuperTest<request.Test>,
    email: string,
    password: string,
    req: (ag: request.SuperTest<request.Test>) => any
) {
    await agent.post("/auth/login").send({ email, password }).expect(200);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return req(agent);
}

export async function doLogout(agent: request.SuperTest<request.Test>) {
    await agent.post("/auth/logout").send({}).expect(200);
}

export async function makePostRequest<T>(
    agent: request.SuperTest<request.Test>,
    url: string,
    obj: T,
    expectedStatus: number
) {
    return agent
        .post(url)
        .send(obj as unknown as { [key: string]: string | number | undefined | null })
        .expect("Content-Type", /json/)
        .expect(expectedStatus);
}

export async function makeGetRequest(agent: request.SuperTest<request.Test>, url: string, expectedStatus: number) {
    return agent.get(url).expect("Content-Type", /json/).expect(expectedStatus);
}

export async function makePutRequest<T>(
    agent: request.SuperTest<request.Test>,
    url: string,
    obj: T,
    expectedStatus: number
) {
    return agent
        .put(url)
        .send(obj as unknown as { [key: string]: string | number | undefined | null })
        .expect("Content-Type", /json/)
        .expect(expectedStatus);
}

export async function makeDeleteRequest(agent: request.SuperTest<request.Test>, url: string, expectedStatus: number) {
    return agent.delete(url).expect("Content-Type", /json/).expect(expectedStatus);
}

export async function makePatchRequest<T>(
    agent: request.SuperTest<request.Test>,
    url: string,
    obj: T,
    expectedStatus: number
) {
    return agent
        .patch(url)
        .send(obj as unknown as { [key: string]: string | number | undefined | null })
        .expect("Content-Type", /json/)
        .expect(expectedStatus);
}

export function stringifyQuery(query: { [key: string]: string }) {
    return "?".concat(
        Object.entries(query)
            .map(([key, val]) => {
                if (typeof val === "object") val = stringifyQuery(val);
                return `${key}=${encodeURIComponent(val)}`;
            })
            .join("&")
    );
}

export async function setupOwnerAndAdminUsers(): Promise<User[]> {
    const userDAO = new UserDAO();
    const ownerUser = UserFactory.getOwnerUser();
    const adminUser = UserFactory.getAdminUser();
    const password = await generateHashedPassword(UserFactory.GENERIC_PASSWORD);
    await userDAO.createUsers([
        { ...adminUser.parse(), password },
        {
            ...ownerUser.parse(),
            password,
        },
    ]);
    const savedAdmin = await userDAO.findUser({ email: adminUser.email });
    const savedOwner = await userDAO.findUser({ email: ownerUser.email });
    return [savedAdmin!, savedOwner!];
}

export const adminLoggedIn = (requestFn: (ag: request.SuperTest<request.Test>) => any, app: Server) =>
    makeLoggedInRequest(request.agent(app), UserFactory.ADMIN_EMAIL, UserFactory.GENERIC_PASSWORD, requestFn);
export const ownerLoggedIn = (requestFn: (ag: request.SuperTest<request.Test>) => any, app: Server) =>
    makeLoggedInRequest(request.agent(app), UserFactory.OWNER_EMAIL, UserFactory.GENERIC_PASSWORD, requestFn);

export const DatePatternRegex = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z/;

export const UUIDPatternRegex = /([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})/;

export const clearDb: (connection: Connection) => Promise<void> = async (connection: Connection) => {
    return await connection.synchronize(true);
};

export const clearPrismaDb = async (prisma: PrismaClient, schema = "test") => {
    const tableNames = await prisma.$queryRaw<
        { tablename: string }[]
    >`SELECT tablename FROM pg_tables WHERE schemaname=${schema};`;

    const tables = tableNames
        .map(({ tablename }) => tablename)
        .filter(name => !["typeorm_metadata", "_prisma_migrations", "query-result-cache", "oban_jobs"].includes(name))
        .map(name => `"${schema}"."${name}"`)
        .join(", ");

    try {
        return await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${tables} CASCADE;`);
    } catch (error) {
        logger.error({ error });
    }
};
