import { Get, JsonController, QueryParam, Req } from "routing-controllers";
import Players from "../../../DAO/v2/PlayerDAO";
import { Player } from "@prisma/client";
import logger from "../../../bootstrap/logger";
import { rollbar } from "../../../bootstrap/rollbar";
import { inspect } from "util";
import { Request } from "express";
import { getPrismaClientFromRequest } from "../../../bootstrap/prisma-db";

@JsonController("/v2/players")
export default class V2PlayerController {
    private daoInstance: Players | undefined;

    private dao(req: Request | undefined) {
        if (this.daoInstance) {
            return this.daoInstance;
        } else if (!req) {
            throw new Error("HTTP request object required!");
        } else {
            const prisma = getPrismaClientFromRequest(req);
            if (!prisma) {
                throw new Error("Prisma client not found in express app settings!");
            }
            this.daoInstance = new Players(prisma.player);
            return this.daoInstance;
        }
    }

    constructor(daoInstance?: Players) {
        this.daoInstance = daoInstance;
    }

    @Get("/")
    public async getAll(@QueryParam("where") whereParams?: string[], @Req() req?: Request): Promise<Player[]> {
        rollbar.info("getAllPlayers", { whereParams }, req);
        logger.debug("get all players endpoint" + `${whereParams ? ` with params: ${inspect(whereParams)}` : ""}`);

        let players: Player[] = [];
        if (whereParams?.length) {
            players = await this.dao(req).findPlayers(whereParams);
        } else {
            players = await this.dao(req).getAllPlayers();
        }

        logger.debug(`got ${players.length} players`);
        return players;
    }
}
