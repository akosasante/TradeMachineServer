const { Client } = require('pg')
const client = new Client()

const dbSetup = `CREATE DATABASE trade_machine OWNER ${process.env.PGUSER};`
const uuidSetup = `CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`
const schemaSetup = `CREATE SCHEMA test AUTHORIZATION ${process.env.PGUSER};`

console.log(dbSetup);

client.connect().then(async () => {
  try {
    await client.query(dbSetup);
    await client.query(uuidSetup);
    await client.query(schemaSetup);
  } catch (e) {
    if (e.toString().includes("already exists")) {
      await client.query(uuidSetup);
      await client.query(schemaSetup);
    } else {
      console.error("Failed to setup db")
      throw e
    }
  }
}).finally(async () => {
  await client.end();
})
