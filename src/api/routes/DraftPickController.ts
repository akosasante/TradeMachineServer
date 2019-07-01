import { Response } from "express";
import csv from "fast-csv";
import * as fs from "fs";
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
import { EntityNotFoundError } from "typeorm/error/EntityNotFoundError";
import { inspect } from "util";
import logger from "../../bootstrap/logger";
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
    @Post("/batch/minors")
    public async batchCreateMinors(@UploadedFile("minorPlayers", {required: false, options: uploadOpts}) file: any,
                                   @Res() response: Response): Promise<Response> {
        const self = this;
        let accumulatedRows: any = []; /* { Owner: 'Nick', Round: '19', 'Pick Owner': 'Nick', Type: 'Major' }*/
        let results: any = [];

        function validateRow(row: any) {
            logger.debug("validating row");
            const requiredProps = ["Round", "Pick Owner", "Type", "Owner"];
            return requiredProps.every(prop => Object.keys(row).includes(prop));
        }

        function prepareForBatchAdd(row: any) {
            logger.debug("processing row");
            const keywordToLevelMap: {[key: string]: LeagueLevel} = {
                High: LeagueLevel.HIGH,
                Low: LeagueLevel.LOW,
                Major: LeagueLevel.MAJOR,
            };
            const validRow = validateRow(row);
            if (validRow) {
                accumulatedRows.push({round: row.Round,
                    type: keywordToLevelMap[row.Type], currentOwner: row.Owner, originalOwner: row["Pick Owner"]});
            }
        }

        async function pushToResults() {
            logger.debug("getting rows with valid owners");
            logger.debug(`before: ${accumulatedRows.length}`);
            logger.debug(`example: ${accumulatedRows[0]}`);
            let rowsWithOwners = accumulatedRows.map(async (row: any) => {
                try {
                    row.currentOwner = await self.userDAO.findUser({shortName: row.currentOwner});
                    row.originalOwner = await self.userDAO.findUser({shortName: row.originalOwner});
                    return row;
                } catch (e) {
                    if (e instanceof EntityNotFoundError) {
                        logger.error("No entity found");
                    } else {
                        throw e;
                    }
                }
            });
            logger.debug(`owners fetched: ${rowsWithOwners.length}`);
            logger.debug(`example: ${rowsWithOwners[0]}`);

            return Promise.all(rowsWithOwners).then(async rows => {
                logger.debug(inspect(rowsWithOwners));
                rowsWithOwners = rows.filter((draftPickObj: Partial<DraftPick>) =>
                    draftPickObj && draftPickObj.currentOwner && draftPickObj.originalOwner);
                logger.debug(`owners filtered: ${rowsWithOwners.length}`);
                logger.debug(`example: ${rowsWithOwners[0]}`);

                logger.debug("sending to batch create");
                const res = await self.dao.batchCreatePicks(rowsWithOwners);
                results = results.concat(res);
                logger.debug("final length: " + results.length);
                accumulatedRows = [];
                return results;
            });
        }

        return new Promise((resolve, reject) => {
            const readable = fs.createReadStream(file.path);
            readable
                .pipe(csv.parse({headers: true}))
                .on("data", (row: any) => {
                    logger.debug("------got a row--------");
                    readable.pause();
                    prepareForBatchAdd(row);
                    logger.debug("prep complete, continuing");
                    readable.resume();
                })
                .on("error", e => reject(e))
                .on("end", () => {
                    logger.debug("~~~~~~reached end ~~~~~~~~~");
                    pushToResults().then(res => {
                        logger.debug("!!done!!");
                        resolve(response.status(200).json(res));
                    });
                });
        });
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
