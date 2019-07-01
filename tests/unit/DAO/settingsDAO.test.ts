import "jest";
import "jest-extended";
import { NotFoundError } from "routing-controllers";
import * as typeorm from "typeorm";
import SettingsDAO, { ScheduleGetAllOptions } from "../../../src/DAO/SettingsDAO";
import GeneralSettings, { TradeDeadlineStatus } from "../../../src/models/generalSettings";
import ScheduledDowntime from "../../../src/models/scheduledDowntime";
import User, { Role } from "../../../src/models/user";

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
    const startDate = new Date("January 1 2019 1:00");
    const endDate = new Date("January 1 2019 5:00");
    const deadline = {status: TradeDeadlineStatus.ON, startTime: startDate, endTime: endDate};
    const testSettings = new GeneralSettings({deadline});

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

    describe("getAllGeneralSettings", () => {
        const defaultOpts = {order: {dateCreated: "DESC"}, relations: ["modifiedBy"]};

        it("should call the db find method once", async () => {
            mockSettingsDb.find.mockReturnValue([testSettings.parse()]);
            const res = await settingsDAO.getAllGeneralSettings();

            expect(mockSettingsDb.find).toHaveBeenCalledTimes(1);
            expect(mockSettingsDb.find).toHaveBeenCalledWith(defaultOpts);
            expect(res).toEqual([testSettings]);
        });
    });

    describe("getSettingsById", () => {
        it("should throw NotFoundError if no id is passed", async () => {
            // @ts-ignore
            await expect(settingsDAO.getSettingsById(undefined)).rejects.toThrow(NotFoundError);
            expect(mockSettingsDb.findOneOrFail).toHaveBeenCalledTimes(0);
        });
        it("should call the db findOneOrFail once with id", async () => {
            mockSettingsDb.findOneOrFail.mockReturnValue(testSettings.parse());
            const ID = 1;
            const res = await settingsDAO.getSettingsById(ID);

            expect(mockSettingsDb.findOneOrFail).toHaveBeenCalledTimes(1);
            expect(mockSettingsDb.findOneOrFail).toHaveBeenCalledWith(ID, {relations: ["modifiedBy"]});
            expect(res).toEqual(testSettings);
        });
    });

    describe("getMostRecentSettings", () => {
        it("should call find with the appropriate query params", async () => {
            const opts = {order: {dateCreated: "DESC"}, take: 1, relations: ["modifiedBy"]};
            mockSettingsDb.find.mockRejectedValueOnce([testSettings.parse()]);
            const res = await settingsDAO.getMostRecentSettings();

            expect(mockSettingsDb.find).toHaveBeenCalledTimes(1);
            expect(mockSettingsDb.find).toHaveBeenCalledWith(opts);
            expect(res).toEqual(testSettings);
        });
    });

    describe("insertNewSettingsLine", () => {
        const modifiedBy = new User({email: "test@example.com", password: "lol", roles: [Role.ADMIN]});

        it("should pass the partial to the db if there is no recent setting", async () => {
            mockSettingsDb.find.mockReturnValueOnce([]);
            const newSettings = {deadline, modifiedBy};
            mockSettingsDb.save.mockReturnValue(new GeneralSettings({...newSettings, id: undefined}));

            const res = await settingsDAO.insertNewSettingsLine(newSettings);

            expect(res).toEqual(new GeneralSettings(newSettings));
            expect(mockSettingsDb.find).toHaveBeenCalledTimes(1);
            expect(mockSettingsDb.save).toHaveBeenCalledTimes(1);
            expect(mockSettingsDb.save).toHaveBeenCalledWith(newSettings);
        });
        it("should add new fields to the most recent setting before saving", async () => {
            mockSettingsDb.find.mockReturnValueOnce([{deadline}]);
            const newSettings = {modifiedBy};
            const mergedSettings = {deadline, ...newSettings};
            mockSettingsDb.save.mockReturnValue(new GeneralSettings({...mergedSettings, id: undefined}));

            const res = await settingsDAO.insertNewSettingsLine(newSettings);

            expect(res).toEqual(new GeneralSettings(mergedSettings));
            expect(mockSettingsDb.find).toHaveBeenCalledTimes(1);
            expect(mockSettingsDb.save).toHaveBeenCalledTimes(1);
            expect(mockSettingsDb.save).toHaveBeenCalledWith(mergedSettings);
        });
        it("should overwrite the most recent setting with updated values before saving", async () => {
            mockSettingsDb.find.mockReturnValueOnce([{deadline, modifiedBy}]);
            const newSettings = {deadline: {status: TradeDeadlineStatus.OFF, startTime: startDate, endTime: endDate}};
            const mergedSettings = {deadline, modifiedBy, ...newSettings};
            mockSettingsDb.save.mockReturnValue(new GeneralSettings({...mergedSettings, id: undefined}));

            const res = await settingsDAO.insertNewSettingsLine(newSettings);

            expect(res).toEqual(new GeneralSettings(mergedSettings));
            expect(mockSettingsDb.find).toHaveBeenCalledTimes(1);
            expect(mockSettingsDb.save).toHaveBeenCalledTimes(1);
            expect(mockSettingsDb.save).toHaveBeenCalledWith(mergedSettings);
        });
    });
});
