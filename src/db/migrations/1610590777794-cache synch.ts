import {MigrationInterface, QueryRunner, Table} from "typeorm";

export class cacheSynch1610590777794 implements MigrationInterface {
    name = 'cacheSynch1610590777794'

    cacheTable = new Table({
        name: "query-result-cache",
        columns: [
            {name: "id", type: "serial", isPrimary: true},
            {name: "identifier", type: "varchar"},
            {name: "time", type: "bigint"},
            {name: "duration", type: "int"},
            {name: "query", type: "text"},
            {name: "result", type: "text"},
        ]
    })

    public async up(queryRunner: QueryRunner): Promise<void> {
        // await queryRunner.query(`ALTER TABLE "dev"."trade_item" DROP COLUMN "test"`);
        // await queryRunner.query(`ALTER TABLE "dev"."trade_item" DROP COLUMN "test_uuid"`);
        await queryRunner.createTable(this.cacheTable, true);
        await queryRunner.query(`ALTER TABLE "dev"."${this.cacheTable.name}"
            owner to trader_dev;`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropTable(this.cacheTable);
        // await queryRunner.query(`ALTER TABLE "dev"."trade_item" ADD "test_uuid" uuid NOT NULL DEFAULT uuid_generate_v4()`);
        // await queryRunner.query(`ALTER TABLE "dev"."trade_item" ADD "test" character varying NOT NULL DEFAULT ''`);
    }

}
