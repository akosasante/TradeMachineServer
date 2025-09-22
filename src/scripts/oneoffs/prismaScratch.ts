/* eslint-disable */

import initializeDb, { ExtendedPrismaClient } from "../../bootstrap/prisma-db";

const myPrisma = initializeDb(true);

async function main(prisma: ExtendedPrismaClient) {
    const schema = "dev";
    const tableNames = await prisma.$queryRaw<
        { tablename: string }[]
    >`SELECT tablename FROM pg_tables WHERE schemaname=${schema}`;
    console.log(tableNames);

    const allUsers = await prisma.user.findMany({ orderBy: { id: "asc" } });
    console.dir(allUsers);
    for (const user of allUsers) {
        console.log(`User ${user.id} is admin: ${user.isAdmin()}`);
    }

    //
    const playerDb = prisma.player;
    //
    const allPlayers = await playerDb.findMany({ orderBy: { id: "desc" } });
    console.dir(allPlayers);

    const prismaMetrics: string = await (prisma as any).$metrics.prometheus({
        globalLabels: { app: "trade_machine", environment: process.env.APP_ENV || "unknown" },
    });
    console.dir(prismaMetrics);
    //
    // const query = convertParamsToQuery(["league.MINORS", "name.Franklin Perez"]);
    // const minorsOnly = await playerDb.findMany({
    //     where: {
    //         AND: query,
    //     },
    // });
    // console.dir(minorsOnly);
}

function convertParamsToQuery(params: string[]): { [field: string]: string }[] {
    return params.map(paramStr => {
        const [field, value] = paramStr.split(".");
        return { [field]: value };
    });
}

main(myPrisma)
    .catch(async e => {
        console.error(e);
        await myPrisma.$disconnect();
        process.exit(1);
    })
    .finally(async () => {
        await myPrisma.$disconnect();
    });

/* eslint-enable */
