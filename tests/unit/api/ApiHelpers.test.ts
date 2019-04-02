import { IsNull, Not } from "typeorm";
import { cleanupQuery } from "../../../src/api/ApiHelpers";

describe("ApiHelpers utility functions", () => {
    describe("cleanupQuery/1", () => {
        const baseQuery: any = { username: "aasante" };
        it("should remove the 'multiple' key from the query obj", () => {
            const query = {...baseQuery, multiple: "true"};
            const returned: any = cleanupQuery(query);
            expect(returned.multiple).toBeUndefined();
        });
        it("should turn all of the accepted values into ISNULL", () => {
            const keys = ["null", "undefined"];
            for (const key of keys) {
                const query = {...baseQuery, field: key};
                const returned: any = cleanupQuery(query);
                expect(returned.field.value).toEqual(IsNull().value); // undefined
            }
        });
        it("should turn all of the accepted values into ISNOTNULLs", () => {
            const keys = ["null", "undefined"];
            for (const key of keys) {
                const query = {...baseQuery, field: key};
                const returned: any = cleanupQuery(query);
                expect(returned.field.value).toEqual(Not(IsNull()).value); //
            }
        });
    });
});
