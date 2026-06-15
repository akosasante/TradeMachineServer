import DraftPick, { LeagueLevel } from "../../src/models/draftPick";
import { Prisma, PickLeagueLevel } from "@prisma/client";
import type { DraftPickWithTeams } from "../../src/DAO/v2/DraftPickDAO";
import { v4 as uuid } from "uuid";
import { TeamFactory } from "./TeamFactory";
import Team from "../../src/models/team";

export class DraftPickFactory {
    public static getPickObject(
        round = 1,
        pickNumber = 12,
        type = LeagueLevel.LOW,
        season = 2020,
        originalOwner = TeamFactory.getTeam(),
        rest = {}
    ): { round: number; pickNumber: number; type: LeagueLevel; season: number; originalOwner: Team; id: string } {
        return { round, pickNumber, type, season, originalOwner, id: uuid(), ...rest };
    }

    public static getPick(
        round = 1,
        pickNumber = 12,
        type = LeagueLevel.LOW,
        season = 2020,
        originalOwner = TeamFactory.getTeam(),
        rest = {}
    ): DraftPick {
        return new DraftPick(DraftPickFactory.getPickObject(round, pickNumber, type, season, originalOwner, rest));
    }

    /** A pick hydrated with owner teams, matching `DraftPickDAO`'s `DraftPickWithTeams` return shape. */
    public static getPrismaPickWithTeams(overrides: Partial<DraftPickWithTeams> = {}): DraftPickWithTeams {
        return {
            id: uuid(),
            round: new Prisma.Decimal(1),
            season: 2026,
            type: PickLeagueLevel.MAJORS,
            pickNumber: null,
            currentOwnerId: null,
            originalOwnerId: null,
            currentOwner: null,
            originalOwner: null,
            lastSyncedAt: null,
            dateCreated: new Date(),
            dateModified: new Date(),
            ...overrides,
        } as unknown as DraftPickWithTeams;
    }
}
