const { Client } = require("pg");
const { execSync } = require("child_process");

const client = new Client();

const uuidSetup = `CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`;
// Only create test schema if PG_SCHEMA is set to 'test' (local testing)
const needsTestSchema = process.env.PG_SCHEMA === "test";
const schemaSetup = needsTestSchema
    ? `CREATE SCHEMA IF NOT EXISTS test AUTHORIZATION ${process.env.PGUSER};`
    : null;

client
    .connect()
    .then(async () => {
        try {
            await client.query(uuidSetup);
            if (schemaSetup) {
                await client.query(schemaSetup);
                console.log("Test schema created");
            }
            console.log("Database extensions setup complete");

            // Run Prisma migrations
            console.log("Running Prisma migrations...");
            const migrateEnv = {
                ...process.env
            };
            // Only set search_path if we're using test schema
            if (needsTestSchema) {
                migrateEnv.PGOPTIONS = "-c search_path=test";
            }
            execSync("npx prisma migrate deploy", {
                env: migrateEnv,
                stdio: "inherit"
            });
            console.log("Prisma migrations complete");
        } catch (e) {
            console.error("Failed to setup db");
            throw e;
        }
    })
    .finally(async () => {
        await client.end();
    });
