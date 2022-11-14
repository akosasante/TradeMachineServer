import initializeDb from "../../bootstrap/prisma-db";

const prisma = initializeDb(true)

async function main() {
    const schema = "test";
    const tableNames = await prisma.$queryRaw<Array<{ tablename: string }>>`SELECT tablename FROM pg_tables WHERE schemaname=${schema}`;
    console.log(tableNames);
}

main()
    .then(async () => {
        await prisma.$disconnect()
    })
    .catch(async (e) => {
        console.error(e)
        await prisma.$disconnect()
        process.exit(1)
    })