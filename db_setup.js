const { Client } = require("pg");
const { execSync } = require("child_process");

const client = new Client();

const uuidSetup = `CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`;
const schemaSetup = `CREATE SCHEMA IF NOT EXISTS test AUTHORIZATION ${process.env.PGUSER};`;

client
    .connect()
    .then(async () => {
        try {
            await client.query(uuidSetup);
            await client.query(schemaSetup);
            console.log("Database schema setup complete");

            // Run Prisma migrations in the test schema
            console.log("Running Prisma migrations...");
            execSync("npx prisma migrate deploy", {
                env: {
                    ...process.env,
                    PGOPTIONS: "-c search_path=test"
                },
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
