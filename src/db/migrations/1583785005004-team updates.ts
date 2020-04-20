import {MigrationInterface, QueryRunner} from "typeorm";

export class teamUpdates1583785005004 implements MigrationInterface {
    name = 'teamUpdates1583785005004'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "dev"."user" ADD "teamId" uuid, ADD CONSTRAINT "FK_edbfdecf43bec56ee160c9ba6bd" FOREIGN KEY ("teamId") REFERENCES "dev"."team"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`, undefined)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "dev"."user" DROP CONSTRAINT "FK_edbfdecf43bec56ee160c9ba6bd", DROP COLUMN "teamId"`, undefined);
    }

}
