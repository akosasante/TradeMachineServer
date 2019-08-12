import "jest";
import "jest-extended";
import { mocked } from "ts-jest/utils";
import { EntityNotFoundError } from "typeorm/error/EntityNotFoundError";
import DraftPickController from "../../../../src/api/routes/DraftPickController";
import { processDraftPickCsv } from "../../../../src/csv/DraftPickParser";
import DraftPickDAO from "../../../../src/DAO/DraftPickDAO";
import TeamDAO from "../../../../src/DAO/TeamDAO";
import DraftPick from "../../../../src/models/draftPick";
import { LeagueLevel } from "../../../../src/models/player";
import User from "../../../../src/models/user";
import { DraftPickFactory } from "../../../factories/DraftPickFactory";

jest.mock("../../../../src/csv/DraftPickParser");
const mockedCsvParser = mocked(processDraftPickCsv);

describe("DraftPickController", () => {
    const mockDraftPickDAO = {
        getAllPicks: jest.fn(),
        getPickById: jest.fn(),
        findPicks: jest.fn(),
        createPick: jest.fn(),
        updatePick: jest.fn(),
        deletePick: jest.fn(),
    };
    const mockTeamDAO = {
        getAllTeams: jest.fn(),
    };
    const testDraftPick = DraftPickFactory.getPick();
    const draftPickController = new DraftPickController(
        mockDraftPickDAO as unknown as DraftPickDAO, mockTeamDAO as unknown as TeamDAO);

    afterEach(() => {
        [mockDraftPickDAO, mockTeamDAO].map(mockedThing =>
            Object.entries(mockedThing).forEach((kvp: [string, jest.Mock<any, any>]) => {
            kvp[1].mockClear();
        }));
        mockedCsvParser.mockClear();
    });

    describe("getAllDraftPicks method", () => {
        it("should return an array of draftPicks if no params is passed", async () => {
            mockDraftPickDAO.getAllPicks.mockReturnValueOnce([testDraftPick]);
            const res = await draftPickController.getAllDraftPicks();

            expect(mockDraftPickDAO.findPicks).toHaveBeenCalledTimes(0);
            expect(mockDraftPickDAO.getAllPicks).toHaveBeenCalledTimes(1);
            expect(mockDraftPickDAO.getAllPicks).toHaveBeenCalledWith();
            expect(res).toEqual([testDraftPick]);
        });
        it("should return an array of draftPicks if a param is passed and call the find method", async () => {
            mockDraftPickDAO.findPicks.mockReturnValueOnce([testDraftPick]);
            const res = await draftPickController.getAllDraftPicks(["high", "majors"]);

            expect(mockDraftPickDAO.getAllPicks).toHaveBeenCalledTimes(0);
            expect(mockDraftPickDAO.findPicks).toHaveBeenCalledTimes(1);
            expect(mockDraftPickDAO.findPicks).toHaveBeenCalledWith([
                {type: LeagueLevel.HIGH},
                {type: LeagueLevel.MAJOR}]);
            expect(res).toEqual([testDraftPick]);
        });
        it("should bubble up any errors from the DAO", async () => {
            mockDraftPickDAO.getAllPicks.mockImplementation(() => {
                throw new Error("Generic Error");
            });
            await expect(draftPickController.getAllDraftPicks())
                .rejects.toThrow(Error);
        });
    });

    describe("getOneDraftPick method", () => {
        it("should return a draftPick by id", async () => {
            mockDraftPickDAO.getPickById.mockReturnValue(testDraftPick);
            const res = await draftPickController.getOneDraftPick(testDraftPick.id!);

            expect(mockDraftPickDAO.getPickById).toHaveBeenCalledTimes(1);
            expect(mockDraftPickDAO.getPickById).toHaveBeenCalledWith(testDraftPick.id);
            expect(res).toEqual(testDraftPick);
        });
        it("should throw an error if entity is not found in db", async () => {
            mockDraftPickDAO.getPickById.mockImplementation(() => {
                throw new EntityNotFoundError(DraftPick, "ID not found.");
            });
            await expect(draftPickController.getOneDraftPick(9999))
                .rejects.toThrow(EntityNotFoundError);
        });
    });

    describe("findDraftPicksByQuery method", () => {
        const query = {season: 2018};
        it("should find draftPicks by the given query options", async () => {
            mockDraftPickDAO.findPicks.mockReturnValue([testDraftPick]);
            const res = await draftPickController.findDraftPicksByQuery(query);

            expect(mockDraftPickDAO.findPicks).toHaveBeenCalledTimes(1);
            expect(mockDraftPickDAO.findPicks).toHaveBeenCalledWith(query);
            expect(res).toEqual([testDraftPick]);
        });
        it("should throw an error if entity is not found in db", async () => {
            mockDraftPickDAO.findPicks.mockImplementation(() => {
                throw new EntityNotFoundError(DraftPick, "ID not found.");
            });
            await expect(draftPickController.findDraftPicksByQuery(query)).rejects.toThrow(EntityNotFoundError);
        });
    });

    describe("createDraftPick method", () => {
        it("should create a draftPick", async () => {
            mockDraftPickDAO.createPick.mockReturnValue(testDraftPick);
            const res = await draftPickController.createDraftPick(testDraftPick.parse());

            expect(mockDraftPickDAO.createPick).toHaveBeenCalledTimes(1);
            expect(mockDraftPickDAO.createPick).toHaveBeenCalledWith(testDraftPick.parse());
            expect(res).toEqual(testDraftPick);
        });
        it("should bubble up any errors from the DAO", async () => {
            mockDraftPickDAO.createPick.mockImplementation(() => {
                throw new Error("Generic Error");
            });
            await expect(draftPickController.createDraftPick(testDraftPick.parse()))
                .rejects.toThrow(Error);
        });
    });

    describe("updateDraftPick method", () => {
        it("should return updated draftPick with the given id", async () => {
            mockDraftPickDAO.updatePick.mockReturnValue(testDraftPick);
            const res = await draftPickController.updateDraftPick(testDraftPick.id!, testDraftPick.parse());

            expect(mockDraftPickDAO.updatePick).toHaveBeenCalledTimes(1);
            expect(mockDraftPickDAO.updatePick).toHaveBeenCalledWith(testDraftPick.id, testDraftPick.parse());
            expect(res).toEqual(testDraftPick);
        });
        it("should throw an error if entity is not found in db", async () => {
            mockDraftPickDAO.updatePick.mockImplementation(() => {
                throw new EntityNotFoundError(DraftPick, "ID not found.");
            });
            await expect(draftPickController.updateDraftPick(9999, testDraftPick.parse()))
                .rejects.toThrow(EntityNotFoundError);
        });
    });

    describe("deleteDraftPick method", () => {
        it("should delete a draftPick by id from the db", async () => {
            mockDraftPickDAO.deletePick.mockReturnValue({raw: [{id: testDraftPick.id}], affected: 1});
            const res = await draftPickController.deleteDraftPick(testDraftPick.id!);

            expect(mockDraftPickDAO.deletePick).toHaveBeenCalledTimes(1);
            expect(mockDraftPickDAO.deletePick).toHaveBeenCalledWith(testDraftPick.id);
            expect(res).toEqual({deleteCount: 1, id: testDraftPick.id});
        });
        it("should throw an error if entity is not found in db", async () => {
            mockDraftPickDAO.deletePick.mockImplementation(() => {
                throw new EntityNotFoundError(DraftPick, "ID not found.");
            });
            await expect(draftPickController.deleteDraftPick(9999))
                .rejects.toThrow(EntityNotFoundError);
        });
    });

    describe("batchUploadDraftPicks method", () => {
        const overwriteMode = "overwrite";
        const testFile = {path: "/test/path/to.csv"};

        it("should get all existing users from the db", async () => {
            await draftPickController.batchUploadDraftPicks(testFile, overwriteMode);
            expect(mockTeamDAO.getAllTeams).toHaveBeenCalledTimes(1);
            expect(mockTeamDAO.getAllTeams).toHaveBeenCalledWith();
        });
        it("should call the draft pick processor method", async () => {
            const users = [new User({shortName: "Akos"})];
            mockTeamDAO.getAllTeams.mockResolvedValueOnce(users);
            await draftPickController.batchUploadDraftPicks(testFile, overwriteMode);
            expect(mockedCsvParser).toHaveBeenCalledTimes(1);
            expect(mockedCsvParser).toHaveBeenCalledWith(testFile.path, users, mockDraftPickDAO, overwriteMode);
        });
        it("should call the return an array of draft picks", async () => {
            const picks = [DraftPickFactory.getPick(undefined, undefined, LeagueLevel.HIGH)];
            mockedCsvParser.mockResolvedValueOnce(picks);
            const res = await draftPickController.batchUploadDraftPicks(testFile, overwriteMode);
            expect(res).toEqual(picks);
        });
        it("should reject if userDAO throws an error", async () => {
            mockTeamDAO.getAllTeams.mockImplementationOnce(() => {
                throw new Error();
            });
            await expect(draftPickController.batchUploadDraftPicks(testFile, overwriteMode)).rejects.toThrow(Error);
        });
        it("should reject if processDraftPickCsv throws an error", async () => {
            mockedCsvParser.mockImplementationOnce(() => {
                throw new Error();
            });
            await expect(draftPickController.batchUploadDraftPicks(testFile, overwriteMode)).rejects.toThrow(Error);
        });
    });
});
