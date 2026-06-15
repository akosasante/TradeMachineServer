import { Prisma, PickLeagueLevel } from "@prisma/client";
import { clearPrismaDb } from "../../helpers";
import initializeDb, { ExtendedPrismaClient } from "../../../../src/bootstrap/prisma-db";
import DraftPickDAO from "../../../../src/DAO/v2/DraftPickDAO";

let prisma: ExtendedPrismaClient;
let pickDao: DraftPickDAO;

beforeAll(() => {
    prisma = initializeDb(process.env.DB_LOGS === "true");
    pickDao = new DraftPickDAO(prisma.draftPick);
});

afterAll(async () => {
    await prisma.$disconnect();
});

afterEach(async () => {
    await clearPrismaDb(prisma);
});

describe("integration/ DraftPickDAO.searchEligiblePicks", () => {
    it("integration/ filters by year (season)", async () => {
        await prisma.draftPick.create({
            data: { round: new Prisma.Decimal(1), season: 2026, type: PickLeagueLevel.MAJORS },
        });
        await prisma.draftPick.create({
            data: { round: new Prisma.Decimal(1), season: 2027, type: PickLeagueLevel.MAJORS },
        });

        const { picks, total } = await pickDao.searchEligiblePicks({ year: 2026 });

        expect(total).toBe(1);
        expect(picks).toHaveLength(1);
        expect(picks[0].season).toBe(2026);
    });

    it("integration/ filters by year + type + round together", async () => {
        await prisma.draftPick.create({
            data: { round: new Prisma.Decimal(1), season: 2026, type: PickLeagueLevel.MAJORS }, // match
        });
        await prisma.draftPick.create({
            data: { round: new Prisma.Decimal(1), season: 2026, type: PickLeagueLevel.LOWMINORS }, // wrong type
        });
        await prisma.draftPick.create({
            data: { round: new Prisma.Decimal(2), season: 2026, type: PickLeagueLevel.MAJORS }, // wrong round
        });

        const { picks, total } = await pickDao.searchEligiblePicks({
            year: 2026,
            type: PickLeagueLevel.MAJORS,
            round: 1,
        });

        expect(total).toBe(1);
        expect(picks).toHaveLength(1);
        expect(picks[0].season).toBe(2026);
        expect(picks[0].type).toBe("MAJORS");
        expect(Number(picks[0].round)).toBe(1);
    });

    it("integration/ filters by currentOwnerId", async () => {
        const team1 = await prisma.team.create({ data: { name: "Pick Owner 1", status: "ACTIVE" } });
        const team2 = await prisma.team.create({ data: { name: "Pick Owner 2", status: "ACTIVE" } });

        await prisma.draftPick.create({
            data: {
                round: new Prisma.Decimal(1),
                season: 2026,
                type: PickLeagueLevel.MAJORS,
                currentOwnerId: team1.id,
            },
        });
        await prisma.draftPick.create({
            data: {
                round: new Prisma.Decimal(1),
                season: 2026,
                type: PickLeagueLevel.MAJORS,
                currentOwnerId: team2.id,
            },
        });

        const { picks, total } = await pickDao.searchEligiblePicks({ currentOwnerId: team1.id });

        expect(total).toBe(1);
        expect(picks[0].currentOwnerId).toBe(team1.id);
    });

    it("integration/ returns empty result when no picks match", async () => {
        await prisma.draftPick.create({
            data: { round: new Prisma.Decimal(1), season: 2026, type: PickLeagueLevel.MAJORS },
        });

        const { picks, total } = await pickDao.searchEligiblePicks({ year: 2099 });

        expect(total).toBe(0);
        expect(picks).toHaveLength(0);
    });

    it("integration/ paginates correctly", async () => {
        for (let i = 1; i <= 5; i++) {
            await prisma.draftPick.create({
                data: { round: new Prisma.Decimal(i), season: 2026, type: PickLeagueLevel.MAJORS },
            });
        }

        const page1 = await pickDao.searchEligiblePicks({ year: 2026, skip: 0, take: 2 });
        expect(page1.total).toBe(5);
        expect(page1.picks).toHaveLength(2);

        const page2 = await pickDao.searchEligiblePicks({ year: 2026, skip: 2, take: 2 });
        expect(page2.total).toBe(5);
        expect(page2.picks).toHaveLength(2);

        // Pages should not overlap
        const page1Ids = page1.picks.map(p => p.id);
        const page2Ids = page2.picks.map(p => p.id);
        const overlap = page1Ids.filter(id => page2Ids.includes(id));
        expect(overlap).toHaveLength(0);
    });
});
