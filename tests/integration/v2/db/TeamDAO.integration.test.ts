import { clearPrismaDb } from "../../helpers";
import initializeDb, { ExtendedPrismaClient } from "../../../../src/bootstrap/prisma-db";
import TeamDAO from "../../../../src/DAO/v2/TeamDAO";

let prisma: ExtendedPrismaClient;
let teamDao: TeamDAO;

beforeAll(() => {
    prisma = initializeDb(process.env.DB_LOGS === "true");
    teamDao = new TeamDAO(prisma.team);
});

afterAll(async () => {
    await prisma.$disconnect();
});

afterEach(async () => {
    await clearPrismaDb(prisma);
});

describe("integration/ TeamDAO.searchTeams", () => {
    it("integration/ returns teams matching by name (case-insensitive)", async () => {
        await prisma.team.create({ data: { name: "Alpha Wolves", status: "ACTIVE" } });
        await prisma.team.create({ data: { name: "Beta Bears", status: "ACTIVE" } });

        const results = await teamDao.searchTeams({ q: "Alpha" });

        expect(results).toHaveLength(1);
        expect(results[0].name).toBe("Alpha Wolves");
    });

    it("integration/ returns teams matching by owner csvName", async () => {
        const team = await prisma.team.create({ data: { name: "Zeta FC", status: "ACTIVE" } });
        await prisma.user.create({
            data: { email: "zetaowner@test.com", role: "OWNER", teamId: team.id, csvName: "ZFC" },
        });
        // Another team with no owner csvName match
        await prisma.team.create({ data: { name: "Other Team", status: "ACTIVE" } });

        const results = await teamDao.searchTeams({ q: "ZFC" });

        expect(results).toHaveLength(1);
        expect(results[0].name).toBe("Zeta FC");
    });

    it("integration/ excludeTeamIds excludes specified team from results", async () => {
        const teamA = await prisma.team.create({ data: { name: "Team Alpha", status: "ACTIVE" } });
        const teamB = await prisma.team.create({ data: { name: "Team Beta", status: "ACTIVE" } });
        const teamC = await prisma.team.create({ data: { name: "Team Charlie", status: "ACTIVE" } });

        const results = await teamDao.searchTeams({ q: "Team", excludeTeamIds: [teamB.id] });

        const resultIds = results.map(t => t.id);
        expect(resultIds).toContain(teamA.id);
        expect(resultIds).not.toContain(teamB.id);
        expect(resultIds).toContain(teamC.id);
    });

    it("integration/ OR logic matches by name OR owner csvName", async () => {
        // Team matched by name
        await prisma.team.create({ data: { name: "CSV123 Name", status: "ACTIVE" } });
        // Team matched by owner csvName
        const teamCsv = await prisma.team.create({ data: { name: "Csv Match", status: "ACTIVE" } });
        await prisma.user.create({
            data: { email: "csvowner@test.com", role: "OWNER", teamId: teamCsv.id, csvName: "CSV123" },
        });

        const results = await teamDao.searchTeams({ q: "CSV123" });

        expect(results).toHaveLength(2);
        const names = results.map(t => t.name);
        expect(names).toContain("CSV123 Name");
        expect(names).toContain("Csv Match");
    });
});
