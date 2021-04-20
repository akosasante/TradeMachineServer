import {MigrationInterface, QueryRunner} from "typeorm";

export class addEspnTeamInfo1587354413115 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "dev"."team" ADD COLUMN "espnTeam" jsonb`, undefined);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "dev"."team" DROP COLUMN "espnTeam"`, undefined);
    }

}
