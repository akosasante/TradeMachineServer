import { Team, User } from "@akosasante/trade-machine-models";
import "jest";
import "jest-extended";
import logger from "../../../src/bootstrap/logger";
import UserDO, { Role } from "../../../src/models/user";
import { TeamFactory } from "../../factories/TeamFactory";
import { UserFactory } from "../../factories/UserFactory";

describe("User Class", () => {
    beforeAll(() => {
        logger.debug("~~~~~~USER DATA OBJECT TESTS BEGIN~~~~~~");
    });
    afterAll(() => {
        logger.debug("~~~~~~USER DATA OBJECT COMPLETE~~~~~~");
    });
    const userObj = UserFactory.getUserObject(undefined, undefined,  undefined, Role.ADMIN, {id: "d4e3fe52-1b18-4cb6-96b1-600ed86ec45b"});
    const user = new UserDO(userObj);

    describe("constructor", () => {
        it("should assign all of the passed props on creation", () => {
            expect(user.email).toBeDefined();
            expect(user.email).toEqual(userObj.email);
            expect(user.password).toBeDefined();
            expect(user.password).toEqual(userObj.password);
            expect(user.displayName).toBeDefined();
            expect(user.displayName).toEqual(userObj.displayName);
            expect(user.role).toEqual(userObj.role);
            expect(user).toBeInstanceOf(UserDO);
            expect(userObj).not.toBeInstanceOf(UserDO);
        });
    });

    describe("instance methods", () => {
        describe("toUserModel/0", () => {
            it("should set up hasPassword correctly", () => {
                expect(user.toUserModel()).toBeInstanceOf(User);
                expect(user.toUserModel().hasPassword).toBeTrue();
                expect(UserFactory.getPasswordlessOwner().toUserModel().hasPassword).toBeFalse();
            });
            it("should set up relations correctly", () => {
                const testTeam = TeamFactory.getTeam(undefined, undefined,
                    {id: "d4e3fe52-1b18-4cb6-96b1-600ed86ec45b"});
                const userWithRelations = UserFactory.getUser(undefined, undefined,  undefined, Role.ADMIN, {id: "d4e3fe52-1b18-4cb6-96b1-600ed86ec45b", team: testTeam});
                const userModel = userWithRelations.toUserModel();
                expect(userModel.team).toBeInstanceOf(Team);
            });
        });

        it("toString/0 - should return a string with the DO id", () => {
            expect(user.toString()).toMatch(user.id!);
            expect(user.toString()).toMatch("UserDO#");
        });

        it("parse/1 - should take a user and return a POJO", () => {
            expect(user).toBeInstanceOf(UserDO);
            expect(user.parse()).not.toBeInstanceOf(UserDO);
            expect(user.parse()).toEqual(expect.any(Object));
        });

        describe("equals/2", () => {
            const firstUser = new UserDO(userObj);
            const otherUser = new UserDO(userObj);
            it("should match if the two instances are identical.", () => {
                expect(firstUser.equals(otherUser)).toBeTrue();
            });
            it("should match if the two instances are identical except for default excludes.", () => {
                firstUser.password = "pass1";
                otherUser.password = "pass2";
                expect(firstUser.equals(otherUser)).toBeTrue();
            });
            it("should match if the two instances are identical except for passed in excludes", () => {
                firstUser.displayName = "John";
                expect(firstUser.equals(otherUser, {displayName: true, password: true})).toBeTrue();
            });
            it("should throw a useful error if something doesn't match (props)", () => {
                firstUser.displayName = "John";
                otherUser.displayName = "Jack";
                expect(() => firstUser.equals(otherUser)).toThrow(new Error("Not matching: displayName"));
            });
            it("should throw a useful error if something doesn't match (objects)", () => {
                firstUser.displayName = "Jack";
                firstUser.role = Role.OWNER;
                expect(() => firstUser.equals(otherUser)).toThrow(new Error("Not matching: role"));
            });
        });
    });
});
