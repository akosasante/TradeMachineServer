import { Response } from "express";
import {
    Authorized,
    Body,
    Delete,
    Get,
    JsonController,
    Param,
    Post,
    Put,
    QueryParam,
    QueryParams,
    Res,
    UploadedFile
} from "routing-controllers";
import { inspect } from "util";
import logger from "../../bootstrap/logger";
import { processDraftPickCsv } from "../../csv/DraftPickParser";
import DraftPickDAO from "../../DAO/DraftPickDAO";
import UserDAO from "../../DAO/UserDAO";
import DraftPick from "../../models/draftPick";
import { LeagueLevel } from "../../models/player";
import { Role } from "../../models/user";
import { cleanupQuery, fileUploadOptions as uploadOpts } from "../ApiHelpers";

@JsonController("/picks")
export default class DraftPickController {
    private dao: DraftPickDAO;
    private userDAO: UserDAO;

    constructor(DAO?: DraftPickDAO, userDAO?: UserDAO) {
        this.dao = DAO || new DraftPickDAO();
        this.userDAO = userDAO || new UserDAO();
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

    @Get("/:id([0-9]+)")
    public async getOneDraftPick(@Param("id") id: number): Promise<DraftPick> {
        logger.debug("get one draftPick endpoint");
        return await this.dao.getPickById(id);
    }

    @Get("/search")
    public async findDraftPicksByQuery(@QueryParams() query: Partial<DraftPick>): Promise<DraftPick[]> {
        logger.debug(`searching for draftPick with props: ${inspect(query)}`);
        return await this.dao.findPicks(cleanupQuery(query as {[key: string]: string}));
    }

    @Authorized(Role.ADMIN)
    @Post("/")
    public async createDraftPick(@Body() draftPickObj: Partial<DraftPick>): Promise<DraftPick> {
        logger.debug("create team endpoint");
        return await this.dao.createPick(draftPickObj);
    }

    @Authorized(Role.ADMIN)
    @Post("/batch")
    public async batchUploadDraftPicks(@UploadedFile("picks", {required: false, options: uploadOpts}) file: any,
                                       @Res() response: Response): Promise<Response> {
        try {
            const users = await this.userDAO.getAllUsers();
            const picks = await processDraftPickCsv(file, users);
            return response.status(200).json(picks);
        } catch (e) {
            logger.error(e);
            return response.status(500).json(e);
        }
    }

    @Authorized(Role.ADMIN)
    @Put("/:id([0-9]+)")
    public async updateDraftPick(@Param("id") id: number, @Body() draftPickObj: Partial<DraftPick>):
        Promise<DraftPick> {
        logger.debug("update draftPick endpoint");
        return await this.dao.updatePick(id, draftPickObj);
    }

    @Authorized(Role.ADMIN)
    @Delete("/:id([0-9]+)")
    public async deleteDraftPick(@Param("id") id: number) {
        logger.debug("delete draftPick endpoint");
        const result = await this.dao.deletePick(id);
        logger.debug(`delete successful: ${inspect(result)}`);
        return await {deleteResult: !!result.raw[1], id};
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