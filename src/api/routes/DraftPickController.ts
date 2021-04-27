import {
    Authorized,
    Body,
    Delete,
    Get,
    JsonController,
    NotFoundError,
    Param,
    Post,
    Put,
    QueryParam,
    QueryParams,
    UploadedFile,
} from "routing-controllers";
import { inspect } from "util";
import logger from "../../bootstrap/logger";
import { WriteMode } from "../../csv/CsvUtils";
import { processDraftPickCsv } from "../../csv/DraftPickParser";
import DraftPickDAO from "../../DAO/DraftPickDAO";
import TeamDAO from "../../DAO/TeamDAO";
import DraftPick, { LeagueLevel } from "../../models/draftPick";
import { Role } from "../../models/user";
import { cleanupQuery, fileUploadOptions as uploadOpts, UUID_PATTERN } from "../helpers/ApiHelpers";
import { rollbar } from "../../bootstrap/rollbar";

@JsonController("/picks")
export default class DraftPickController {
    private readonly dao: DraftPickDAO;
    private teamDAO: TeamDAO;

    constructor(dao?: DraftPickDAO, teamDAO?: TeamDAO) {
        this.dao = dao || new DraftPickDAO();
        this.teamDAO = teamDAO || new TeamDAO();
    }

    @Get("/")
    public async getAllDraftPicks(
        @QueryParam("include") include?: string[],
        @QueryParam("season") season?: string
    ): Promise<DraftPick[]> {
        logger.debug("get all draftPicks endpoint" + `${include ? ` with params: ${include}` : ""}`);
        rollbar.info("getAllDraftPicks", { include });
        let draftPicks: DraftPick[] = [];
        if (include || season) {
            const params = getAllDraftPicksQuery(include, season);
            draftPicks = (await this.dao.findPicks(params)) || draftPicks;
        } else {
            draftPicks = (await this.dao.getAllPicks()) || draftPicks;
        }
        logger.debug(`got ${draftPicks.length} draftPicks`);
        return draftPicks;
    }

    @Get(UUID_PATTERN)
    public async getOneDraftPick(@Param("id") id: string): Promise<DraftPick> {
        logger.debug("get one draftPick endpoint");
        rollbar.info("getOneDraftPick", { id });
        return await this.dao.getPickById(id);
    }

    @Get("/search")
    public async findDraftPicksByQuery(@QueryParams() query: Partial<DraftPick>): Promise<DraftPick[]> {
        logger.debug(`searching for draftPick with props: ${inspect(query)}`);
        rollbar.info("findDraftPicksByQuery", { query });
        const picks = await this.dao.findPicks(cleanupQuery(query as { [key: string]: string }));
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
        rollbar.info("createDraftPicks", { draftPickObj });
        return await this.dao.createPicks(draftPickObj);
    }

    @Authorized(Role.ADMIN)
    @Post("/batch")
    public async batchUploadDraftPicks(
        @UploadedFile("picks", { required: true, options: uploadOpts }) file: Express.Multer.File,
        @QueryParam("mode") mode: WriteMode
    ): Promise<DraftPick[]> {
        logger.debug("batch add draft picks endpoint");
        rollbar.info("batchUploadDraftPicks");
        const teams = await this.teamDAO.getAllTeams();
        return await processDraftPickCsv(file.path, teams, this.dao, mode);
    }

    @Authorized(Role.ADMIN)
    @Put(UUID_PATTERN)
    public async updateDraftPick(
        @Param("id") id: string,
        @Body() draftPickObj: Partial<DraftPick>
    ): Promise<DraftPick> {
        logger.debug("update draftPick endpoint");
        rollbar.info("updateDraftPick", { id, draftPickObj });
        return await this.dao.updatePick(id, draftPickObj);
    }

    @Authorized(Role.ADMIN)
    @Delete(UUID_PATTERN)
    public async deleteDraftPick(
        @Param("id") id: string
    ): Promise<{ deleteCount: number | null | undefined; id: any }> {
        logger.debug("delete draftPick endpoint");
        rollbar.info("deleteDraftPick", { id });
        const result = await this.dao.deletePick(id);
        logger.debug(`delete successful: ${inspect(result)}`);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unsafe-assignment
        return { deleteCount: result.affected, id: result.raw[0].id };
    }
}

function getAllDraftPicksQuery(includes?: string[], season?: string) {
    if (includes) {
        const keywordToLevelMap: { [key: string]: LeagueLevel } = {
            high: LeagueLevel.HIGH,
            low: LeagueLevel.LOW,
            majors: LeagueLevel.MAJORS,
        };
        return includes.map(include =>
            season
                ? {
                      type: keywordToLevelMap[include],
                      season: parseInt(season, 10),
                  }
                : { type: keywordToLevelMap[include] }
        );
    } else if (season) {
        return { season: parseInt(season, 10) };
    } else {
        return {};
    }
}
