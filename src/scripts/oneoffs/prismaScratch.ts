/* eslint-disable */

import initializeDb from "../../bootstrap/prisma-db";
import initializePrisma from "../../bootstrap/prisma-db";
import logger from "../../bootstrap/logger";

const prisma = initializeDb(true);

async function main() {
    // const schema = "dev";
    // const tableNames = await prisma.$queryRaw<
    //     { tablename: string }[]
    // >`SELECT tablename FROM pg_tables WHERE schemaname=${schema}`;
    // console.log(tableNames);

    const prisma = initializePrisma(true);
    const playerDb = prisma.player;

    const allPlayers = await playerDb.findMany({ orderBy: { id: "desc" } });
    console.dir(allPlayers);

    const query = convertParamsToQuery(["league.MINORS", "name.Franklin Perez"]);
    const minorsOnly = await playerDb.findMany({
        where: {
            AND: query,
        },
    });
    console.dir(minorsOnly);
}

function convertParamsToQuery(params: string[]): { [field: string]: string }[] {
    return params.map(paramStr => {
        const [field, value] = paramStr.split(".");
        return { [field]: value };
    });
}

main()
    .then(async () => {
        await prisma.$disconnect();
    })
    .catch(async e => {
        console.error(e);
        await prisma.$disconnect();
        process.exit(1);
    });

/* eslint-enable */
