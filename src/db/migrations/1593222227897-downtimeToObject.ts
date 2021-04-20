import {MigrationInterface, QueryRunner} from "typeorm";

export class downtimeToObject1593222227897 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`DROP INDEX "dev"."IDX_40e3ad1d41d05dda60e9ba76ee"`, undefined);
        await queryRunner.query(`ALTER TABLE "dev"."settings" DROP COLUMN "downtimeStartDate", DROP COLUMN "downtimeEndDate", DROP COLUMN "downtimeReason"`, undefined);
        await queryRunner.query(`ALTER TABLE "dev"."settings" ADD COLUMN "downtime" jsonb`)
        await queryRunner.query(`CREATE INDEX "IDX_40e3ad1d41d05dda60e9ba77ee" ON "dev"."settings" ("downtime", "modifiedById") `, undefined);
        await queryRunner.query(`CREATE INDEX "IDX_40e3ad1d41d05dda60e1aa77ee" ON "dev"."settings" ("modifiedById") `, undefined);
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`DROP INDEX "dev"."IDX_40e3ad1d41d05dda60e1aa77ee"`, undefined);
        await queryRunner.query(`DROP INDEX "dev"."IDX_40e3ad1d41d05dda60e9ba77ee"`, undefined);
        await queryRunner.query(`ALTER TABLE "dev"."settings" DROP COLUMN "downtime"`, undefined);
        await queryRunner.query(`ALTER TABLE "dev"."settings" ADD COLUMN "downtimeStartDate" TIMESTAMP, ADD COLUMN "downtimeEndDate" TIMESTAMP, ADD COLUMN "downtimeReason" CHARACTER VARYING`, undefined);
        await queryRunner.query(`CREATE INDEX "IDX_40e3ad1d41d05dda60e9ba76ee" ON "dev"."settings" ("downtimeStartDate", "downtimeEndDate", "downtimeReason", "modifiedById") `, undefined);
    }

}
