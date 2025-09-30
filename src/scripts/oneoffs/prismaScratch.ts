/* eslint-disable */

import initializeDb, { ExtendedPrismaClient } from "../../bootstrap/prisma-db";
import ObanDAO from "../../DAO/v2/ObanDAO";

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

    // Test ObanJob integration
    console.log("\n=== Testing ObanJob Integration ===");
    console.log(
        "Available models:",
        Object.keys(prisma).filter(key => !key.startsWith("$") && !key.startsWith("_"))
    );
    console.log("Has obanJob:", "obanJob" in prisma);
    console.log("obanJob type:", typeof prisma.obanJob);

    if (!prisma.obanJob) {
        throw new Error("obanJob model not available in Prisma client");
    }

    // Test ObanDAO initialization
    console.log("Creating ObanDAO...");
    const obanDao = new ObanDAO(prisma.obanJob);
    console.log("ObanDAO created successfully");

    // Test enqueuing a job
    console.log("Testing job enqueueing...");
    const testUserId = "test-user-" + Date.now();
    const job = await obanDao.enqueuePasswordResetEmail(testUserId);

    console.log("Job enqueued successfully:", {
        id: job.id.toString(),
        worker: job.worker,
        queue: job.queue,
        args: job.args,
    });

    // Test retrieving the job
    console.log("Testing job retrieval...");
    const retrievedJob = await obanDao.getJobById(job.id);

    if (retrievedJob) {
        console.log("Job retrieved successfully:", {
            id: retrievedJob.id.toString(),
            state: retrievedJob.state,
        });
    } else {
        console.error("Failed to retrieve job");
    }

    console.log("ObanJob integration test complete!");
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
