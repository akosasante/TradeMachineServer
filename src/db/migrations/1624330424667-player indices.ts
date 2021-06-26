import {MigrationInterface, QueryRunner} from "typeorm";

export class playerIndices1624330424667 implements MigrationInterface {
    name = 'playerIndices1624330424667'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE INDEX "player_league_type_index" ON "dev"."player" ("league") `);
        await queryRunner.query(`CREATE INDEX "player_league_team_id_index" ON "dev"."player" ("leagueTeamId") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "dev"."player_league_team_id_index"`);
        await queryRunner.query(`DROP INDEX "dev"."player_league_type_index"`);
    }

}
