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
    UploadedFile
} from "routing-controllers";
import { inspect } from "util";
import logger from "../../bootstrap/logger";
import { WriteMode } from "../../csv/CsvUtils";
import { processMinorLeagueCsv } from "../../csv/PlayerParser";
import PlayerDAO from "../../DAO/PlayerDAO";
import TeamDAO from "../../DAO/TeamDAO";
import Player, { LeagueLevel } from "../../models/player";
import { Role } from "../../models/user";
import { cleanupQuery, fileUploadOptions as uploadOpts } from "../ApiHelpers";

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

    @Get("/:id([0-9]+)")
    public async getOnePlayer(@Param("id") id: number): Promise<Player> {
        logger.debug("get one player endpoint");
        return await this.dao.getPlayerById(id);
    }

    @Get("/search")
    public async findPlayersByQuery(@QueryParams() query: Partial<Player>): Promise<Player[]> {
        logger.debug(`searching for player with props: ${inspect(query)}`);
        return await this.dao.findPlayers(cleanupQuery(query as {[key: string]: string}));
    }

    @Authorized(Role.ADMIN)
    @Post("/")
    public async createPlayer(@Body() playerObj: Partial<Player>): Promise<Player> {
        logger.debug("create player endpoint");
        return await this.dao.createPlayer(playerObj);
    }

    @Authorized(Role.ADMIN)
    @Post("/batch")
    public async batchUploadMinorLeaguePlayers(@UploadedFile("minors", {required: true, options: uploadOpts}) file: any,
                                               @QueryParam("mode") mode: WriteMode): Promise<Player[]> {
        const teams = await this.teamDAO.getAllTeams();
        return await processMinorLeagueCsv(file.path, teams, this.dao, mode);
    }

    @Authorized(Role.ADMIN)
    @Put("/:id([0-9]+)")
    public async updatePlayer(@Param("id") id: number, @Body() playerObj: Partial<Player>): Promise<Player> {
        logger.debug("update player endpoint");
        return await this.dao.updatePlayer(id, playerObj);
    }

    @Authorized(Role.ADMIN)
    @Delete("/:id([0-9]+)")
    public async deletePlayer(@Param("id") id: number) {
        logger.debug("delete player endpoint");
        const result = await this.dao.deletePlayer(id);
        logger.debug(`delete successful: ${inspect(result)}`);
        return await {deleteCount: result.affected, id: result.raw[0].id};
    }
}

function getAllPlayersQuery(includes: string[]) {
    const keywordToLevelMap: {[key: string]: LeagueLevel} = {
        high: LeagueLevel.HIGH,
        low: LeagueLevel.LOW,
        majors: LeagueLevel.MAJOR,
    };
    return includes.map(include => ({ league: keywordToLevelMap[include] }));
}
