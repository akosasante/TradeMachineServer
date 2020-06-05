import {MigrationInterface, QueryRunner} from "typeorm";

export class indexPlayerOnName1591124359523 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`ALTER TABLE "dev"."player" ADD COLUMN "playerDataId" INTEGER`, undefined);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_40e3ad1d41d05dda60e9zZba22dd" ON "dev"."player" ("name", "playerDataId")`, undefined);
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`DROP INDEX "IDX_40e3ad1d41d05dda60e9zZba22dd"`, undefined);
        await queryRunner.query(`ALTER TABLE "dev"."player" DROP COLUMN "playerDataId"`, undefined);
    }

}
