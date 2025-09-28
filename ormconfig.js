const commonOpts = {
    type: "postgres",
    host: "localhost",
    port: 5432,
    synchronize: false,
    entities: process.env.NODE_ENV === "development"
        ? [`${process.env.BASE_DIR}/src/models/**/*.ts`]
        : [`${process.env.BASE_DIR}/dist/models/**/*.js`],
    migrations: process.env.NODE_ENV === "development"
        ? [`${process.env.BASE_DIR}/src/db/migrations/**/*.ts`]
        : [`${process.env.BASE_DIR}/dist/db/migrations/**/*.js`],
    subscribers: process.env.NODE_ENV === "development"
        ? [`${process.env.BASE_DIR}/src/db/subscribers/**/*.ts`]
        : [`${process.env.BASE_DIR}/dist/db/subscribers/**/*.js`],
    cli: {
        entitiesDir: "src/models",
        migrationsDir: "src/db/migrations",
        subscribersDir: "src/db/subscribers",
    },
    username: process.env.PG_USER,
    password: process.env.PG_PASSWORD,
    database: process.env.PG_DB,
    cache: true
};

module.exports = [
    {
        ...commonOpts,
        name: "development",
        schema: "dev",
        host: process.env.PG_HOST || "localhost",
        port: parseInt(process.env.PG_PORT || "5438", 10),
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
        maxQueryExecutionTime: 500, // lets us log slow queries (over 0.5 sec to execute)
        connectTimeoutMS: 6000, // not sure if this works/does anything
        extra: {
            connectionTimeoutMillis: 5000, // return an error after 1 second if connection could not be established, makes it clear in test timeouts what the issue is
            idleTimeoutMillis: 750, // close connections after idle 0.75sec
            max: 50 // in tests, we're running a lot of queries/sessions/connections. Default pool size is 10.
        }
    },
    {
        ...commonOpts,
        name: "local-test",
        port: 5438,
        schema: "test",
        synchronize: false,
        dropSchema: false,
        maxQueryExecutionTime: 500, // lets us log slow queries (over 0.5 sec to execute)
        connectTimeoutMS: 2000, // not sure if this works/does anything
        extra: {
            connectionTimeoutMillis: 1000, // return an error after 1 second if connection could not be established, makes it clear in test timeouts what the issue is
            idleTimeoutMillis: 750, // close connections after idle 0.75sec
            max: 50 // in tests, we're running a lot of queries/sessions/connections. Default pool size is 10.
        }
    },
    {
        ...commonOpts,
        name: "production",
        schema: "public",
        cli: {
            entitiesDir: "dist/models",
            migrationsDir: "dist/db/migrations",
            subscribersDir: "dist/db/subscribers",
        },
        maxQueryExecutionTime: 500, // lets us log slow queries (over 0.5 sec to execute)
    },
    {
        ...commonOpts,
        name: "tunnel-production",
        port: 5439,
        schema: "public",
        cli: {
            entitiesDir: "dist/models",
            migrationsDir: "dist/db/migrations",
            subscribersDir: "dist/db/subscribers",
        },
        maxQueryExecutionTime: 500, // lets us log slow queries (over 0.5 sec to execute)
    },
    {
        ...commonOpts,
        name: "staging",
        schema: "staging",
        cli: {
            entitiesDir: "dist/models",
            migrationsDir: "dist/db/migrations",
            subscribersDir: "dist/db/subscribers",
        },
        maxQueryExecutionTime: 500, // lets us log slow queries (over 0.5 sec to execute)
    },
    {
        ...commonOpts,
        name: "local-staging",
        port: 5438,
        schema: "staging",
        cli: {
            entitiesDir: "dist/models",
            migrationsDir: "dist/db/migrations",
            subscribersDir: "dist/db/subscribers",
        },
        maxQueryExecutionTime: 500, // lets us log slow queries (over 0.5 sec to execute)
    },
    {
        ...commonOpts,
        name: "tunnel-staging",
        port: 5439,
        schema: "staging",
        cli: {
            entitiesDir: "dist/models",
            migrationsDir: "dist/db/migrations",
            subscribersDir: "dist/db/subscribers",
        },
        maxQueryExecutionTime: 500, // lets us log slow queries (over 0.5 sec to execute)
    },
];