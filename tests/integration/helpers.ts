import { Server } from "http";
import request from "supertest";
import UserDAO from "../../src/DAO/UserDAO";
import { UserFactory } from "../factories/UserFactory";

export async function makeLoggedInRequest(agent: request.SuperTest<request.Test>, email: string, password: string,
                                          req: (ag: request.SuperTest<request.Test>) => any) {
    await agent
        .post("/auth/login")
        .send({email, password})
        .expect(200);
    return req(agent);
}

export async function doLogout(agent: request.SuperTest<request.Test>) {
    await agent
        .post("/auth/logout")
        .send({})
        .expect(200);
}

export async function makePostRequest<T>(agent: request.SuperTest<request.Test>,
                                         url: string, obj: T, expectedStatus: number) {
    return agent
        .post(url)
        .send(obj as unknown as object)
        .expect("Content-Type", /json/)
        .expect(expectedStatus);
}

export async function makeGetRequest(agent: request.SuperTest<request.Test>, url: string, expectedStatus: number) {
    return agent
        .get(url)
        .expect("Content-Type", /json/)
        .expect(expectedStatus);
}

export async function makePutRequest<T>(agent: request.SuperTest<request.Test>, url: string,
                                        obj: T, expectedStatus: number) {
    return agent
        .put(url)
        .send(obj as unknown as object)
        .expect("Content-Type", /json/)
        .expect(expectedStatus);
}

export async function makeDeleteRequest(agent: request.SuperTest<request.Test>, url: string, expectedStatus: number) {
    return agent
        .delete(url)
        .expect("Content-Type", /json/)
        .expect(expectedStatus);
}

export async function makePatchRequest<T>(agent: request.SuperTest<request.Test>, url: string,
                                          obj: T, expectedStatus: number) {
    return agent
        .patch(url)
        .send(obj as unknown as object)
        .expect("Content-Type", /json/)
        .expect(expectedStatus);
}

export function stringifyQuery(query: any) {
    return Object.entries(query).reduce((queryString: string, kvp: any) =>
        `${queryString}${kvp[0]}=${kvp[1]}&`, "?");
}

export async function setupOwnerAndAdminUsers() {
    const userDAO = new UserDAO();
    const ownerUser = UserFactory.getOwnerUser();
    const adminUser = UserFactory.getAdminUser();
    const [savedAdmin] = await userDAO.createUsers([adminUser.parse()]);
    const [savedOwner] = await userDAO.createUsers([ownerUser.parse()]);
    return [savedAdmin, savedOwner];
}

export const adminLoggedIn = (requestFn: (ag: request.SuperTest<request.Test>) => any, app: Server) =>
    makeLoggedInRequest(request.agent(app), UserFactory.ADMIN_EMAIL, UserFactory.GENERIC_PASSWORD, requestFn);
export const ownerLoggedIn = (requestFn: (ag: request.SuperTest<request.Test>) => any, app: Server) =>
    makeLoggedInRequest(request.agent(app), UserFactory.OWNER_EMAIL, UserFactory.GENERIC_PASSWORD, requestFn);
