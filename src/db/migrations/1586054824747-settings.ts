import {MigrationInterface, QueryRunner} from "typeorm";

export class settings1586054824747 implements MigrationInterface {
    name = 'settings1586054824747'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "dev"."scheduled_downtime"`, undefined);
        await queryRunner.query(`DROP TABLE "dev"."general_settings"`, undefined);
        await queryRunner.query(`CREATE TABLE "dev"."settings" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "dateCreated" TIMESTAMP NOT NULL DEFAULT now(), "dateModified" TIMESTAMP NOT NULL DEFAULT now(), "tradeWindowStart" TIME, "tradeWindowEnd" TIME, "downtimeStartDate" TIMESTAMP, "downtimeEndDate" TIMESTAMP, "downtimeReason" CHARACTER VARYING, "modifiedById" uuid, CONSTRAINT "PK_173c858141c28aba85f3f2b66cc" PRIMARY KEY ("id"))`, undefined);
        await queryRunner.query(`CREATE INDEX "IDX_40e3ad1d41d05dda60e9ba76de" ON "dev"."settings" ("tradeWindowStart", "tradeWindowEnd", "modifiedById") `, undefined);
        await queryRunner.query(`CREATE INDEX "IDX_40e3ad1d41d05dda60e9ba76ee" ON "dev"."settings" ("downtimeStartDate", "downtimeEndDate", "downtimeReason", "modifiedById") `, undefined);
        await queryRunner.query(`ALTER TABLE "dev"."settings" ADD CONSTRAINT "FK_edbfdecf43bec56ee160c9ba6ac" FOREIGN KEY ("modifiedById") REFERENCES "dev"."user"("id") ON DELETE SET NULL ON UPDATE NO ACTION`, undefined);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "dev"."settings" DROP CONSTRAINT "FK_edbfdecf43bec56ee160c9ba6ac"`, undefined);
        await queryRunner.query(`DROP INDEX "dev"."IDX_40e3ad1d41d05dda60e9ba76ee"`, undefined);
        await queryRunner.query(`DROP INDEX "dev"."IDX_40e3ad1d41d05dda60e9ba76de"`, undefined);
        await queryRunner.query(`DROP TABLE "dev"."settings"`, undefined);
        await queryRunner.query(`CREATE TABLE "dev"."general_settings" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "dateCreated" TIMESTAMP NOT NULL DEFAULT now(), "dateModified" TIMESTAMP NOT NULL DEFAULT now(), "deadline" jsonb NOT NULL, CONSTRAINT "PK_0bb00a97d86bc347069edddc494" PRIMARY KEY ("id"))`, undefined);
        await queryRunner.query(`CREATE TABLE "dev"."scheduled_downtime" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "dateCreated" TIMESTAMP NOT NULL DEFAULT now(), "dateModified" TIMESTAMP NOT NULL DEFAULT now(), "startTime" TIMESTAMP NOT NULL, "endTime" TIMESTAMP NOT NULL, "cancelledDate" TIMESTAMP, "reason" character varying, CONSTRAINT "PK_90d86d54ed0fb02944c81f17dbc" PRIMARY KEY ("id"))`, undefined);
    }

}
