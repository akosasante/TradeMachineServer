import { Player, PlayerLeagueLevel, Prisma } from "@prisma/client";
import { convertParamsToWhereQuery } from "./helpers";
import logger from "../../bootstrap/logger";
import { inspect } from "util";
import { ExtendedPrismaClient } from "../../bootstrap/prisma-db";

export type PlayerWithTeam = Player & {
    ownerTeam: { id: string; name: string } | null;
};

export default class PlayerDAO {
    private readonly playerDb: ExtendedPrismaClient["player"];

    constructor(playerDb: ExtendedPrismaClient["player"] | undefined) {
        if (!playerDb) {
            throw new Error("PlayerDAO must be initialized with a PrismaClient model instance!");
        }
        this.playerDb = playerDb;
    }

    public async getAllPlayers(): Promise<Player[]> {
        return await this.playerDb.findMany({ orderBy: { id: "asc" } });
    }

    public async searchPlayers(opts?: {
        search?: string;
        league?: PlayerLeagueLevel;
        skip?: number;
        take?: number;
    }): Promise<{ players: PlayerWithTeam[]; total: number }> {
        const where: Prisma.PlayerWhereInput = {};
        if (opts?.league) where.league = opts.league;
        if (opts?.search) {
            where.name = { contains: opts.search, mode: "insensitive" };
        }

        const [players, total] = await Promise.all([
            this.playerDb.findMany({
                where,
                orderBy: { name: "asc" },
                skip: opts?.skip ?? 0,
                take: opts?.take ?? 50,
                include: { ownerTeam: { select: { id: true, name: true } } },
            }),
            this.playerDb.count({ where }),
        ]);

        return { players: players as unknown as PlayerWithTeam[], total };
    }

    public async getPlayerById(id: string): Promise<PlayerWithTeam> {
        return (await this.playerDb.findUniqueOrThrow({
            where: { id },
            include: { ownerTeam: { select: { id: true, name: true } } },
        })) as unknown as PlayerWithTeam;
    }

    public async createPlayer(data: {
        name: string;
        league?: PlayerLeagueLevel | null;
        mlbTeam?: string | null;
        playerDataId?: number | null;
        leagueTeamId?: string | null;
    }): Promise<PlayerWithTeam> {
        return (await this.playerDb.create({
            data: {
                name: data.name,
                league: data.league ?? null,
                mlbTeam: data.mlbTeam ?? null,
                playerDataId: data.playerDataId ?? null,
                leagueTeamId: data.leagueTeamId ?? null,
            },
            include: { ownerTeam: { select: { id: true, name: true } } },
        })) as unknown as PlayerWithTeam;
    }

    public async updatePlayer(
        id: string,
        data: {
            name?: string;
            league?: PlayerLeagueLevel | null;
            mlbTeam?: string | null;
            playerDataId?: number | null;
            leagueTeamId?: string | null;
        }
    ): Promise<PlayerWithTeam> {
        return (await this.playerDb.update({
            where: { id },
            data,
            include: { ownerTeam: { select: { id: true, name: true } } },
        })) as unknown as PlayerWithTeam;
    }

    public async deletePlayer(id: string): Promise<Player> {
        return this.playerDb.delete({ where: { id } });
    }

    public async findPlayers(params: string[]): Promise<Player[]> {
        const query = normalizePlayerQuery(convertParamsToWhereQuery(params));
        logger.debug(`finding players with normalized query: ${inspect(query)}`);

        return await this.playerDb.findMany({
            where: {
                AND: query,
            },
            orderBy: { id: "asc" },
        });
    }
}

function normalizePlayerQuery(query: { [field: string]: string }[]): { [field: string]: string }[] {
    return query.reduce((queryAcc: { [field: string]: string }[], kvp: { [field: string]: string }) => {
        const fields = Object.keys(kvp);
        if (fields.length > 1) {
            logger.error("Each query field should only have a single object");
            return [];
        }

        const field = fields[0];
        const currQuery: { [field: string]: string } = {};
        if (field === "meta") {
            // drop any queries for meta since it's a bit more complicated than a straight up where equals
            return queryAcc;
        } else if (field === "league") {
            // Prisma expects league to be "MAJORS" or "MINORS"
            if (["MAJORS", "MINORS"].includes(kvp[field].toUpperCase())) {
                currQuery[field] = kvp[field].toUpperCase();
                return [...queryAcc, currQuery];
            } else if (["MAJOR", "MINOR"].includes(kvp[field].toUpperCase())) {
                currQuery[field] = kvp[field].toUpperCase() + "S";
                return [...queryAcc, currQuery];
            } else if ([1, 2, "1", "2"].includes(kvp[field])) {
                if (kvp[field].toString() === "1") {
                    currQuery[field] = "MAJORS";
                } else if (kvp[field].toString() === "2") {
                    currQuery[field] = "MINORS";
                }
                return [...queryAcc, currQuery];
            } else {
                return [];
            }
        } else {
            currQuery[field] = kvp[field];
            return [...queryAcc, currQuery];
        }
    }, []);
}
