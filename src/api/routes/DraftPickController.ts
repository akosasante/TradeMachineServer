import { Authorized, Body, Delete, Get, JsonController, NotFoundError,
    Param, Post, Put, QueryParam, QueryParams, UploadedFile } from "routing-controllers";
import { inspect } from "util";
import logger from "../../bootstrap/logger";
import { WriteMode } from "../../csv/CsvUtils";
import { processDraftPickCsv } from "../../csv/DraftPickParser";
import DraftPickDAO from "../../DAO/DraftPickDAO";
import TeamDAO from "../../DAO/TeamDAO";
import DraftPick from "../../models/draftPick";
import { LeagueLevel } from "../../models/player";
import { Role } from "../../models/user";
import { cleanupQuery, fileUploadOptions as uploadOpts, UUIDPattern } from "../helpers/ApiHelpers";

@JsonController("/picks")
export default class DraftPickController {
    private dao: DraftPickDAO;
    private teamDAO: TeamDAO;

    constructor(DAO?: DraftPickDAO, teamDAO?: TeamDAO) {
        this.dao = DAO || new DraftPickDAO();
        this.teamDAO = teamDAO || new TeamDAO();
    }

    @Get("/")
    public async getAllDraftPicks(@QueryParam("include") include?: string[]): Promise<DraftPick[]> {
        logger.debug("get all draftPicks endpoint" + `${include ? " with params: " + include : ""}`);
        let draftPicks: DraftPick[] = [];
        if (include) {
            const params = getAllDraftPicksQuery(include);
            draftPicks = (await this.dao.findPicks(params)) || draftPicks;
        } else {
            draftPicks = (await this.dao.getAllPicks()) || draftPicks;
        }
        logger.debug(`got ${draftPicks.length} draftPicks`);
        return draftPicks;
    }

    @Get(UUIDPattern)
    public async getOneDraftPick(@Param("id") id: string): Promise<DraftPick> {
        logger.debug("get one draftPick endpoint");
        return await this.dao.getPickById(id);
    }

    @Get("/search")
    public async findDraftPicksByQuery(@QueryParams() query: Partial<DraftPick>): Promise<DraftPick[]> {
        logger.debug(`searching for draftPick with props: ${inspect(query)}`);
        const picks = await this.dao.findPicks(cleanupQuery(query as {[key: string]: string}));
        if (picks.length) {
            return picks;
        } else {
            throw new NotFoundError("No draft picks found matching that query");
        }
    }

    @Authorized(Role.ADMIN)
    @Post("/")
    public async createDraftPicks(@Body() draftPickObj: Partial<DraftPick>[]): Promise<DraftPick[]> {
        logger.debug("create draft pick endpoint");
        return await this.dao.createPicks(draftPickObj);
    }

    @Authorized(Role.ADMIN)
    @Post("/batch")
    public async batchUploadDraftPicks(@UploadedFile("picks", {required: true, options: uploadOpts}) file: any,
                                       @QueryParam("mode") mode: WriteMode): Promise<DraftPick[]> {
        const teams = await this.teamDAO.getAllTeams();
        return await processDraftPickCsv(file.path, teams, this.dao, mode);
    }

    @Authorized(Role.ADMIN)
    @Put(UUIDPattern)
    public async updateDraftPick(@Param("id") id: string, @Body() draftPickObj: Partial<DraftPick>):
        Promise<DraftPick> {
        logger.debug("update draftPick endpoint");
        return await this.dao.updatePick(id, draftPickObj);
    }

    @Authorized(Role.ADMIN)
    @Delete(UUIDPattern)
    public async deleteDraftPick(@Param("id") id: string) {
        logger.debug("delete draftPick endpoint");
        const result = await this.dao.deletePick(id);
        logger.debug(`delete successful: ${inspect(result)}`);
        return await {deleteCount: result.affected, id: result.raw[0].id};
    }
}

function getAllDraftPicksQuery(includes: string[]) {
    const keywordToLevelMap: {[key: string]: LeagueLevel} = {
        high: LeagueLevel.HIGH,
        low: LeagueLevel.LOW,
        majors: LeagueLevel.MAJOR,
    };
    return includes.map(include => ({ type: keywordToLevelMap[include] }));
}
