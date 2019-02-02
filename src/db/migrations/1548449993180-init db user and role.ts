import {MigrationInterface, QueryRunner} from "typeorm";

export class initDbUserAndRole1548449993180 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`CREATE TYPE "dev"."user_role_role_enum" AS ENUM('Admin', 'Owner')`);
        await queryRunner.query(`CREATE TABLE "dev"."user_role" ("id" SERIAL NOT NULL, "role" "dev"."user_role_role_enum" NOT NULL, CONSTRAINT "PK_bc32d55e8af2698dde4c72652b9" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "dev"."user" ("id" SERIAL NOT NULL, "email" character varying NOT NULL, "password" character varying NOT NULL, "name" character varying, "username" character varying, "dateCreated" TIMESTAMP NOT NULL DEFAULT now(), "dateModified" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_46a8d3f2767f238737f7bbde32a" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "dev"."user_roles_user_role" ("userId" integer NOT NULL, "userRoleId" integer NOT NULL, CONSTRAINT "PK_6dd2bb411545e7c3bae2b1ee60c" PRIMARY KEY ("userId", "userRoleId"))`);
        await queryRunner.query(`ALTER TABLE "dev"."user_roles_user_role" ADD CONSTRAINT "FK_9fff6d6659318b38d2396e2efb2" FOREIGN KEY ("userId") REFERENCES "dev"."user"("id") ON DELETE CASCADE`);
        await queryRunner.query(`ALTER TABLE "dev"."user_roles_user_role" ADD CONSTRAINT "FK_26ae590c14afb93b6cdf9ee1708" FOREIGN KEY ("userRoleId") REFERENCES "dev"."user_role"("id") ON DELETE CASCADE`);
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`ALTER TABLE "dev"."user_roles_user_role" DROP CONSTRAINT "FK_26ae590c14afb93b6cdf9ee1708"`);
        await queryRunner.query(`ALTER TABLE "dev"."user_roles_user_role" DROP CONSTRAINT "FK_9fff6d6659318b38d2396e2efb2"`);
        await queryRunner.query(`DROP TABLE "dev"."user_roles_user_role"`);
        await queryRunner.query(`DROP TABLE "dev"."user"`);
        await queryRunner.query(`DROP TABLE "dev"."user_role"`);
        await queryRunner.query(`DROP TYPE "dev"."user_role_role_enum"`);
    }

}
