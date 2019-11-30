import { Team, User } from "@akosasante/trade-machine-models";
import "jest";
import "jest-extended";
import UserDO, { Role } from "../../../src/models/user";
import { TeamFactory } from "../../factories/TeamFactory";
import { UserFactory } from "../../factories/UserFactory";

describe("User Class", () => {
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

    // describe("static methods", () => {
    //     it("generateHashedPassword/1 - should resolve a hashed password", async () => {
    //         const pass = await UserDO.generateHashedPassword("lol");
    //         expect(pass).toEqual(expect.any(String));
    //         expect(pass).not.toEqual("lol");
    //     });
    //
    //     it("generateTimeToPasswordExpires/0 - should return a time at least 59 mins from now", () => {
    //         const now = new Date();
    //         const beforeExpiry = now.getMilliseconds() + (1 * 60 * 60 * 1000);
    //         const expiry = UserDO.generateTimeToPasswordExpires();
    //         expect(beforeExpiry).toBeBefore(expiry);
    //     });
    //     it("sanitizeUUID/1 - should return a string with no dashes", () => {
    //         const token = "9911046e-159f-483f-afd5-389e07b606a7";
    //         const sanitized = UserDO.sanitizeUUID(token);
    //         expect(sanitized.length).toBeLessThan(token.length);
    //         expect(sanitized.includes("-")).toBeFalse();
    //     });
    // });

    // describe("getters", () => {
    //     it("publicUser/0 - should return a user copy with no password", () => {
    //         expect(user.publicUser).toBeInstanceOf(UserDO);
    //         expect(user.publicUser.hasPassword).toBeTrue();
    //         expect(user.publicUser.password).toBeFalsy();
    //     });
    // });

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
        // it("isPasswordMatching/1 - should resolve true if it's a matching password", async () => {
        //     user.password = await UserDO.generateHashedPassword(user.password!);
        //     expect((await user.isPasswordMatching("lol"))).toBeTrue();
        // });
        // it("isPasswordMatching/1 - should resolve false if it's not a matching password", async () => {
        //     const completelyWrong = await user.isPasswordMatching("");
        //     expect(completelyWrong).toBeFalse();
        //     user.password = "test";
        //     const plainTextInsteadOfHash = await user.isPasswordMatching("test");
        //     expect(plainTextInsteadOfHash).toBeFalse();
        // });

        it("toString/0 - should return a string with the DO id", () => {
            expect(user.toString()).toMatch(user.id!);
            expect(user.toString()).toMatch("UserDO#");
        });

        // it("isAdmin/0 - should return true if it is an admin", () => {
        //     expect(user.isAdmin()).toBeTrue();
        // });
        //
        // it("hasRole/1 - should return true if it has the role", () => {
        //     expect(user.hasRole(Role.ADMIN)).toBeTrue();
        // });
        // it("hasRole/1 - should return false if it has no roles or no matching role", () => {
        //     expect(user.hasRole(Role.OWNER)).toBeFalse();
        //     user.roles = [];
        //     expect(user.hasRole(Role.ADMIN)).toBeFalse();
        // });

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

        // describe("passwordResetIsValid/0", () => {
        //     it("should return true if the passwordResetTime vs currentTime is greater than or equal to 0", () => {
        //         const date = new Date(Date.now() + (30 * 60 * 1000)); // half an hour from now
        //         const validUser = new UserDO({passwordResetExpiresOn: date});
        //         expect(validUser.passwordResetIsValid()).toBeTrue();
        //     });
        //     it("should return true if the passwordResetTime vs currentTime is greater than or equal to 0", () => {
        //         const date = new Date("January 1 1990");
        //         const expiredUser = new UserDO({passwordResetExpiresOn: date});
        //         expect(expiredUser.passwordResetIsValid()).toBeFalse();
        //     });
        // });
    });
});
