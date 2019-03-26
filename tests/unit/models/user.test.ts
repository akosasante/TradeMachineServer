import "jest";
import "jest-extended";
import User, { Role } from "../../../src/models/user";

describe("User Class", () => {
    const userObj = {email: "test@example.com", password: "lol", roles: [Role.ADMIN]};
    const user = new User(userObj);
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
    it("publicUser/0 - should return a user copy with no password", () => {
        expect(user.publicUser).toBeInstanceOf(User);
        expect(user.publicUser.hasPassword).toBeTrue();
        expect(user.publicUser.password).toBeFalsy();
    });
    it("generateHashedPassword/1 - should resolve a hashed password", async () => {
        const pass = await User.generateHashedPassword("lol");
        expect(pass).toEqual(expect.any(String));
    });
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
        it("should match if the two instances are identical. Excludes = {}", () => {
            expect(firstUser.equals(otherUser)).toBeTrue();
        });
        it("should match if the two instances are identical. Excludes = default", () => {
            firstUser.password = "pass1";
            otherUser.password = "pass2";
            expect(firstUser.equals(otherUser)).toBeTrue();
        });
        it("should match if the two instances are identical except for passed in excludes", () => {
            firstUser.name = "John";
            expect(firstUser.equals(otherUser, {name: true, password: true})).toBeTrue();
        });
        it("should throw a useful error if something doesn't match (props)", () => {
            expect(() => firstUser.equals(otherUser)).toThrow(new Error("Not matching: name"));
        });
        it("should throw a useful error if something doesn't match (objects)", () => {
            firstUser.roles = [Role.ADMIN, Role.OWNER];
            otherUser.name = "John";
            expect(() => firstUser.equals(otherUser)).toThrow(new Error("Not matching: roles"));
        });
    });
});
