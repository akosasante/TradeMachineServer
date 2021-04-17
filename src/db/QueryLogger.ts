import { Logger, QueryRunner } from "typeorm";
import winston from "winston";
import { rollbar } from "../bootstrap/rollbar";

export default class CustomQueryLogger implements Logger {
    constructor(private winstonLogger: winston.Logger) {
    }

    public sqlString(query: string, parameters?: any[]) {
        return `${query};
        ${parameters && parameters.length ? ` -- PARAMETERS: ${parameters}` : ""}`;
    }

    /**
     * Logs query and parameters used in it.
     */
    public logQuery(query: string, parameters?: any[], queryRunner?: QueryRunner): void {
        const sql = this.sqlString(query, parameters);
        this.winstonLogger.info(`QUERY: ${sql}`);
    }

    /**
     * Logs query that is failed.
     */
    public logQueryError(error: string, query: string, parameters?: any[], queryRunner?: QueryRunner): void {
        const sql = this.sqlString(query, parameters);
        this.winstonLogger.info(`QUERY FAILED: ${sql}`);
        this.winstonLogger.error(`QUERY ERROR: ${error}`);
        rollbar.error("Query failed", {sql, error});
    }

    /**
     * Logs query that is slow.
     */
    public logQuerySlow(time: number, query: string, parameters?: any[], queryRunner?: QueryRunner): void {
        const sql = this.sqlString(query, parameters);
        this.winstonLogger.info(`SLOW QUERY: ${sql}`);
        this.winstonLogger.error(`SLOW QUERY EXECUTION TIME: ${time}`);
        rollbar.error("Slow query", {sql, parameters, time});
    }

    /**
     * Logs events from the schema build process.
     */
    public logSchemaBuild(message: string, queryRunner?: QueryRunner): void {
        this.winstonLogger.info(`SCHEMA BUILD MESSAGE: ${message}`);
    }

    /**
     * Logs events from the migrations run process.
     */
    public logMigration(message: string, queryRunner?: QueryRunner): void {
        this.winstonLogger.debug(`MIGRATION MESSAGE: ${message}`);
    }

    /**
     * Perform logging using given logger, or by default to the console.
     * Log has its own level and message.
     */
    public log(level: "log" | "info" | "warn", message: any, queryRunner?: QueryRunner): void {
        const winstonLevel: "debug" | "info" | "warn" = level === "log" ? "debug" : level;
        this.winstonLogger.log(winstonLevel, message);
    }
}
