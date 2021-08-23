import {MigrationInterface, QueryRunner} from "typeorm";

export class addPlayerIndexes1629682103419 implements MigrationInterface {
    name = 'addPlayerIndexes1629682103419'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE INDEX "IDX_a49ffcdb6d07eb76e0052d5784" ON "dev"."player" ("leagueTeamId", "league") `);
        await queryRunner.query(`CREATE INDEX "IDX_1aad05b09bda2079429cd8ba9d" ON "dev"."player" ("leagueTeamId") `);
        await queryRunner.query(`CREATE INDEX "IDX_d94a2974262e7c6129a4c5e690" ON "dev"."player" ("league") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "dev"."IDX_d94a2974262e7c6129a4c5e690"`);
        await queryRunner.query(`DROP INDEX "dev"."IDX_1aad05b09bda2079429cd8ba9d"`);
        await queryRunner.query(`DROP INDEX "dev"."IDX_a49ffcdb6d07eb76e0052d5784"`);
    }

}
