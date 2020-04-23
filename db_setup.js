const { Client } = require('pg')
const client = new Client()

const dbSetup = "CREATE DATABASE trade_machine OWNER $1;"
const uuidSetup = `CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`
const schemaSetup = "CREATE SCHEMA test AUTHORIZATION $1;"

client.connect().then(async () => {
  try {
    await client.query(dbSetup, process.env.PG_USER);
    await client.query(uuidSetup);
    await client.query(schemaSetup, process.env.PG_USER);
  } catch (e) {
    console.error(`Failed to setup db: ${e.toString()}`)
    console.error(e.stack);
  }
}).finally(async () => {
  await client.end();
})
