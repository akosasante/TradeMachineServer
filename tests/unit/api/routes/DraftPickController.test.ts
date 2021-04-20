import { mocked } from "ts-jest/utils";
import { EntityNotFoundError } from "typeorm/error/EntityNotFoundError";
import DraftPickController from "../../../../src/api/routes/DraftPickController";
import { processDraftPickCsv } from "../../../../src/csv/DraftPickParser";
import DraftPickDAO from "../../../../src/DAO/DraftPickDAO";
import TeamDAO from "../../../../src/DAO/TeamDAO";
import DraftPick, { LeagueLevel } from "../../../../src/models/draftPick";
import { DraftPickFactory } from "../../../factories/DraftPickFactory";
import logger from "../../../../src/bootstrap/logger";
import { v4 as uuid } from "uuid";
import { TeamFactory } from "../../../factories/TeamFactory";

jest.mock("../../../../src/csv/DraftPickParser");
const mockedCsvParser = mocked(processDraftPickCsv);

describe("DraftPickController", () => {
    const mockDraftPickDAO = {
        getAllPicks: jest.fn(),
        getPickById: jest.fn(),
        findPicks: jest.fn(),
        createPicks: jest.fn(),
        updatePick: jest.fn(),
        deletePick: jest.fn(),
    };
    const mockTeamDAO = {
        getAllTeams: jest.fn(),
    };
    const testDraftPick = DraftPickFactory.getPick();
    const draftPickController = new DraftPickController(
        (mockDraftPickDAO as unknown) as DraftPickDAO,
        (mockTeamDAO as unknown) as TeamDAO
    );

    afterEach(() => {
        [mockDraftPickDAO, mockTeamDAO].map(mockedThing =>
            Object.values(mockedThing).forEach(mockFn => mockFn.mockReset())
        );
        mockedCsvParser.mockClear();
    });

    beforeAll(() => {
        logger.debug("~~~~~~DRAFT PICK CONTROLLER TESTS BEGIN~~~~~~");
    });
    afterAll(() => {
        logger.debug("~~~~~~DRAFT PICK CONTROLLER TESTS COMPLETE~~~~~~");
    });

    describe("getAllDraftPicks method", () => {
        it("should return an array of draftPicks if no params is passed", async () => {
            mockDraftPickDAO.getAllPicks.mockResolvedValueOnce([testDraftPick]);
            const res = await draftPickController.getAllDraftPicks();

            expect(mockDraftPickDAO.findPicks).toHaveBeenCalledTimes(0);
            expect(mockDraftPickDAO.getAllPicks).toHaveBeenCalledTimes(1);
            expect(mockDraftPickDAO.getAllPicks).toHaveBeenCalledWith();
            expect(res).toEqual([testDraftPick]);
        });
        it("should return an array of draftPicks if a param is passed and call the find method", async () => {
            mockDraftPickDAO.findPicks.mockResolvedValueOnce([testDraftPick]);
            const res = await draftPickController.getAllDraftPicks(["high", "majors"]);

            expect(mockDraftPickDAO.getAllPicks).toHaveBeenCalledTimes(0);
            expect(mockDraftPickDAO.findPicks).toHaveBeenCalledTimes(1);
            expect(mockDraftPickDAO.findPicks).toHaveBeenCalledWith([
                { type: LeagueLevel.HIGH },
                { type: LeagueLevel.MAJORS },
            ]);
            expect(res).toEqual([testDraftPick]);
        });
        it("should bubble up any errors from the DAO", async () => {
            mockDraftPickDAO.getAllPicks.mockImplementation(() => {
                throw new Error("Generic Error");
            });
            await expect(draftPickController.getAllDraftPicks()).rejects.toThrow(Error);
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
            await expect(draftPickController.getOneDraftPick(uuid())).rejects.toThrow(EntityNotFoundError);
        });
    });

    describe("findDraftPicksByQuery method", () => {
        const query = { season: 2018 };
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
            mockDraftPickDAO.createPicks.mockReturnValue(testDraftPick);
            const res = await draftPickController.createDraftPicks([testDraftPick.parse()]);

            expect(mockDraftPickDAO.createPicks).toHaveBeenCalledTimes(1);
            expect(mockDraftPickDAO.createPicks).toHaveBeenCalledWith([testDraftPick.parse()]);
            expect(res).toEqual(testDraftPick);
        });
        it("should bubble up any errors from the DAO", async () => {
            mockDraftPickDAO.createPicks.mockImplementation(() => {
                throw new Error("Generic Error");
            });
            await expect(draftPickController.createDraftPicks([testDraftPick.parse()])).rejects.toThrow(Error);
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
            await expect(draftPickController.updateDraftPick(uuid(), testDraftPick.parse())).rejects.toThrow(
                EntityNotFoundError
            );
        });
    });

    describe("deleteDraftPick method", () => {
        it("should delete a draftPick by id from the db", async () => {
            mockDraftPickDAO.deletePick.mockReturnValue({ raw: [{ id: testDraftPick.id }], affected: 1 });
            const res = await draftPickController.deleteDraftPick(testDraftPick.id!);

            expect(mockDraftPickDAO.deletePick).toHaveBeenCalledTimes(1);
            expect(mockDraftPickDAO.deletePick).toHaveBeenCalledWith(testDraftPick.id);
            expect(res).toEqual({ deleteCount: 1, id: testDraftPick.id });
        });
        it("should throw an error if entity is not found in db", async () => {
            mockDraftPickDAO.deletePick.mockImplementation(() => {
                throw new EntityNotFoundError(DraftPick, "ID not found.");
            });
            await expect(draftPickController.deleteDraftPick(uuid())).rejects.toThrow(EntityNotFoundError);
        });
    });

    describe("batchUploadDraftPicks method", () => {
        const overwriteMode = "overwrite";
        const testFile = { path: "/test/path/to.csv" } as Express.Multer.File;

        it("should get all existing users from the db", async () => {
            await draftPickController.batchUploadDraftPicks(testFile, overwriteMode);
            expect(mockTeamDAO.getAllTeams).toHaveBeenCalledTimes(1);
            expect(mockTeamDAO.getAllTeams).toHaveBeenCalledWith();
        });
        it("should call the draft pick processor method", async () => {
            const teams = [TeamFactory.getTeam()];
            mockTeamDAO.getAllTeams.mockResolvedValueOnce(teams);
            mockedCsvParser.mockResolvedValueOnce([testDraftPick]);

            const res = await draftPickController.batchUploadDraftPicks(testFile, overwriteMode);
            expect(mockedCsvParser).toHaveBeenCalledTimes(1);
            expect(mockedCsvParser).toHaveBeenCalledWith(testFile.path, teams, mockDraftPickDAO, overwriteMode);
            expect(res).toEqual([testDraftPick]);
        });
        it("should reject if teamDAO throws an error", async () => {
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
