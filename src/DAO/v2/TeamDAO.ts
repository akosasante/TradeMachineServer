import { Prisma, TeamStatus } from "@prisma/client";
import { ExtendedPrismaClient } from "../../bootstrap/prisma-db";

const ownersSelect = {
    select: { id: true, displayName: true, email: true, role: true, status: true, csvName: true },
} as const;

export type TeamWithOwners = Prisma.Result<
    ExtendedPrismaClient["team"],
    { include: { owners: typeof ownersSelect } },
    "findFirstOrThrow"
>;

export default class TeamDAO {
    private readonly teamDb: ExtendedPrismaClient["team"];

    constructor(teamDb: ExtendedPrismaClient["team"] | undefined) {
        if (!teamDb) {
            throw new Error("TeamDAO must be initialized with a PrismaClient model instance!");
        }
        this.teamDb = teamDb;
    }

    public async getAllTeams(): Promise<TeamWithOwners[]> {
        return (await this.teamDb.findMany({
            orderBy: { name: "asc" },
            include: { owners: ownersSelect },
        })) as unknown as TeamWithOwners[];
    }

    public async getTeamById(id: string): Promise<TeamWithOwners> {
        return (await this.teamDb.findUniqueOrThrow({
            where: { id },
            include: { owners: ownersSelect },
        })) as unknown as TeamWithOwners;
    }

    public async createTeam(data: {
        name: string;
        espnId?: number | null;
        status?: TeamStatus;
    }): Promise<TeamWithOwners> {
        return (await this.teamDb.create({
            data: {
                name: data.name,
                espnId: data.espnId ?? null,
                status: data.status ?? TeamStatus.ACTIVE,
            },
            include: { owners: ownersSelect },
        })) as unknown as TeamWithOwners;
    }

    public async updateTeam(
        id: string,
        data: { name?: string; espnId?: number | null; status?: TeamStatus }
    ): Promise<TeamWithOwners> {
        return (await this.teamDb.update({
            where: { id },
            data,
            include: { owners: ownersSelect },
        })) as unknown as TeamWithOwners;
    }

    public async deleteTeam(id: string): Promise<TeamWithOwners> {
        return (await this.teamDb.delete({
            where: { id },
            include: { owners: ownersSelect },
        })) as unknown as TeamWithOwners;
    }
}
