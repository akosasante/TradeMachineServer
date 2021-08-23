import logger from "../../../src/bootstrap/logger";
import User, {Role} from "../../../src/models/user";
import {UserFactory} from "../../factories/UserFactory";
// @ts-ignore
import uuid from "uuid/v4";

describe("User Class", () => {
    beforeAll(() => {
        logger.debug("~~~~~~USER TESTS BEGIN~~~~~~");
    });
    afterAll(() => {
        logger.debug("~~~~~~USER TESTS COMPLETE~~~~~~");
    });
    const userObj = UserFactory.getUserObject(undefined, undefined, undefined, Role.ADMIN, {id: uuid()});
    const user = new User(userObj);

    describe("constructor", () => {
        it("should assign all of the passed props on creation", () => {
            expect(user.email).toBeDefined();
            expect(user.email).toEqual(userObj.email);
            expect(user.password).toBeDefined();
            expect(user.password).toEqual(userObj.password);
            expect(user.displayName).toBeDefined();
            expect(user.displayName).toEqual(userObj.displayName);
            expect(user.role).toEqual(userObj.role);
            expect(user).toBeInstanceOf(User);
            expect(userObj).not.toBeInstanceOf(User);
        });
    });

    describe("instance methods", () => {
        it("toString/0 - should return a string with the UUID", () => {
            expect(user.toString()).toMatch(user.id!);
            expect(user.toString()).toMatch("User#");
        });

        it("parse/1 - should take a user and return a POJO", () => {
            expect(user).toBeInstanceOf(User);
            expect(user.parse()).not.toBeInstanceOf(User);
            expect(user.parse()).toEqual(userObj);
            expect(user.parse()).toEqual(expect.any(Object));
        });

        describe("isAdmin/0", () => {
            it("should return false if the user's role is not set or is owner", () => {
                const owner = new User({email: "test@example.com", role: Role.OWNER});
                expect(owner.isAdmin()).toEqual(false);

                owner.role = undefined;
                expect(owner.isAdmin()).toEqual(false);

                delete owner.role;
                expect(owner.isAdmin()).toEqual(false);
            });
            it("should return true if the user's role is admin", () => {
                const admin = new User({ email: "test@example.com", role: Role.ADMIN });
                expect(admin.isAdmin()).toEqual(true);
            });
        });
    });

    describe("static methods", () => {
        it("generateTimeToPasswordExpires/0", () => {
            const now = new Date("January 1 2019 1:00:00");
            const nowPlusHour = new Date("January 1 2019 2:00:00");

            expect(User.generateTimeToPasswordExpires(now.valueOf())).toEqual(nowPlusHour);
        });
    });
});
