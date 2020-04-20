import "jest";
import "jest-extended";
import { validateRow } from "../../../src/csv/CsvUtils";

describe("CSV Util Functions", () => {
    describe("validateRow/2", () => {
        // tslint:disable-next-line:object-literal-key-quotes
        const row = {keyA: 1, keyB: 2, "Complex Key C": 3};
        const rowWithNull = {keyA: null, keyB: 2, "Complex Key C": 3};
        const rowWithUndefined = {keyA: 1, keyB: undefined, "Complex Key C": 3};

        it("should return true if all required props are in the row obj", () => {
            const requiredProps = ["keyB", "keyA", "Complex Key C"];
            expect(validateRow(row, requiredProps)).toBeTrue();
        });
        it("should return true even if the row obj has extra keys", () => {
            const requiredProps = ["keyA", "Complex Key C"];
            expect(validateRow(row, requiredProps)).toBeTrue();
        });
        it("should return false if the row obj does not have required keys", () => {
            const requiredProps = ["keyA", "keyB", "keyD", "Complex Key C"];
            expect(validateRow(row, requiredProps)).toBeFalse();
        });
        it("should return false if any required props is null", () => {
            const requiredProps = ["keyB", "keyA", "Complex Key C"];
            expect(validateRow(rowWithNull, requiredProps)).toBeFalse();
        });
        it("should return false if any required props is undefined", () => {
            const requiredProps = ["keyB", "keyA", "Complex Key C"];
            expect(validateRow(rowWithUndefined, requiredProps)).toBeFalse();
        });
    });
});
