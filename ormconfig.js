const commonOpts = {
    type: "postgres",
    host: "localhost",
    port: 5432,
    synchronize: false,
    entities: [`${process.env.SERVER_ROOT}/dist/models/**/*.js`],
    migrations: [`${process.env.SERVER_ROOT}/dist/db/migrations/**/*.js`],
    subscribers: [`${process.env.SERVER_ROOT}/dist/db/subscribers/**/*.js`],
    cli: {
        entitiesDir: "src/models",
        migrationsDir: "src/db/migrations",
        subscribersDir: "src/db/subscribers"
    }
};

module.exports = [
    {
        ...commonOpts,
        name: process.env.NODE_ENV,
        username: process.env.PG_USER,
        password: process.env.PG_PASSWORD,
        database: process.env.PG_DB,
        schema: "dev"
    }
];
