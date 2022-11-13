import {MigrationInterface, QueryRunner} from "typeorm";

export class removeScheduledDowntime1618937069598 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`-- noinspection SqlResolve

DROP TABLE "dev"."scheduled_downtime"`, undefined);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "dev"."scheduled_downtime" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "dateCreated" TIMESTAMP NOT NULL DEFAULT now(), "dateModified" TIMESTAMP NOT NULL DEFAULT now(), "startTime" TIMESTAMP NOT NULL, "endTime" TIMESTAMP NOT NULL, "cancelledDate" TIMESTAMP, "reason" character varying, CONSTRAINT "PK_90d86d54ed0fb02944c81f17dbc" PRIMARY KEY ("id"))`, undefined);
    }

}
