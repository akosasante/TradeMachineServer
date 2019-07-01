import "jest";
import "jest-extended";
import { EntityNotFoundError } from "typeorm/error/EntityNotFoundError";
import DraftPickController from "../../../../src/api/routes/DraftPickController";
import DraftPickDAO from "../../../../src/DAO/DraftPickDAO";
import UserDAO from "../../../../src/DAO/UserDAO";
import DraftPick from "../../../../src/models/draftPick";
import { LeagueLevel } from "../../../../src/models/player";

describe("DraftPickController", () => {
    const mockDraftPickDAO = {
        getAllPicks: jest.fn(),
        getPickById: jest.fn(),
        findPicks: jest.fn(),
        createPick: jest.fn(),
        updatePick: jest.fn(),
        deletePick: jest.fn(),
    };
    const mockUserDAO = {};
    const testDraftPick = new DraftPick({id: 1, round: 1, pickNumber: 12, type: LeagueLevel.LOW});
    const draftPickController = new DraftPickController(
        mockDraftPickDAO as unknown as DraftPickDAO, mockUserDAO as unknown as UserDAO);

    afterEach(() => {
        Object.entries(mockDraftPickDAO).forEach((kvp: [string, jest.Mock<any, any>]) => {
            kvp[1].mockClear();
        });
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
            mockDraftPickDAO.deletePick.mockReturnValue({raw: [ [], testDraftPick.id ]});
            const res = await draftPickController.deleteDraftPick(testDraftPick.id!);

            expect(mockDraftPickDAO.deletePick).toHaveBeenCalledTimes(1);
            expect(mockDraftPickDAO.deletePick).toHaveBeenCalledWith(testDraftPick.id);
            expect(res).toEqual({deleteResult: true, id: testDraftPick.id});
        });
        it("should throw an error if entity is not found in db", async () => {
            mockDraftPickDAO.deletePick.mockImplementation(() => {
                throw new EntityNotFoundError(DraftPick, "ID not found.");
            });
            await expect(draftPickController.deleteDraftPick(9999))
                .rejects.toThrow(EntityNotFoundError);
        });
    });
});
