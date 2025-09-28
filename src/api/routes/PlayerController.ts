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
    Req,
    UploadedFile
} from "routing-controllers";
import { inspect } from "util";
import logger from "../../bootstrap/logger";
import { WriteMode } from "../../csv/CsvUtils";
import { processMinorLeagueCsv } from "../../csv/PlayerParser";
import PlayerDAO from "../../DAO/PlayerDAO";
import TeamDAO from "../../DAO/TeamDAO";
import Player, { PlayerLeagueType } from "../../models/player";
import { Role } from "../../models/user";
import { cleanupQuery, fileUploadOptions as uploadOpts, UUID_PATTERN } from "../helpers/ApiHelpers";
import { rollbar } from "../../bootstrap/rollbar";
import { Request } from "express";
import { In } from "typeorm";
import { QueryDeepPartialEntity } from "typeorm/query-builder/QueryPartialEntity";

@JsonController("/players")
export default class PlayerController {
    private readonly dao: PlayerDAO;
    private teamDAO: TeamDAO;

    constructor(dao?: PlayerDAO, teamDao?: TeamDAO) {
        this.dao = dao || new PlayerDAO();
        this.teamDAO = teamDao || new TeamDAO();
    }

    @Get("/")
    public async getAllPlayers(@QueryParam("include") include?: string[], @Req() request?: Request): Promise<Player[]> {
        rollbar.info("getAllPlayers", { include }, request);
        logger.debug("get all players endpoint" + `${include ? ` with params: ${inspect(include)}` : ""}`);
        let players: Player[] = [];
        if (include?.length) {
            const params = getAllPlayersQuery(include);
            players = (await this.dao.findPlayers(params)) || players;
        } else {
            players = (await this.dao.getAllPlayers()) || players;
        }
        logger.debug(`got ${players.length} players`);
        return players;
    }

    @Get(UUID_PATTERN)
    public async getOnePlayer(@Param("id") id: string, @Req() request?: Request): Promise<Player> {
        logger.debug("get one player endpoint");
        rollbar.info("getOnePlayer", { playerId: id }, request);
        return await this.dao.getPlayerById(id);
    }

    @Get("/search")
    public async findPlayersByQuery(
        @QueryParams() query: Partial<Player> & { leagueTeamId?: string },
        @Req() request?: Request
    ): Promise<Player[]> {
        logger.debug(`searching for player with props: ${inspect(query)}`);
        rollbar.info("findPlayersByQuery", { query }, request);
        const players = await this.dao.findPlayers(cleanupQuery(query as { [key: string]: string }));
        if (players.length) {
            return players;
        } else {
            throw new NotFoundError("No players found matching that query");
        }
    }

    @Get("/search_by_name")
    public async findPlayersByName(
        @QueryParam("name") partialName: string,
        @QueryParam("league") leagueId?: number,
        @Req() request?: Request
    ): Promise<Player[]> {
        logger.debug(`searching for players with names that contain: ${partialName} in league ${leagueId}`);
        rollbar.info("findPlayersByName", { partialName, leagueId }, request);

        return await this.dao.queryPlayersByName(partialName, leagueId);
    }

    @Post("/")
    public async createPlayers(@Body() playerObj: Partial<Player>[], @Req() request?: Request): Promise<Player[]> {
        logger.debug("create player endpoint");
        rollbar.info("createPlayers", { playerObj }, request);
        return await this.dao.createPlayers(playerObj);
    }

    @Authorized(Role.ADMIN)
    @Post("/batch")
    public async batchUploadMinorLeaguePlayers(
        @UploadedFile("minors", { required: true, options: uploadOpts }) file: Express.Multer.File,
        @QueryParam("mode") mode: WriteMode,
        @Req() request?: Request
    ): Promise<Player[]> {
        logger.debug("batch add minor league players endpoint");
        rollbar.info("batchUploadMinorLeaguePlayers", request);
        const teams = await this.teamDAO.getAllTeams();
        return await processMinorLeagueCsv(file.path, teams, this.dao, mode);
    }

    @Authorized(Role.ADMIN)
    @Put(UUID_PATTERN)
    public async updatePlayer(
        @Param("id") id: string,
        @Body() playerObj: QueryDeepPartialEntity<Player>,
        @Req() request?: Request
    ): Promise<Player> {
        logger.debug("update player endpoint");
        rollbar.info("updatePlayer", { playerId: id, playerObj }, request);
        return await this.dao.updatePlayer(id, playerObj);
    }

    @Authorized(Role.ADMIN)
    @Delete(UUID_PATTERN)
    public async deletePlayer(
        @Param("id") id: string,
        @Req() request?: Request
    ): Promise<{ deleteCount: number | null | undefined; id: any }> {
        rollbar.info("deletePlayer", { playerId: id }, request);
        logger.debug("delete player endpoint");
        const result = await this.dao.deletePlayer(id);
        logger.debug(`delete successful: ${inspect(result)}`);
        return { deleteCount: result.affected, id: result.raw[0].id };
    }
}

function getAllPlayersQuery(includes: string[]) {
    const keywordToLevelMap: { [key: string]: PlayerLeagueType } = {
        minors: PlayerLeagueType.MINOR,
        majors: PlayerLeagueType.MAJOR,
    };

    if (includes.length === 1) {
        return { league: keywordToLevelMap[includes[0]] };
    } else {
        return { league: In(includes.map(include => keywordToLevelMap[include])) };
    }
}
