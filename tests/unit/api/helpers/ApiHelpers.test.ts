import { IsNull, Not } from "typeorm";
import { cleanupQuery } from "../../../../src/api/helpers/ApiHelpers";
import logger from "../../../../src/bootstrap/logger";

describe("ApiHelpers utility functions", () => {
    beforeAll(() => {
        logger.debug("~~~~~~API HELPERS TESTS BEGIN~~~~~~");
    });
    afterAll(() => {
        logger.debug("~~~~~~API HELPERS TESTS COMPLETE~~~~~~");
    });
    describe("cleanupQuery/1", () => {
        const baseQuery: any = { username: "aasante" };
        it("should turn all of the accepted values into ISNULL", () => {
            const keys = ["null", "undefined"];
            for (const key of keys) {
                const query = { ...baseQuery, field: key };

                const returned: any = cleanupQuery(query);
                expect(returned.field.value).toEqual(IsNull().value);
                expect(returned.field._type).toBe("isNull");
            }
        });
        it("should turn all of the accepted values into ISNOTNULLs", () => {
            const keys = ["not null", "!undefined"];
            for (const key of keys) {
                const query = { ...baseQuery, field: key };

                const returned: any = cleanupQuery(query);
                expect(returned.field.value).toEqual(Not(IsNull()).value);
                expect(returned.field._type).toBe("not");
            }
        });
    });
});
