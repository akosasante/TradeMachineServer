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
    QueryParams
} from "routing-controllers";
import { inspect } from "util";
import logger from "../../bootstrap/logger";
import DraftPickDAO from "../../DAO/DraftPickDAO";
import DraftPick from "../../models/draftPick";
import { LeagueLevel } from "../../models/player";
import { Role } from "../../models/user";
import { cleanupQuery } from "../ApiHelpers";

@JsonController("/picks")
export default class DraftPickController {
    private dao: DraftPickDAO;

    constructor(DAO?: DraftPickDAO) {
        this.dao = DAO || new DraftPickDAO();
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
