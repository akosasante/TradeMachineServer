import "jest";
import "jest-extended";
import User, { Role } from "../../../src/models/user";

describe("User Class", () => {
    const userObj = {email: "test@example.com", password: "lol", roles: [Role.ADMIN]};
    const user = new User(userObj);

    describe("constructor", () => {
        it("should assign all of the passed props on creation and setup hasPassword", () => {
            expect(user.email).toBeDefined();
            expect(user.email).toEqual(userObj.email);
            expect(user.password).toBeDefined();
            expect(user.password).toEqual(userObj.password);
            expect(user.roles).toEqual(userObj.roles);
            expect(user).toBeInstanceOf(User);
            expect(userObj).not.toBeInstanceOf(User);
            expect(user.hasPassword!).toBeTrue();
            expect((new User({email: "x"})).hasPassword!).toBeFalse();
        });
    });

    describe("static methods", () => {
        it("generateHashedPassword/1 - should resolve a hashed password", async () => {
            const pass = await User.generateHashedPassword("lol");
            expect(pass).toEqual(expect.any(String));
            expect(pass).not.toEqual("lol");
        });

        it("generateTimeToPasswordExpires/0 - should return a time at least 59 mins from now", () => {
            const now = new Date();
            const beforeExpiry = now.getMilliseconds() + (1 * 60 * 60 * 1000);
            const expiry = User.generateTimeToPasswordExpires();
            expect(beforeExpiry).toBeBefore(expiry);
        });
        it("sanitizeUUID/1 - should return a string with no dashes", () => {
            const token = "9911046e-159f-483f-afd5-389e07b606a7";
            const sanitized = User.sanitizeUUID(token);
            expect(sanitized.length).toBeLessThan(token.length);
            expect(sanitized.includes("-")).toBeFalse();
        });
    });

    describe("getters", () => {
        it("publicUser/0 - should return a user copy with no password", () => {
            expect(user.publicUser).toBeInstanceOf(User);
            expect(user.publicUser.hasPassword).toBeTrue();
            expect(user.publicUser.password).toBeFalsy();
        });
    });

    describe("instance methods", () => {
        it("isPasswordMatching/1 - should resolve true if it's a matching password", async () => {
            user.password = await User.generateHashedPassword(user.password!);
            expect((await user.isPasswordMatching("lol"))).toBeTrue();
        });
        it("isPasswordMatching/1 - should resolve false if it's not a matching password", async () => {
            const completelyWrong = await user.isPasswordMatching("");
            expect(completelyWrong).toBeFalse();
            user.password = "test";
            const plainTextInsteadOfHash = await user.isPasswordMatching("test");
            expect(plainTextInsteadOfHash).toBeFalse();
        });

        it("toString/0 - should return a string including the first available identifying property", () => {
            expect(user.toString()).toMatch(user.email!);
            user.username = "elgod";
            expect(user.toString()).toMatch(user.username);
            user.name = "Jatheesh";
            expect(user.toString()).toMatch(user.name);
            expect(user.toString()).toMatch("User#");
            expect(user.toString()).not.toMatch(user.email!);
        });

        it("isAdmin/0 - should return true if it is an admin", () => {
            expect(user.isAdmin()).toBeTrue();
        });

        it("hasRole/1 - should return true if it has the role", () => {
            expect(user.hasRole(Role.ADMIN)).toBeTrue();
        });
        it("hasRole/1 - should return false if it has no roles or no matching role", () => {
            expect(user.hasRole(Role.OWNER)).toBeFalse();
            user.roles = [];
            expect(user.hasRole(Role.ADMIN)).toBeFalse();
        });

        it("parse/1 - should take a user and return a POJO", () => {
            expect(user).toBeInstanceOf(User);
            expect(user.parse()).not.toBeInstanceOf(User);
            expect(user.parse()).toEqual(expect.any(Object));
        });

        describe("equals/2", () => {
            const firstUser = new User(userObj);
            const otherUser = new User(userObj);
            it("should match if the two instances are identical.", () => {
                expect(firstUser.equals(otherUser)).toBeTrue();
            });
            it("should match if the two instances are identical except for default excludes.", () => {
                firstUser.password = "pass1";
                otherUser.password = "pass2";
                expect(firstUser.equals(otherUser)).toBeTrue();
            });
            it("should match if the two instances are identical except for passed in excludes", () => {
                firstUser.name = "John";
                expect(firstUser.equals(otherUser, {name: true, password: true})).toBeTrue();
            });
            it("should throw a useful error if something doesn't match (props)", () => {
                firstUser.name = "John";
                otherUser.name = "Jack";
                expect(() => firstUser.equals(otherUser)).toThrow(new Error("Not matching: name"));
            });
            it("should throw a useful error if something doesn't match (objects)", () => {
                firstUser.name = "Jack";
                firstUser.roles = [Role.ADMIN, Role.OWNER];
                expect(() => firstUser.equals(otherUser)).toThrow(new Error("Not matching: roles"));
            });
        });

        describe("passwordResetIsValid/0", () => {
            it("should return true if the passwordResetTime vs currentTime is greater than or equal to 0", () => {
                const date = new Date(Date.now() + (30 * 60 * 1000)); // half an hour from now
                const validUser = new User({passwordResetExpiresOn: date});
                expect(validUser.passwordResetIsValid()).toBeTrue();
            });
            it("should return true if the passwordResetTime vs currentTime is greater than or equal to 0", () => {
                const date = new Date("January 1 1990");
                const expiredUser = new User({passwordResetExpiresOn: date});
                expect(expiredUser.passwordResetIsValid()).toBeFalse();
            });
        });
    });
});
