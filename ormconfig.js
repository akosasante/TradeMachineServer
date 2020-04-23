const commonOpts = {
    type: "postgres",
    host: "localhost",
    port: 5432,
    synchronize: false,
    entities: [`${process.env.BASE_DIR}/dist/models/**/*.js`],
    migrations: [`${process.env.BASE_DIR}/dist/db/migrations/**/*.js`],
    subscribers: [`${process.env.BASE_DIR}/dist/db/subscribers/**/*.js`],
    cli: {
        entitiesDir: "src/models",
        migrationsDir: "src/db/migrations",
        subscribersDir: "src/db/subscribers",
    },
    username: process.env.PG_USER,
    password: process.env.PG_PASSWORD,
    database: process.env.PG_DB,
};

module.exports = [
    {
        ...commonOpts,
        name: "development",
        schema: "dev",
        extra: {
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 10000,
            keepAlive: true,
            max: 8,
            min: 1,
        },
    },
    {
        ...commonOpts,
        name: "test",
        schema: "test",
        synchronize: true,
        dropSchema: true,
    },
    {
        ...commonOpts,
        name: "production",
    },
];
