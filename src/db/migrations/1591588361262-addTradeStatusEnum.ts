import {MigrationInterface, QueryRunner} from "typeorm";

export class addTradeStatusEnum1591588361262 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`CREATE TYPE "dev"."trade_status_enum" AS ENUM('0', '1', '2', '3', '4')`);
        await queryRunner.query(`ALTER TABLE "dev"."trade" ADD COLUMN "status" "dev"."trade_status_enum" NOT NULL DEFAULT '0'`);
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`ALTER TABLE "dev"."trade" DROP COLUMN "status"`);
        await queryRunner.query(`DROP TYPE "dev"."trade_status_enum"`);
    }
}
