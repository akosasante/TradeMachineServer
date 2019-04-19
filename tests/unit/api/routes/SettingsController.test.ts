import "jest";
import "jest-extended";
import { EntityNotFoundError } from "typeorm/error/EntityNotFoundError";
import SettingsController from "../../../../src/api/routes/SettingsController";
import SettingsDAO, { ScheduleGetAllOptions } from "../../../../src/DAO/SettingsDAO";
import ScheduledDowntime from "../../../../src/models/scheduledDowntime";

describe("SettingsController", () => {
    const mockSettingsDAO = {
        getAllScheduledDowntimes: jest.fn(),
        getScheduledDowntimeById: jest.fn(),
        getCurrentlyScheduledDowntime: jest.fn(),
        createScheduledDowntime: jest.fn(),
        updateScheduledDowntime: jest.fn(),
        deleteScheduledDowntime: jest.fn(),
    };

    const testSchedule = new ScheduledDowntime({startTime: new Date(), endTime: new Date()});
    const settingsController = new SettingsController(mockSettingsDAO as unknown as SettingsDAO);

    afterEach(() => {
        Object.entries(mockSettingsDAO).forEach((kvp: [string, jest.Mock<any, any>]) => {
            kvp[1].mockClear();
        });
    });

    describe("getAllScheduledDowntime", () => {
        mockSettingsDAO.getAllScheduledDowntimes.mockReturnValue([testSchedule]);
        it("should return an array schedules if no param is passed", async () => {
            const res = await settingsController.getAllScheduledDowntime();

            expect(mockSettingsDAO.getAllScheduledDowntimes).toHaveBeenCalledTimes(1);
            expect(mockSettingsDAO.getAllScheduledDowntimes).toHaveBeenCalledWith(undefined);
            expect(res).toEqual([testSchedule]);
        });

        it("should call getAllScheduledDOwntimes with FUTURE if param passed", async () => {
            const res = await settingsController.getAllScheduledDowntime("future");

            expect(mockSettingsDAO.getAllScheduledDowntimes).toHaveBeenCalledTimes(1);
            expect(mockSettingsDAO.getAllScheduledDowntimes).toHaveBeenCalledWith(ScheduleGetAllOptions.FUTURE);
            expect(res).toEqual([testSchedule]);
        });

        it("should call getAllScheduledDowntimes with PREVIOUS if param passed", async () => {
            const res = await settingsController.getAllScheduledDowntime("previous");

            expect(mockSettingsDAO.getAllScheduledDowntimes).toHaveBeenCalledTimes(1);
            expect(mockSettingsDAO.getAllScheduledDowntimes).toHaveBeenCalledWith(ScheduleGetAllOptions.PREVIOUS);
            expect(res).toEqual([testSchedule]);
        });

        it("should bubble up any errors from the DAO", async () => {
            mockSettingsDAO.getAllScheduledDowntimes.mockImplementation(() => {
                throw new Error("Generic Error");
            });
            await expect(settingsController.getAllScheduledDowntime()).rejects.toThrow(Error);
        });
    });

    describe("getCurrentlyScheduledDowntime", () => {
        it("should return a current schedule", async () => {
            mockSettingsDAO.getCurrentlyScheduledDowntime.mockReturnValueOnce(testSchedule);
            const res = await settingsController.getCurrentlyScheduledDowntime();

            expect(mockSettingsDAO.getCurrentlyScheduledDowntime).toHaveBeenCalledTimes(1);
            expect(mockSettingsDAO.getCurrentlyScheduledDowntime).toHaveBeenCalledWith();
            expect(res).toEqual(testSchedule);
        });

        it("should throw an error if there is no current schedule", async () => {
            mockSettingsDAO.getCurrentlyScheduledDowntime.mockImplementation(() => {
                throw new EntityNotFoundError(ScheduledDowntime, "ID not found.");
            });
            await expect(settingsController.getCurrentlyScheduledDowntime()).rejects.toThrow(EntityNotFoundError);
        });
    });

    describe("getOneScheduledDowntime", () => {
        it("should return a schedule by id", async () => {
            const ID = 1;
            mockSettingsDAO.getScheduledDowntimeById.mockReturnValue(testSchedule);
            const res = await settingsController.getOneScheduledDowntime(ID);

            expect(mockSettingsDAO.getScheduledDowntimeById).toHaveBeenCalledTimes(1);
            expect(mockSettingsDAO.getScheduledDowntimeById).toHaveBeenCalledWith(ID);
            expect(res).toEqual(testSchedule);
        });

        it("should throw an error if schedule is not found in db", async () => {
            mockSettingsDAO.getScheduledDowntimeById.mockImplementation(() => {
                throw new EntityNotFoundError(ScheduledDowntime, "ID not found.");
            });
            await expect(settingsController.getOneScheduledDowntime(999)).rejects.toThrow(EntityNotFoundError);
        });
    });

    describe("createScheduledDowntime", () => {
        it("should create a schedule", async () => {
            mockSettingsDAO.createScheduledDowntime.mockReturnValueOnce(testSchedule);
            const res = await settingsController.createScheduledDowntime(testSchedule.parse());

            expect(mockSettingsDAO.createScheduledDowntime).toHaveBeenCalledTimes(1);
            expect(mockSettingsDAO.createScheduledDowntime).toHaveBeenCalledWith(testSchedule.parse());
            expect(res).toEqual(testSchedule);
        });

        it("should bubble up any errors from the DAO", async () => {
            mockSettingsDAO.createScheduledDowntime.mockImplementation(() => {
                throw new Error("Generic Error");
            });
            await expect(settingsController.createScheduledDowntime(testSchedule.parse())).rejects.toThrow(Error);
        });
    });

    describe("updateScheduledDowntime", () => {
        it("should return updated schedule for given id", async () => {
            const ID = 1;
            mockSettingsDAO.updateScheduledDowntime.mockReturnValueOnce(testSchedule);
            const res = await settingsController.updateScheduledDowntime(ID, testSchedule.parse());

            expect(mockSettingsDAO.updateScheduledDowntime).toHaveBeenCalledTimes(1);
            expect(mockSettingsDAO.updateScheduledDowntime).toHaveBeenCalledWith(ID, testSchedule.parse());
            expect(res).toEqual(testSchedule);
        });

        it("should throw an error if entity is not found in db", async () => {
            mockSettingsDAO.updateScheduledDowntime.mockImplementation(() => {
                throw new EntityNotFoundError(ScheduledDowntime, "ID not found.");
            });
            await expect(settingsController.updateScheduledDowntime(999, testSchedule.parse()))
                .rejects.toThrow(EntityNotFoundError);
        });
    });

    describe("deleteScheduledDowntime", () => {
        it("should return out custom delete result", async () => {
            const ID = 1;
            mockSettingsDAO.deleteScheduledDowntime.mockReturnValueOnce({ raw: [ [], ID ] });
            const res = await settingsController.deleteScheduledDowntime(ID);

            expect(mockSettingsDAO.deleteScheduledDowntime).toHaveBeenCalledTimes(1);
            expect(mockSettingsDAO.deleteScheduledDowntime).toHaveBeenCalledWith(ID);
            expect(res).toEqual({ deleteResult: true, id: ID });
        });

        it("should throw an error if entity is not found in db", async () => {
            mockSettingsDAO.deleteScheduledDowntime.mockImplementation(() => {
                throw new EntityNotFoundError(ScheduledDowntime, "ID not found.");
            });
            await expect(settingsController.deleteScheduledDowntime(999)).rejects.toThrow(EntityNotFoundError);
        });
    });
});
