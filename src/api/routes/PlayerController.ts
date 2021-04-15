import {
    Authorized, Body, Delete, Get, JsonController, NotFoundError, Param,
    Post, Put, QueryParam, QueryParams, UploadedFile
} from "routing-controllers";
import { inspect } from "util";
import logger from "../../bootstrap/logger";
import { WriteMode } from "../../csv/CsvUtils";
import { processMinorLeagueCsv } from "../../csv/PlayerParser";
import PlayerDAO from "../../DAO/PlayerDAO";
import TeamDAO from "../../DAO/TeamDAO";
import Player, { PlayerLeagueType } from "../../models/player";
import { Role } from "../../models/user";
import { cleanupQuery, fileUploadOptions as uploadOpts, UUIDPattern } from "../helpers/ApiHelpers";
import { rollbar } from "../../bootstrap/rollbar";

@JsonController("/players")
export default class PlayerController {
    private readonly dao: PlayerDAO;
    private teamDAO: TeamDAO;

    constructor(DAO?: PlayerDAO, TeamDao?: TeamDAO) {
        this.dao = DAO || new PlayerDAO();
        this.teamDAO = TeamDao || new TeamDAO();
    }

    @Get("/")
    public async getAllPlayers(@QueryParam("include") include?: string[]): Promise<Player[]> {
        rollbar.info("getAllPlayers", { include });
        logger.debug("get all players endpoint" + `${include ? " with params: " + include : ""}`);
        let players: Player[] = [];
        if (include) {
            const params = getAllPlayersQuery(include);
            players = (await this.dao.findPlayers(params)) || players;
        } else {
            players = (await this.dao.getAllPlayers()) || players;
        }
        logger.debug(`got ${players.length} players`);
        return players;
    }

    @Get(UUIDPattern)
    public async getOnePlayer(@Param("id") id: string): Promise<Player> {
        logger.debug("get one player endpoint");
        rollbar.info("getOnePlayer", { id });
        return await this.dao.getPlayerById(id);
    }

    @Get("/search")
    public async findPlayersByQuery(@QueryParams() query: Partial<Player>): Promise<Player[]> {
        logger.debug(`searching for player with props: ${inspect(query)}`);
        rollbar.info("findPlayersByQuery", { query });
        const players = await this.dao.findPlayers(cleanupQuery(query as {[key: string]: string}));
        if (players.length) {
            return players;
        } else {
            throw new NotFoundError("No players found matching that query");
        }
    }

    @Get("/search_by_name")
    public async findPlayersByName(@QueryParam("name") partialName: string, @QueryParam("league") leagueId?: number): Promise<Player[]> {
        logger.debug(`searching for players with names that contain: ${partialName} in league ${leagueId}`);
        rollbar.info("findPlayersByName", { partialName, leagueId });

        return await this.dao.queryPlayersByName(partialName, leagueId);
    }

    @Post("/")
    public async createPlayers(@Body() playerObj: Partial<Player>[]): Promise<Player[]> {
        logger.debug("create player endpoint");
        rollbar.info("createPlayers", { playerObj });
        return await this.dao.createPlayers(playerObj);
    }

    @Authorized(Role.ADMIN)
    @Post("/batch")
    public async batchUploadMinorLeaguePlayers(@UploadedFile("minors", {required: true, options: uploadOpts}) file: any,
                                               @QueryParam("mode") mode: WriteMode): Promise<Player[]> {
        logger.debug("batch add minor league players endpoint");
        rollbar.info("batchUploadMinorLeaguePlayers");
        const teams = await this.teamDAO.getAllTeams();
        return await processMinorLeagueCsv(file.path, teams, this.dao, mode);
    }

    @Authorized(Role.ADMIN)
    @Put(UUIDPattern)
    public async updatePlayer(@Param("id") id: string, @Body() playerObj: Partial<Player>): Promise<Player> {
        logger.debug("update player endpoint");
        rollbar.info("updatePlayer", { id, playerObj });
        return await this.dao.updatePlayer(id, playerObj);
    }

    @Authorized(Role.ADMIN)
    @Delete(UUIDPattern)
    public async deletePlayer(@Param("id") id: string) {
        rollbar.info("deletePlayer", { id });
        logger.debug("delete player endpoint");
        const result = await this.dao.deletePlayer(id);
        logger.debug(`delete successful: ${inspect(result)}`);
        return {deleteCount: result.affected, id: result.raw[0].id};
    }
}

function getAllPlayersQuery(includes: string[]) {
    const keywordToLevelMap: {[key: string]: PlayerLeagueType} = {
        minors: PlayerLeagueType.MINOR,
        majors: PlayerLeagueType.MAJOR,
    };
    return includes.map(include => ({ league: keywordToLevelMap[include] }));
}
