import "jest";
import "jest-extended";
import { NotFoundError } from "routing-controllers";
import * as typeorm from "typeorm";
import SettingsDAO, { ScheduleGetAllOptions } from "../../../src/DAO/SettingsDAO";
import ScheduledDowntime from "../../../src/models/scheduledDowntime";

const mockSettingsDb = {
    find: jest.fn(),
    findOneOrFail: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
};

// @ts-ignore
jest.spyOn(typeorm, "getConnection").mockReturnValue({ getRepository: jest.fn().mockReturnValue(mockSettingsDb) });

describe("SettingsDAO", () => {
    const settingsDAO = new SettingsDAO();
    const testSchedule = new ScheduledDowntime({startTime: new Date(), endTime: new Date()});

    afterEach(() => {
        Object.entries(mockSettingsDb).forEach((kvp: [string, jest.Mock<any, any>]) => {
            kvp[1].mockClear();
        });
    });

    afterAll(async () => {
        await settingsDAO.connection.close();
    });

    describe("getAllScheduledDowntimes", () => {
        const defaultOpts = { order: { startTime: "ASC" } };

        it("should call the db find method once", async () => {
            mockSettingsDb.find.mockReturnValueOnce([testSchedule.parse()]);
            const res = await settingsDAO.getAllScheduledDowntimes();

            expect(mockSettingsDb.find).toHaveBeenCalledTimes(1);
            expect(mockSettingsDb.find).toHaveBeenCalledWith(defaultOpts);
            expect(res).toEqual([testSchedule]);
        });

        it("should call the db find method with the future find options", async () => {
            mockSettingsDb.find.mockReturnValueOnce([testSchedule.parse()]);
            const expectedQueryOpt = {
                ...defaultOpts,
                where: {
                    startTime: expect.objectContaining({
                        _type: "moreThan",
                        _value: expect.any(Date),
                    }),
                },
            };
            const res = await settingsDAO.getAllScheduledDowntimes(ScheduleGetAllOptions.FUTURE);

            expect(mockSettingsDb.find).toHaveBeenCalledTimes(1);
            expect(mockSettingsDb.find).toHaveBeenCalledWith(expectedQueryOpt);
            expect(res).toEqual([testSchedule]);
        });

        it("should call the db find method with the past find options", async () => {
            mockSettingsDb.find.mockReturnValueOnce([testSchedule.parse()]);
            const expectedQueryOpt = {
                ...defaultOpts,
                where: {
                    endTime: expect.objectContaining({
                        _type: "lessThan",
                        _value: expect.any(Date),
                    }),
                },
            };
            const res = await settingsDAO.getAllScheduledDowntimes(ScheduleGetAllOptions.PREVIOUS);

            expect(mockSettingsDb.find).toHaveBeenCalledTimes(1);
            expect(mockSettingsDb.find).toHaveBeenCalledWith(expectedQueryOpt);
            expect(res).toEqual([testSchedule]);
        });
    });

    describe("getScheduledDowntimeById", () => {
        it("should throw NotFoundError if no id is passed", async () => {
            // @ts-ignore
            await expect(settingsDAO.getScheduledDowntimeById(undefined)).rejects.toThrow(NotFoundError);
            expect(mockSettingsDb.findOneOrFail).toHaveBeenCalledTimes(0);
        });

        it("should call the db findOneOrFail once with id", async () => {
            mockSettingsDb.findOneOrFail.mockReturnValueOnce(testSchedule.parse());
            const ID = 1;
            const res = await settingsDAO.getScheduledDowntimeById(ID);

            expect(mockSettingsDb.findOneOrFail).toHaveBeenCalledTimes(1);
            expect(mockSettingsDb.findOneOrFail).toHaveBeenCalledWith(ID);
            expect(res).toEqual(testSchedule);
        });
    });

    describe("getCurrentlyScheduledDowntime", () => {
        it("should call findOneOrFail with the appropriate query params", async () => {
            const expectedOpts = {
                where: {
                    startTime: expect.objectContaining({
                        _type: "lessThan",
                        _value: expect.any(Date),
                    }),
                    endTime: expect.objectContaining({
                        _type: "moreThan",
                        _value: expect.any(Date),
                    }),
                },
            };
            mockSettingsDb.findOneOrFail.mockReturnValueOnce(testSchedule.parse());
            const res = await settingsDAO.getCurrentlyScheduledDowntime();

            expect(mockSettingsDb.findOneOrFail).toHaveBeenCalledTimes(1);
            expect(mockSettingsDb.findOneOrFail).toHaveBeenCalledWith(expectedOpts);
            expect(res).toEqual(testSchedule);
        });
    });

    describe("createScheduledDowntime", () => {
        it("should call the db save once with the downtimeObj", async () => {
            mockSettingsDb.save.mockReturnValueOnce(testSchedule.parse());
            const res = await settingsDAO.createScheduledDowntime(testSchedule.parse());

            expect(mockSettingsDb.save).toHaveBeenCalledTimes(1);
            expect(mockSettingsDb.save).toHaveBeenCalledWith(testSchedule.parse());
            expect(res).toEqual(testSchedule);
        });
    });

    describe("udpateScheduledDowntime", () => {
        it("should call the db update and findOneOrFail once with id and downtimeObj", async () => {
            const ID = 1;
            mockSettingsDb.findOneOrFail.mockReturnValueOnce(testSchedule.parse());
            const res = await settingsDAO.updateScheduledDowntime(ID, testSchedule.parse());

            expect(mockSettingsDb.update).toHaveBeenCalledTimes(1);
            expect(mockSettingsDb.update).toHaveBeenCalledWith({ id: ID }, testSchedule.parse());

            expect(mockSettingsDb.findOneOrFail).toHaveBeenCalledTimes(1);
            expect(mockSettingsDb.findOneOrFail).toHaveBeenCalledWith(ID);
            expect(res).toEqual(testSchedule);
        });
    });

    describe("deleteScheduledDowntime", () => {
        it("should throw NotFoundError if no id is passed", async () => {
            // @ts-ignore
            await expect(settingsDAO.deleteScheduledDowntime(undefined)).rejects.toThrow(NotFoundError);
            expect(mockSettingsDb.delete).toHaveBeenCalledTimes(0);
        });

        it("should call the db delete once with id", async () => {
            const ID = 1;
            await settingsDAO.deleteScheduledDowntime(ID);

            expect(mockSettingsDb.findOneOrFail).toHaveBeenCalledTimes(1);
            expect(mockSettingsDb.findOneOrFail).toHaveBeenCalledWith(ID);

            expect(mockSettingsDb.delete).toHaveBeenCalledTimes(1);
            expect(mockSettingsDb.delete).toHaveBeenCalledWith(ID);
        });
    });
});
