-- CreateEnum
CREATE TYPE "draft_pick_type_enum" AS ENUM ('1', '2', '3');

-- CreateEnum
CREATE TYPE "oban_job_state" AS ENUM ('available', 'scheduled', 'executing', 'retryable', 'completed', 'discarded', 'cancelled');

-- CreateEnum
CREATE TYPE "player_league_enum" AS ENUM ('1', '2');

-- CreateEnum
CREATE TYPE "team_status_enum" AS ENUM ('1', '2');

-- CreateEnum
CREATE TYPE "trade_item_tradeitemtype_enum" AS ENUM ('1', '2');

-- CreateEnum
CREATE TYPE "trade_participant_participanttype_enum" AS ENUM ('1', '2');

-- CreateEnum
CREATE TYPE "trade_status_enum" AS ENUM ('1', '2', '3', '4', '5', '6');

-- CreateEnum
CREATE TYPE "user_role_enum" AS ENUM ('1', '2', '3');

-- CreateEnum
CREATE TYPE "user_status_enum" AS ENUM ('1', '2');

-- CreateTable
CREATE TABLE "draft_pick" (
    "id" UUID NOT NULL,
    "dateCreated" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dateModified" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "round" DECIMAL NOT NULL,
    "pickNumber" INTEGER,
    "season" INTEGER NOT NULL,
    "type" "draft_pick_type_enum" NOT NULL,
    "currentOwnerId" UUID,
    "originalOwnerId" UUID,

    CONSTRAINT "PK_173c858141c28aba85f3f2b66bb" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email" (
    "messageId" VARCHAR NOT NULL,
    "dateCreated" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dateModified" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" VARCHAR NOT NULL,
    "tradeId" UUID,

    CONSTRAINT "PK_b77796b667171ffa41401cfa393be9a3" PRIMARY KEY ("messageId")
);

-- CreateTable
CREATE TABLE "migrations" (
    "id" SERIAL NOT NULL,
    "timestamp" BIGINT NOT NULL,
    "name" VARCHAR NOT NULL,

    CONSTRAINT "PK_6fd861cae8a5b6ceee818af8ed5" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nc_acl" (
    "id" SERIAL NOT NULL,
    "project_id" VARCHAR(255),
    "db_alias" VARCHAR(255) DEFAULT E'db',
    "tn" VARCHAR(255),
    "acl" TEXT,
    "type" VARCHAR(255) DEFAULT E'table',
    "created_at" TIMESTAMPTZ(6),
    "updated_at" TIMESTAMPTZ(6),

    CONSTRAINT "nc_acl_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nc_api_tokens" (
    "id" SERIAL NOT NULL,
    "project_id" VARCHAR(255),
    "db_alias" VARCHAR(255),
    "description" VARCHAR(255),
    "permissions" TEXT,
    "token" TEXT,
    "expiry" VARCHAR(255),
    "enabled" BOOLEAN DEFAULT true,
    "created_at" TIMESTAMPTZ(6),
    "updated_at" TIMESTAMPTZ(6),

    CONSTRAINT "nc_api_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nc_audit" (
    "id" SERIAL NOT NULL,
    "user" VARCHAR(255),
    "ip" VARCHAR(255),
    "project_id" VARCHAR(255),
    "db_alias" VARCHAR(255),
    "model_name" VARCHAR(100),
    "model_id" VARCHAR(100),
    "op_type" VARCHAR(255),
    "op_sub_type" VARCHAR(255),
    "status" VARCHAR(255),
    "description" TEXT,
    "details" TEXT,
    "created_at" TIMESTAMPTZ(6),
    "updated_at" TIMESTAMPTZ(6),

    CONSTRAINT "nc_audit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nc_audit_v2" (
    "id" VARCHAR(20) NOT NULL,
    "user" VARCHAR(255),
    "ip" VARCHAR(255),
    "base_id" VARCHAR(20),
    "project_id" VARCHAR(128),
    "fk_model_id" VARCHAR(20),
    "row_id" VARCHAR(255),
    "op_type" VARCHAR(255),
    "op_sub_type" VARCHAR(255),
    "status" VARCHAR(255),
    "description" TEXT,
    "details" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "nc_audit_v2_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nc_bases_v2" (
    "id" VARCHAR(20) NOT NULL,
    "project_id" VARCHAR(128),
    "alias" VARCHAR(255),
    "config" TEXT,
    "meta" TEXT,
    "is_meta" BOOLEAN,
    "type" VARCHAR(255),
    "inflection_column" VARCHAR(255),
    "inflection_table" VARCHAR(255),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "nc_bases_v2_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nc_col_formula_v2" (
    "id" VARCHAR(20) NOT NULL,
    "fk_column_id" VARCHAR(20),
    "formula" TEXT NOT NULL,
    "formula_raw" TEXT,
    "error" TEXT,
    "deleted" BOOLEAN,
    "order" REAL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "nc_col_formula_v2_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nc_col_lookup_v2" (
    "id" VARCHAR(20) NOT NULL,
    "fk_column_id" VARCHAR(20),
    "fk_relation_column_id" VARCHAR(20),
    "fk_lookup_column_id" VARCHAR(20),
    "deleted" BOOLEAN,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "nc_col_lookup_v2_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nc_col_relations_v2" (
    "id" VARCHAR(20) NOT NULL,
    "ref_db_alias" VARCHAR(255),
    "type" VARCHAR(255),
    "virtual" BOOLEAN,
    "db_type" VARCHAR(255),
    "fk_column_id" VARCHAR(20),
    "fk_related_model_id" VARCHAR(20),
    "fk_child_column_id" VARCHAR(20),
    "fk_parent_column_id" VARCHAR(20),
    "fk_mm_model_id" VARCHAR(20),
    "fk_mm_child_column_id" VARCHAR(20),
    "fk_mm_parent_column_id" VARCHAR(20),
    "ur" VARCHAR(255),
    "dr" VARCHAR(255),
    "fk_index_name" VARCHAR(255),
    "deleted" BOOLEAN,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "nc_col_relations_v2_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nc_col_rollup_v2" (
    "id" VARCHAR(20) NOT NULL,
    "fk_column_id" VARCHAR(20),
    "fk_relation_column_id" VARCHAR(20),
    "fk_rollup_column_id" VARCHAR(20),
    "rollup_function" VARCHAR(255),
    "deleted" BOOLEAN,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "nc_col_rollup_v2_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nc_col_select_options_v2" (
    "id" VARCHAR(20) NOT NULL,
    "fk_column_id" VARCHAR(20),
    "title" VARCHAR(255),
    "color" VARCHAR(255),
    "order" REAL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "nc_col_select_options_v2_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nc_columns_v2" (
    "id" VARCHAR(20) NOT NULL,
    "base_id" VARCHAR(20),
    "project_id" VARCHAR(128),
    "fk_model_id" VARCHAR(20),
    "title" VARCHAR(255),
    "column_name" VARCHAR(255),
    "uidt" VARCHAR(255),
    "dt" VARCHAR(255),
    "np" VARCHAR(255),
    "ns" VARCHAR(255),
    "clen" VARCHAR(255),
    "cop" VARCHAR(255),
    "pk" BOOLEAN,
    "pv" BOOLEAN,
    "rqd" BOOLEAN,
    "un" BOOLEAN,
    "ct" TEXT,
    "ai" BOOLEAN,
    "unique" BOOLEAN,
    "cdf" TEXT,
    "cc" TEXT,
    "csn" VARCHAR(255),
    "dtx" VARCHAR(255),
    "dtxp" TEXT,
    "dtxs" VARCHAR(255),
    "au" BOOLEAN,
    "validate" TEXT,
    "virtual" BOOLEAN,
    "deleted" BOOLEAN,
    "system" BOOLEAN DEFAULT false,
    "order" REAL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "meta" TEXT,

    CONSTRAINT "nc_columns_v2_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nc_cron" (
    "id" SERIAL NOT NULL,
    "project_id" VARCHAR(255),
    "db_alias" VARCHAR(255) DEFAULT E'db',
    "title" VARCHAR(255),
    "description" VARCHAR(255),
    "env" VARCHAR(255),
    "pattern" VARCHAR(255),
    "webhook" VARCHAR(255),
    "timezone" VARCHAR(255) DEFAULT E'America/Los_Angeles',
    "active" BOOLEAN DEFAULT true,
    "cron_handler" TEXT,
    "payload" TEXT,
    "headers" TEXT,
    "retries" INTEGER DEFAULT 0,
    "retry_interval" INTEGER DEFAULT 60000,
    "timeout" INTEGER DEFAULT 60000,
    "created_at" TIMESTAMPTZ(6),
    "updated_at" TIMESTAMPTZ(6),

    CONSTRAINT "nc_cron_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nc_disabled_models_for_role" (
    "id" SERIAL NOT NULL,
    "project_id" VARCHAR(255),
    "db_alias" VARCHAR(45),
    "title" VARCHAR(45),
    "type" VARCHAR(45),
    "role" VARCHAR(45),
    "disabled" BOOLEAN DEFAULT true,
    "tn" VARCHAR(255),
    "rtn" VARCHAR(255),
    "cn" VARCHAR(255),
    "rcn" VARCHAR(255),
    "relation_type" VARCHAR(255),
    "created_at" TIMESTAMPTZ(6),
    "updated_at" TIMESTAMPTZ(6),
    "parent_model_title" VARCHAR(255),

    CONSTRAINT "nc_disabled_models_for_role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nc_disabled_models_for_role_v2" (
    "id" VARCHAR(20) NOT NULL,
    "base_id" VARCHAR(20),
    "project_id" VARCHAR(128),
    "fk_view_id" VARCHAR(20),
    "role" VARCHAR(45),
    "disabled" BOOLEAN DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "nc_disabled_models_for_role_v2_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nc_evolutions" (
    "id" SERIAL NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "titleDown" VARCHAR(255),
    "description" VARCHAR(255),
    "batch" INTEGER,
    "checksum" VARCHAR(255),
    "status" INTEGER,
    "created" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6),
    "updated_at" TIMESTAMPTZ(6),

    CONSTRAINT "nc_evolutions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nc_filter_exp_v2" (
    "id" VARCHAR(20) NOT NULL,
    "base_id" VARCHAR(20),
    "project_id" VARCHAR(128),
    "fk_view_id" VARCHAR(20),
    "fk_hook_id" VARCHAR(20),
    "fk_column_id" VARCHAR(20),
    "fk_parent_id" VARCHAR(20),
    "logical_op" VARCHAR(255),
    "comparison_op" VARCHAR(255),
    "value" VARCHAR(255),
    "is_group" BOOLEAN,
    "order" REAL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "nc_filter_exp_v2_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nc_form_view_columns_v2" (
    "id" VARCHAR(20) NOT NULL,
    "base_id" VARCHAR(20),
    "project_id" VARCHAR(128),
    "fk_view_id" VARCHAR(20),
    "fk_column_id" VARCHAR(20),
    "uuid" VARCHAR(255),
    "label" VARCHAR(255),
    "help" VARCHAR(255),
    "description" TEXT,
    "required" BOOLEAN,
    "show" BOOLEAN,
    "order" REAL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "nc_form_view_columns_v2_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nc_form_view_v2" (
    "base_id" VARCHAR(20),
    "project_id" VARCHAR(128),
    "fk_view_id" VARCHAR(20) NOT NULL,
    "heading" VARCHAR(255),
    "subheading" VARCHAR(255),
    "success_msg" TEXT,
    "redirect_url" TEXT,
    "redirect_after_secs" VARCHAR(255),
    "email" VARCHAR(255),
    "submit_another_form" BOOLEAN,
    "show_blank_form" BOOLEAN,
    "uuid" VARCHAR(255),
    "banner_image_url" TEXT,
    "logo_url" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "nc_form_view_v2_pkey" PRIMARY KEY ("fk_view_id")
);

-- CreateTable
CREATE TABLE "nc_gallery_view_columns_v2" (
    "id" VARCHAR(20) NOT NULL,
    "base_id" VARCHAR(20),
    "project_id" VARCHAR(128),
    "fk_view_id" VARCHAR(20),
    "fk_column_id" VARCHAR(20),
    "uuid" VARCHAR(255),
    "label" VARCHAR(255),
    "help" VARCHAR(255),
    "show" BOOLEAN,
    "order" REAL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "nc_gallery_view_columns_v2_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nc_gallery_view_v2" (
    "base_id" VARCHAR(20),
    "project_id" VARCHAR(128),
    "fk_view_id" VARCHAR(20) NOT NULL,
    "next_enabled" BOOLEAN,
    "prev_enabled" BOOLEAN,
    "cover_image_idx" INTEGER,
    "fk_cover_image_col_id" VARCHAR(20),
    "cover_image" VARCHAR(255),
    "restrict_types" VARCHAR(255),
    "restrict_size" VARCHAR(255),
    "restrict_number" VARCHAR(255),
    "public" BOOLEAN,
    "dimensions" VARCHAR(255),
    "responsive_columns" VARCHAR(255),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "nc_gallery_view_v2_pkey" PRIMARY KEY ("fk_view_id")
);

-- CreateTable
CREATE TABLE "nc_grid_view_columns_v2" (
    "id" VARCHAR(20) NOT NULL,
    "fk_view_id" VARCHAR(20),
    "fk_column_id" VARCHAR(20),
    "base_id" VARCHAR(20),
    "project_id" VARCHAR(128),
    "uuid" VARCHAR(255),
    "label" VARCHAR(255),
    "help" VARCHAR(255),
    "width" VARCHAR(255) DEFAULT E'200px',
    "show" BOOLEAN,
    "order" REAL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "nc_grid_view_columns_v2_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nc_grid_view_v2" (
    "fk_view_id" VARCHAR(20) NOT NULL,
    "base_id" VARCHAR(20),
    "project_id" VARCHAR(128),
    "uuid" VARCHAR(255),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "nc_grid_view_v2_pkey" PRIMARY KEY ("fk_view_id")
);

-- CreateTable
CREATE TABLE "nc_hook_logs_v2" (
    "id" VARCHAR(20) NOT NULL,
    "base_id" VARCHAR(20),
    "project_id" VARCHAR(128),
    "fk_hook_id" VARCHAR(20),
    "type" VARCHAR(255),
    "event" VARCHAR(255),
    "operation" VARCHAR(255),
    "test_call" BOOLEAN DEFAULT true,
    "payload" TEXT,
    "conditions" TEXT,
    "notification" TEXT,
    "error_code" VARCHAR(255),
    "error_message" VARCHAR(255),
    "error" TEXT,
    "execution_time" INTEGER,
    "response" VARCHAR(255),
    "triggered_by" VARCHAR(255),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "nc_hook_logs_v2_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nc_hooks" (
    "id" SERIAL NOT NULL,
    "project_id" VARCHAR(255),
    "db_alias" VARCHAR(255) DEFAULT E'db',
    "title" VARCHAR(255),
    "description" VARCHAR(255),
    "env" VARCHAR(255) DEFAULT E'all',
    "tn" VARCHAR(255),
    "type" VARCHAR(255),
    "event" VARCHAR(255),
    "operation" VARCHAR(255),
    "async" BOOLEAN DEFAULT false,
    "payload" BOOLEAN DEFAULT true,
    "url" TEXT,
    "headers" TEXT,
    "condition" TEXT,
    "notification" TEXT,
    "retries" INTEGER DEFAULT 0,
    "retry_interval" INTEGER DEFAULT 60000,
    "timeout" INTEGER DEFAULT 60000,
    "active" BOOLEAN DEFAULT true,
    "created_at" TIMESTAMPTZ(6),
    "updated_at" TIMESTAMPTZ(6),

    CONSTRAINT "nc_hooks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nc_hooks_v2" (
    "id" VARCHAR(20) NOT NULL,
    "base_id" VARCHAR(20),
    "project_id" VARCHAR(128),
    "fk_model_id" VARCHAR(20),
    "title" VARCHAR(255),
    "description" VARCHAR(255),
    "env" VARCHAR(255) DEFAULT E'all',
    "type" VARCHAR(255),
    "event" VARCHAR(255),
    "operation" VARCHAR(255),
    "async" BOOLEAN DEFAULT false,
    "payload" BOOLEAN DEFAULT true,
    "url" TEXT,
    "headers" TEXT,
    "condition" BOOLEAN DEFAULT false,
    "notification" TEXT,
    "retries" INTEGER DEFAULT 0,
    "retry_interval" INTEGER DEFAULT 60000,
    "timeout" INTEGER DEFAULT 60000,
    "active" BOOLEAN DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "nc_hooks_v2_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nc_kanban_view_columns_v2" (
    "id" VARCHAR(20) NOT NULL,
    "base_id" VARCHAR(20),
    "project_id" VARCHAR(128),
    "fk_view_id" VARCHAR(20),
    "fk_column_id" VARCHAR(20),
    "uuid" VARCHAR(255),
    "label" VARCHAR(255),
    "help" VARCHAR(255),
    "show" BOOLEAN,
    "order" REAL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "nc_kanban_view_columns_v2_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nc_kanban_view_v2" (
    "fk_view_id" VARCHAR(20) NOT NULL,
    "base_id" VARCHAR(20),
    "project_id" VARCHAR(128),
    "show" BOOLEAN,
    "order" REAL,
    "uuid" VARCHAR(255),
    "title" VARCHAR(255),
    "public" BOOLEAN,
    "password" VARCHAR(255),
    "show_all_fields" BOOLEAN,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "nc_kanban_view_v2_pkey" PRIMARY KEY ("fk_view_id")
);

-- CreateTable
CREATE TABLE "nc_loaders" (
    "id" SERIAL NOT NULL,
    "project_id" VARCHAR(255),
    "db_alias" VARCHAR(255) DEFAULT E'db',
    "title" VARCHAR(255),
    "parent" VARCHAR(255),
    "child" VARCHAR(255),
    "relation" VARCHAR(255),
    "resolver" VARCHAR(255),
    "functions" TEXT,
    "created_at" TIMESTAMPTZ(6),
    "updated_at" TIMESTAMPTZ(6),

    CONSTRAINT "nc_loaders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nc_migrations" (
    "id" SERIAL NOT NULL,
    "project_id" VARCHAR(255),
    "db_alias" VARCHAR(255),
    "up" TEXT,
    "down" TEXT,
    "title" VARCHAR(255) NOT NULL,
    "title_down" VARCHAR(255),
    "description" VARCHAR(255),
    "batch" INTEGER,
    "checksum" VARCHAR(255),
    "status" INTEGER,
    "created_at" TIMESTAMPTZ(6),
    "updated_at" TIMESTAMPTZ(6),

    CONSTRAINT "nc_migrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nc_models" (
    "id" SERIAL NOT NULL,
    "project_id" VARCHAR(255),
    "db_alias" VARCHAR(255) DEFAULT E'db',
    "title" VARCHAR(255),
    "alias" VARCHAR(255),
    "type" VARCHAR(255) DEFAULT E'table',
    "meta" TEXT,
    "schema" TEXT,
    "schema_previous" TEXT,
    "services" TEXT,
    "messages" TEXT,
    "enabled" BOOLEAN DEFAULT true,
    "parent_model_title" VARCHAR(255),
    "show_as" VARCHAR(255) DEFAULT E'table',
    "query_params" TEXT,
    "list_idx" INTEGER,
    "tags" VARCHAR(255),
    "pinned" BOOLEAN,
    "created_at" TIMESTAMPTZ(6),
    "updated_at" TIMESTAMPTZ(6),
    "mm" INTEGER,
    "m_to_m_meta" TEXT,
    "order" REAL,
    "view_order" REAL,

    CONSTRAINT "nc_models_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nc_models_v2" (
    "id" VARCHAR(20) NOT NULL,
    "base_id" VARCHAR(20),
    "project_id" VARCHAR(128),
    "table_name" VARCHAR(255),
    "title" VARCHAR(255),
    "type" VARCHAR(255) DEFAULT E'table',
    "meta" TEXT,
    "schema" TEXT,
    "enabled" BOOLEAN DEFAULT true,
    "mm" BOOLEAN DEFAULT false,
    "tags" VARCHAR(255),
    "pinned" BOOLEAN,
    "deleted" BOOLEAN,
    "order" REAL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "nc_models_v2_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nc_orgs_v2" (
    "id" VARCHAR(20) NOT NULL,
    "title" VARCHAR(255),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "nc_orgs_v2_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nc_plugins" (
    "id" SERIAL NOT NULL,
    "project_id" VARCHAR(255),
    "db_alias" VARCHAR(255),
    "title" VARCHAR(45),
    "description" TEXT,
    "active" BOOLEAN DEFAULT false,
    "rating" REAL,
    "version" VARCHAR(255),
    "docs" VARCHAR(255),
    "status" VARCHAR(255) DEFAULT E'install',
    "status_details" VARCHAR(255),
    "logo" VARCHAR(255),
    "icon" VARCHAR(255),
    "tags" VARCHAR(255),
    "category" VARCHAR(255),
    "input_schema" TEXT,
    "input" TEXT,
    "creator" VARCHAR(255),
    "creator_website" VARCHAR(255),
    "price" VARCHAR(255),
    "created_at" TIMESTAMPTZ(6),
    "updated_at" TIMESTAMPTZ(6),

    CONSTRAINT "nc_plugins_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nc_plugins_v2" (
    "id" VARCHAR(20) NOT NULL,
    "title" VARCHAR(45),
    "description" TEXT,
    "active" BOOLEAN DEFAULT false,
    "rating" REAL,
    "version" VARCHAR(255),
    "docs" VARCHAR(255),
    "status" VARCHAR(255) DEFAULT E'install',
    "status_details" VARCHAR(255),
    "logo" VARCHAR(255),
    "icon" VARCHAR(255),
    "tags" VARCHAR(255),
    "category" VARCHAR(255),
    "input_schema" TEXT,
    "input" TEXT,
    "creator" VARCHAR(255),
    "creator_website" VARCHAR(255),
    "price" VARCHAR(255),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "nc_plugins_v2_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nc_projects" (
    "id" VARCHAR(128) NOT NULL,
    "title" VARCHAR(255),
    "status" VARCHAR(255),
    "description" TEXT,
    "config" TEXT,
    "meta" TEXT,
    "created_at" TIMESTAMPTZ(6),
    "updated_at" TIMESTAMPTZ(6),

    CONSTRAINT "nc_projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nc_projects_users" (
    "project_id" VARCHAR(255),
    "user_id" INTEGER,
    "roles" TEXT,
    "created_at" TIMESTAMPTZ(6),
    "updated_at" TIMESTAMPTZ(6)
);

-- CreateTable
CREATE TABLE "nc_projects_v2" (
    "id" VARCHAR(128) NOT NULL,
    "title" VARCHAR(255),
    "prefix" VARCHAR(255),
    "status" VARCHAR(255),
    "description" TEXT,
    "meta" TEXT,
    "color" VARCHAR(255),
    "uuid" VARCHAR(255),
    "password" VARCHAR(255),
    "roles" VARCHAR(255),
    "deleted" BOOLEAN DEFAULT false,
    "is_meta" BOOLEAN,
    "order" REAL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "nc_projects_v2_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nc_project_users_v2" (
    "project_id" VARCHAR(128),
    "fk_user_id" VARCHAR(20),
    "roles" TEXT,
    "starred" BOOLEAN,
    "pinned" BOOLEAN,
    "group" VARCHAR(255),
    "color" VARCHAR(255),
    "order" REAL,
    "hidden" REAL,
    "opened_date" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "nc_relations" (
    "id" SERIAL NOT NULL,
    "project_id" VARCHAR(255),
    "db_alias" VARCHAR(255),
    "tn" VARCHAR(255),
    "rtn" VARCHAR(255),
    "_tn" VARCHAR(255),
    "_rtn" VARCHAR(255),
    "cn" VARCHAR(255),
    "rcn" VARCHAR(255),
    "_cn" VARCHAR(255),
    "_rcn" VARCHAR(255),
    "referenced_db_alias" VARCHAR(255),
    "type" VARCHAR(255),
    "db_type" VARCHAR(255),
    "ur" VARCHAR(255),
    "dr" VARCHAR(255),
    "created_at" TIMESTAMPTZ(6),
    "updated_at" TIMESTAMPTZ(6),
    "fkn" VARCHAR(255),

    CONSTRAINT "nc_relations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nc_resolvers" (
    "id" SERIAL NOT NULL,
    "project_id" VARCHAR(255),
    "db_alias" VARCHAR(255) DEFAULT E'db',
    "title" VARCHAR(255),
    "resolver" TEXT,
    "type" VARCHAR(255),
    "acl" TEXT,
    "functions" TEXT,
    "handler_type" INTEGER DEFAULT 1,
    "created_at" TIMESTAMPTZ(6),
    "updated_at" TIMESTAMPTZ(6),

    CONSTRAINT "nc_resolvers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nc_roles" (
    "id" SERIAL NOT NULL,
    "project_id" VARCHAR(255),
    "db_alias" VARCHAR(255) DEFAULT E'db',
    "title" VARCHAR(255),
    "type" VARCHAR(255) DEFAULT E'CUSTOM',
    "description" VARCHAR(255),
    "created_at" TIMESTAMPTZ(6),
    "updated_at" TIMESTAMPTZ(6),

    CONSTRAINT "nc_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nc_routes" (
    "id" SERIAL NOT NULL,
    "project_id" VARCHAR(255),
    "db_alias" VARCHAR(255) DEFAULT E'db',
    "title" VARCHAR(255),
    "tn" VARCHAR(255),
    "tnp" VARCHAR(255),
    "tnc" VARCHAR(255),
    "relation_type" VARCHAR(255),
    "path" TEXT,
    "type" VARCHAR(255),
    "handler" TEXT,
    "acl" TEXT,
    "order" INTEGER,
    "functions" TEXT,
    "handler_type" INTEGER DEFAULT 1,
    "is_custom" BOOLEAN,
    "created_at" TIMESTAMPTZ(6),
    "updated_at" TIMESTAMPTZ(6),

    CONSTRAINT "nc_routes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nc_rpc" (
    "id" SERIAL NOT NULL,
    "project_id" VARCHAR(255),
    "db_alias" VARCHAR(255) DEFAULT E'db',
    "title" VARCHAR(255),
    "tn" VARCHAR(255),
    "service" TEXT,
    "tnp" VARCHAR(255),
    "tnc" VARCHAR(255),
    "relation_type" VARCHAR(255),
    "order" INTEGER,
    "type" VARCHAR(255),
    "acl" TEXT,
    "functions" TEXT,
    "handler_type" INTEGER DEFAULT 1,
    "created_at" TIMESTAMPTZ(6),
    "updated_at" TIMESTAMPTZ(6),

    CONSTRAINT "nc_rpc_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nc_shared_bases" (
    "id" SERIAL NOT NULL,
    "project_id" VARCHAR(255),
    "db_alias" VARCHAR(255),
    "roles" VARCHAR(255) DEFAULT E'viewer',
    "shared_base_id" VARCHAR(255),
    "enabled" BOOLEAN DEFAULT true,
    "password" VARCHAR(255),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "nc_shared_bases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nc_shared_views" (
    "id" SERIAL NOT NULL,
    "project_id" VARCHAR(255),
    "db_alias" VARCHAR(255),
    "model_name" VARCHAR(255),
    "meta" TEXT,
    "query_params" TEXT,
    "view_id" VARCHAR(255),
    "show_all_fields" BOOLEAN,
    "allow_copy" BOOLEAN,
    "password" VARCHAR(255),
    "created_at" TIMESTAMPTZ(6),
    "updated_at" TIMESTAMPTZ(6),
    "view_type" VARCHAR(255),
    "view_name" VARCHAR(255),

    CONSTRAINT "nc_shared_views_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nc_shared_views_v2" (
    "id" VARCHAR(20) NOT NULL,
    "fk_view_id" VARCHAR(20),
    "meta" TEXT,
    "query_params" TEXT,
    "view_id" VARCHAR(255),
    "show_all_fields" BOOLEAN,
    "allow_copy" BOOLEAN,
    "password" VARCHAR(255),
    "deleted" BOOLEAN,
    "order" REAL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "nc_shared_views_v2_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nc_sort_v2" (
    "id" VARCHAR(20) NOT NULL,
    "base_id" VARCHAR(20),
    "project_id" VARCHAR(128),
    "fk_view_id" VARCHAR(20),
    "fk_column_id" VARCHAR(20),
    "direction" VARCHAR(255) DEFAULT E'false',
    "order" REAL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "nc_sort_v2_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nc_store" (
    "id" SERIAL NOT NULL,
    "project_id" VARCHAR(255),
    "db_alias" VARCHAR(255) DEFAULT E'db',
    "key" VARCHAR(255),
    "value" TEXT,
    "type" VARCHAR(255),
    "env" VARCHAR(255),
    "tag" VARCHAR(255),
    "created_at" TIMESTAMPTZ(6),
    "updated_at" TIMESTAMPTZ(6),

    CONSTRAINT "nc_store_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nc_sync_logs_v2" (
    "id" VARCHAR(20) NOT NULL,
    "project_id" VARCHAR(128),
    "fk_sync_source_id" VARCHAR(20),
    "time_taken" INTEGER,
    "status" VARCHAR(255),
    "status_details" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "nc_sync_logs_v2_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nc_sync_source_v2" (
    "id" VARCHAR(20) NOT NULL,
    "title" VARCHAR(255),
    "type" VARCHAR(255),
    "details" TEXT,
    "deleted" BOOLEAN,
    "enabled" BOOLEAN DEFAULT true,
    "order" REAL,
    "project_id" VARCHAR(128),
    "fk_user_id" VARCHAR(128),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "nc_sync_source_v2_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nc_teams_v2" (
    "id" VARCHAR(20) NOT NULL,
    "title" VARCHAR(255),
    "org_id" VARCHAR(20),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "nc_teams_v2_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nc_team_users_v2" (
    "org_id" VARCHAR(20),
    "user_id" VARCHAR(20),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "nc_users_v2" (
    "id" VARCHAR(20) NOT NULL,
    "email" VARCHAR(255),
    "password" VARCHAR(255),
    "salt" VARCHAR(255),
    "firstname" VARCHAR(255),
    "lastname" VARCHAR(255),
    "username" VARCHAR(255),
    "refresh_token" VARCHAR(255),
    "invite_token" VARCHAR(255),
    "invite_token_expires" VARCHAR(255),
    "reset_password_expires" TIMESTAMPTZ(6),
    "reset_password_token" VARCHAR(255),
    "email_verification_token" VARCHAR(255),
    "email_verified" BOOLEAN,
    "roles" VARCHAR(255) DEFAULT E'editor',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "nc_users_v2_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nc_views_v2" (
    "id" VARCHAR(20) NOT NULL,
    "base_id" VARCHAR(20),
    "project_id" VARCHAR(128),
    "fk_model_id" VARCHAR(20),
    "title" VARCHAR(255),
    "type" INTEGER,
    "is_default" BOOLEAN,
    "show_system_fields" BOOLEAN,
    "lock_type" VARCHAR(255) DEFAULT E'collaborative',
    "uuid" VARCHAR(255),
    "password" VARCHAR(255),
    "show" BOOLEAN,
    "order" REAL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "nc_views_v2_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "oban_jobs" (
    "id" BIGSERIAL NOT NULL,
    "queue" TEXT NOT NULL DEFAULT E'default',
    "worker" TEXT NOT NULL,
    "args" JSONB NOT NULL DEFAULT '{}',
    "errors" JSONB[],
    "attempt" INTEGER NOT NULL DEFAULT 0,
    "max_attempts" INTEGER NOT NULL DEFAULT 20,
    "inserted_at" TIMESTAMP(6) NOT NULL DEFAULT timezone('UTC'::text, now()),
    "scheduled_at" TIMESTAMP(6) NOT NULL DEFAULT timezone('UTC'::text, now()),
    "attempted_at" TIMESTAMP(6),
    "completed_at" TIMESTAMP(6),
    "attempted_by" TEXT[],
    "discarded_at" TIMESTAMP(6),
    "priority" INTEGER NOT NULL DEFAULT 0,
    "tags" VARCHAR(255)[],
    "meta" JSONB DEFAULT '{}',
    "cancelled_at" TIMESTAMP(6),
    "state" "oban_job_state" NOT NULL DEFAULT E'available',

    CONSTRAINT "oban_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "player" (
    "id" UUID NOT NULL,
    "dateCreated" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dateModified" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "name" VARCHAR NOT NULL,
    "league" "player_league_enum",
    "mlbTeam" VARCHAR,
    "meta" JSONB,
    "playerDataId" INTEGER,
    "leagueTeamId" UUID,

    CONSTRAINT "PK_9fd0dba262c28fb584448f6ec12" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "query-result-cache" (
    "id" SERIAL NOT NULL,
    "identifier" VARCHAR NOT NULL,
    "time" BIGINT NOT NULL,
    "duration" INTEGER NOT NULL,
    "query" TEXT NOT NULL,
    "result" TEXT NOT NULL,

    CONSTRAINT "PK_6a98f758d8bfd010e7e10ffd3d3" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "schema_migrations" (
    "version" BIGINT NOT NULL,
    "inserted_at" TIMESTAMP(0),

    CONSTRAINT "schema_migrations_pkey" PRIMARY KEY ("version")
);

-- CreateTable
CREATE TABLE "settings" (
    "id" UUID NOT NULL,
    "dateCreated" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dateModified" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tradeWindowStart" TIME(6),
    "tradeWindowEnd" TIME(6),
    "downtime" JSONB,
    "modifiedById" UUID,

    CONSTRAINT "PK_173c858141c28aba85f3f2b66cc" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "team" (
    "id" UUID NOT NULL,
    "dateCreated" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dateModified" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "espnId" INTEGER,
    "name" VARCHAR NOT NULL,
    "status" "team_status_enum" NOT NULL DEFAULT E'2',
    "espnTeam" JSONB,

    CONSTRAINT "PK_d4c9ceb4d198d0214d982242c10" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trade" (
    "id" UUID NOT NULL,
    "dateCreated" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dateModified" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "trade_status_enum" NOT NULL DEFAULT E'1',
    "declinedReason" VARCHAR,
    "declinedById" UUID,
    "acceptedBy" JSONB,
    "acceptedOnDate" TIMESTAMP(6),

    CONSTRAINT "PK_8a1cea805d050478a2482f0960e" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trade_item" (
    "id" UUID NOT NULL,
    "dateCreated" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dateModified" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tradeItemId" UUID NOT NULL,
    "tradeItemType" "trade_item_tradeitemtype_enum" NOT NULL DEFAULT E'1',
    "tradeId" UUID,
    "senderId" UUID,
    "recipientId" UUID,

    CONSTRAINT "trade_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trade_participant" (
    "id" UUID NOT NULL,
    "dateCreated" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dateModified" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "participantType" "trade_participant_participanttype_enum" NOT NULL DEFAULT E'2',
    "tradeId" UUID,
    "teamId" UUID,

    CONSTRAINT "PK_60f29eec159bc8b923a8ebda680" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "typeorm_metadata" (
    "type" VARCHAR NOT NULL,
    "database" VARCHAR,
    "schema" VARCHAR,
    "name" VARCHAR,
    "value" TEXT
);

-- CreateTable
CREATE TABLE "user" (
    "id" UUID NOT NULL,
    "dateCreated" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dateModified" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "email" VARCHAR NOT NULL,
    "password" VARCHAR,
    "displayName" VARCHAR,
    "slackUsername" VARCHAR,
    "role" "user_role_enum" NOT NULL DEFAULT E'2',
    "lastLoggedIn" TIMESTAMP(6),
    "passwordResetExpiresOn" TIMESTAMP(6),
    "passwordResetToken" VARCHAR,
    "status" "user_status_enum" NOT NULL DEFAULT E'1',
    "csvName" VARCHAR,
    "espnMember" JSONB,
    "teamId" UUID,

    CONSTRAINT "PK_46a8d3f2767f238737f7bbde32a" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "xc_knex_migrations" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(255),
    "batch" INTEGER,
    "migration_time" TIMESTAMPTZ(6),

    CONSTRAINT "xc_knex_migrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "xc_knex_migrations_lock" (
    "index" SERIAL NOT NULL,
    "is_locked" INTEGER,

    CONSTRAINT "xc_knex_migrations_lock_pkey" PRIMARY KEY ("index")
);

-- CreateTable
CREATE TABLE "xc_knex_migrationsv2" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(255),
    "batch" INTEGER,
    "migration_time" TIMESTAMPTZ(6),

    CONSTRAINT "xc_knex_migrationsv2_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "xc_knex_migrationsv2_lock" (
    "index" SERIAL NOT NULL,
    "is_locked" INTEGER,

    CONSTRAINT "xc_knex_migrationsv2_lock_pkey" PRIMARY KEY ("index")
);

-- CreateIndex
CREATE INDEX "IDX_0de9414ff65ab246290e2793ac" ON "draft_pick"("currentOwnerId", "originalOwnerId");

-- CreateIndex
CREATE INDEX "IDX_5e448065a1f32514925e8045b6" ON "draft_pick"("originalOwnerId");

-- CreateIndex
CREATE INDEX "IDX_edbfdecf43bec56ee160c9ba6b" ON "draft_pick"("currentOwnerId");

-- CreateIndex
CREATE UNIQUE INDEX "UQ_b0ee29a2eed55b5c4739873e3cd" ON "draft_pick"("type", "season", "round", "originalOwnerId");

-- CreateIndex
CREATE INDEX "IDX_7d64d8e03978e61c58c436ec31" ON "email"("status");

-- CreateIndex
CREATE INDEX "`nc_audit_index`" ON "nc_audit"("db_alias", "project_id", "model_name", "model_id");

-- CreateIndex
CREATE INDEX "nc_audit_v2_row_id_index" ON "nc_audit_v2"("row_id");

-- CreateIndex
CREATE INDEX "xc_disabled124_idx" ON "nc_disabled_models_for_role"("project_id", "db_alias", "title", "type", "role");

-- CreateIndex
CREATE INDEX "nc_models_db_alias_title_index" ON "nc_models"("db_alias", "title");

-- CreateIndex
CREATE INDEX "nc_models_order_index" ON "nc_models"("order");

-- CreateIndex
CREATE INDEX "nc_models_view_order_index" ON "nc_models"("view_order");

-- CreateIndex
CREATE INDEX "nc_projects_users_project_id_index" ON "nc_projects_users"("project_id");

-- CreateIndex
CREATE INDEX "nc_projects_users_user_id_index" ON "nc_projects_users"("user_id");

-- CreateIndex
CREATE INDEX "nc_relations_db_alias_tn_index" ON "nc_relations"("db_alias", "tn");

-- CreateIndex
CREATE INDEX "nc_routes_db_alias_title_tn_index" ON "nc_routes"("db_alias", "title", "tn");

-- CreateIndex
CREATE INDEX "nc_store_key_index" ON "nc_store"("key");

-- CreateIndex
CREATE INDEX "oban_jobs_args_index" ON "oban_jobs"("args");

-- CreateIndex
CREATE INDEX "oban_jobs_meta_index" ON "oban_jobs"("meta");

-- CreateIndex
CREATE INDEX "oban_jobs_queue_state_priority_scheduled_at_id_index" ON "oban_jobs"("queue", "state", "priority", "scheduled_at", "id");

-- CreateIndex
CREATE INDEX "IDX_1aad05b09bda2079429cd8ba9d" ON "player"("leagueTeamId");

-- CreateIndex
CREATE INDEX "IDX_40e3ad1d41d05dda60e9ba76cc" ON "player"("name");

-- CreateIndex
CREATE INDEX "IDX_a49ffcdb6d07eb76e0052d5784" ON "player"("leagueTeamId", "league");

-- CreateIndex
CREATE INDEX "IDX_d94a2974262e7c6129a4c5e690" ON "player"("league");

-- CreateIndex
CREATE UNIQUE INDEX "UQ_b3fd08fd2ba540e6fc2b6946e2c" ON "player"("name", "playerDataId");

-- CreateIndex
CREATE INDEX "IDX_032a9a86a6ea1ccd874a452f62" ON "settings"("downtime", "modifiedById");

-- CreateIndex
CREATE INDEX "IDX_3fa40f2df01d35d0bbed8264ca" ON "settings"("tradeWindowStart", "tradeWindowEnd", "modifiedById");

-- CreateIndex
CREATE INDEX "IDX_cb5f64b730072c78ba13d5db95" ON "settings"("modifiedById");

-- CreateIndex
CREATE UNIQUE INDEX "UQ_4f8b73a54933f9eab5177b90362" ON "team"("espnId");

-- CreateIndex
CREATE INDEX "IDX_33ece5157bae9642f83f4e69e6" ON "trade"("declinedById");

-- CreateIndex
CREATE INDEX "IDX_1abdf634a91dc15221fecbd253" ON "trade_item"("recipientId");

-- CreateIndex
CREATE INDEX "IDX_5183edace8d48f41e21706f3de" ON "trade_item"("senderId", "recipientId");

-- CreateIndex
CREATE INDEX "IDX_7410fa0ef846786168a48f8309" ON "trade_item"("tradeItemType");

-- CreateIndex
CREATE INDEX "IDX_93c36c896adc55ffa2fde08807" ON "trade_item"("senderId");

-- CreateIndex
CREATE UNIQUE INDEX "IDX_e052cf9b5b061404e7d9757a5f" ON "trade_item"("tradeId", "tradeItemId", "tradeItemType", "senderId", "recipientId");

-- CreateIndex
CREATE INDEX "IDX_4790898869f46e4f7714c23f4e" ON "trade_participant"("participantType");

-- CreateIndex
CREATE INDEX "IDX_6f42978de8c286663f97f12c9d" ON "trade_participant"("teamId");

-- CreateIndex
CREATE UNIQUE INDEX "IDX_6cefad40c0c9cbb34500c9f2b5" ON "trade_participant"("tradeId", "teamId");

-- CreateIndex
CREATE UNIQUE INDEX "UQ_37a55ad1dbb070054bece40642f" ON "user"("email");

-- AddForeignKey
ALTER TABLE "draft_pick" ADD CONSTRAINT "FK_edbfdecf43bec56ee160c9ba6bd" FOREIGN KEY ("currentOwnerId") REFERENCES "team"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "draft_pick" ADD CONSTRAINT "FK_5e448065a1f32514925e8045b61" FOREIGN KEY ("originalOwnerId") REFERENCES "team"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "email" ADD CONSTRAINT "FK_9140a2b1ba9cdc4e9c273f0eb21" FOREIGN KEY ("tradeId") REFERENCES "trade"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "nc_audit_v2" ADD CONSTRAINT "nc_audit_v2_base_id_foreign" FOREIGN KEY ("base_id") REFERENCES "nc_bases_v2"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "nc_audit_v2" ADD CONSTRAINT "nc_audit_v2_fk_model_id_foreign" FOREIGN KEY ("fk_model_id") REFERENCES "nc_models_v2"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "nc_audit_v2" ADD CONSTRAINT "nc_audit_v2_project_id_foreign" FOREIGN KEY ("project_id") REFERENCES "nc_projects_v2"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "nc_bases_v2" ADD CONSTRAINT "nc_bases_v2_project_id_foreign" FOREIGN KEY ("project_id") REFERENCES "nc_projects_v2"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "nc_col_formula_v2" ADD CONSTRAINT "nc_col_formula_v2_fk_column_id_foreign" FOREIGN KEY ("fk_column_id") REFERENCES "nc_columns_v2"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "nc_col_lookup_v2" ADD CONSTRAINT "nc_col_lookup_v2_fk_column_id_foreign" FOREIGN KEY ("fk_column_id") REFERENCES "nc_columns_v2"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "nc_col_lookup_v2" ADD CONSTRAINT "nc_col_lookup_v2_fk_lookup_column_id_foreign" FOREIGN KEY ("fk_lookup_column_id") REFERENCES "nc_columns_v2"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "nc_col_lookup_v2" ADD CONSTRAINT "nc_col_lookup_v2_fk_relation_column_id_foreign" FOREIGN KEY ("fk_relation_column_id") REFERENCES "nc_columns_v2"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "nc_col_relations_v2" ADD CONSTRAINT "nc_col_relations_v2_fk_child_column_id_foreign" FOREIGN KEY ("fk_child_column_id") REFERENCES "nc_columns_v2"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "nc_col_relations_v2" ADD CONSTRAINT "nc_col_relations_v2_fk_column_id_foreign" FOREIGN KEY ("fk_column_id") REFERENCES "nc_columns_v2"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "nc_col_relations_v2" ADD CONSTRAINT "nc_col_relations_v2_fk_mm_child_column_id_foreign" FOREIGN KEY ("fk_mm_child_column_id") REFERENCES "nc_columns_v2"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "nc_col_relations_v2" ADD CONSTRAINT "nc_col_relations_v2_fk_mm_parent_column_id_foreign" FOREIGN KEY ("fk_mm_parent_column_id") REFERENCES "nc_columns_v2"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "nc_col_relations_v2" ADD CONSTRAINT "nc_col_relations_v2_fk_parent_column_id_foreign" FOREIGN KEY ("fk_parent_column_id") REFERENCES "nc_columns_v2"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "nc_col_relations_v2" ADD CONSTRAINT "nc_col_relations_v2_fk_mm_model_id_foreign" FOREIGN KEY ("fk_mm_model_id") REFERENCES "nc_models_v2"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "nc_col_relations_v2" ADD CONSTRAINT "nc_col_relations_v2_fk_related_model_id_foreign" FOREIGN KEY ("fk_related_model_id") REFERENCES "nc_models_v2"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "nc_col_rollup_v2" ADD CONSTRAINT "nc_col_rollup_v2_fk_column_id_foreign" FOREIGN KEY ("fk_column_id") REFERENCES "nc_columns_v2"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "nc_col_rollup_v2" ADD CONSTRAINT "nc_col_rollup_v2_fk_relation_column_id_foreign" FOREIGN KEY ("fk_relation_column_id") REFERENCES "nc_columns_v2"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "nc_col_rollup_v2" ADD CONSTRAINT "nc_col_rollup_v2_fk_rollup_column_id_foreign" FOREIGN KEY ("fk_rollup_column_id") REFERENCES "nc_columns_v2"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "nc_col_select_options_v2" ADD CONSTRAINT "nc_col_select_options_v2_fk_column_id_foreign" FOREIGN KEY ("fk_column_id") REFERENCES "nc_columns_v2"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "nc_columns_v2" ADD CONSTRAINT "nc_columns_v2_fk_model_id_foreign" FOREIGN KEY ("fk_model_id") REFERENCES "nc_models_v2"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "nc_disabled_models_for_role_v2" ADD CONSTRAINT "nc_disabled_models_for_role_v2_fk_view_id_foreign" FOREIGN KEY ("fk_view_id") REFERENCES "nc_views_v2"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "nc_filter_exp_v2" ADD CONSTRAINT "nc_filter_exp_v2_fk_column_id_foreign" FOREIGN KEY ("fk_column_id") REFERENCES "nc_columns_v2"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "nc_filter_exp_v2" ADD CONSTRAINT "nc_filter_exp_v2_fk_parent_id_foreign" FOREIGN KEY ("fk_parent_id") REFERENCES "nc_filter_exp_v2"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "nc_filter_exp_v2" ADD CONSTRAINT "nc_filter_exp_v2_fk_hook_id_foreign" FOREIGN KEY ("fk_hook_id") REFERENCES "nc_hooks_v2"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "nc_filter_exp_v2" ADD CONSTRAINT "nc_filter_exp_v2_fk_view_id_foreign" FOREIGN KEY ("fk_view_id") REFERENCES "nc_views_v2"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "nc_form_view_columns_v2" ADD CONSTRAINT "nc_form_view_columns_v2_fk_column_id_foreign" FOREIGN KEY ("fk_column_id") REFERENCES "nc_columns_v2"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "nc_form_view_columns_v2" ADD CONSTRAINT "nc_form_view_columns_v2_fk_view_id_foreign" FOREIGN KEY ("fk_view_id") REFERENCES "nc_form_view_v2"("fk_view_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "nc_form_view_v2" ADD CONSTRAINT "nc_form_view_v2_fk_view_id_foreign" FOREIGN KEY ("fk_view_id") REFERENCES "nc_views_v2"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "nc_gallery_view_columns_v2" ADD CONSTRAINT "nc_gallery_view_columns_v2_fk_column_id_foreign" FOREIGN KEY ("fk_column_id") REFERENCES "nc_columns_v2"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "nc_gallery_view_columns_v2" ADD CONSTRAINT "nc_gallery_view_columns_v2_fk_view_id_foreign" FOREIGN KEY ("fk_view_id") REFERENCES "nc_gallery_view_v2"("fk_view_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "nc_gallery_view_v2" ADD CONSTRAINT "nc_gallery_view_v2_fk_cover_image_col_id_foreign" FOREIGN KEY ("fk_cover_image_col_id") REFERENCES "nc_columns_v2"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "nc_gallery_view_v2" ADD CONSTRAINT "nc_gallery_view_v2_fk_view_id_foreign" FOREIGN KEY ("fk_view_id") REFERENCES "nc_views_v2"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "nc_grid_view_columns_v2" ADD CONSTRAINT "nc_grid_view_columns_v2_fk_column_id_foreign" FOREIGN KEY ("fk_column_id") REFERENCES "nc_columns_v2"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "nc_grid_view_columns_v2" ADD CONSTRAINT "nc_grid_view_columns_v2_fk_view_id_foreign" FOREIGN KEY ("fk_view_id") REFERENCES "nc_grid_view_v2"("fk_view_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "nc_grid_view_v2" ADD CONSTRAINT "nc_grid_view_v2_fk_view_id_foreign" FOREIGN KEY ("fk_view_id") REFERENCES "nc_views_v2"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "nc_hooks_v2" ADD CONSTRAINT "nc_hooks_v2_fk_model_id_foreign" FOREIGN KEY ("fk_model_id") REFERENCES "nc_models_v2"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "nc_kanban_view_columns_v2" ADD CONSTRAINT "nc_kanban_view_columns_v2_fk_column_id_foreign" FOREIGN KEY ("fk_column_id") REFERENCES "nc_columns_v2"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "nc_kanban_view_columns_v2" ADD CONSTRAINT "nc_kanban_view_columns_v2_fk_view_id_foreign" FOREIGN KEY ("fk_view_id") REFERENCES "nc_kanban_view_v2"("fk_view_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "nc_kanban_view_v2" ADD CONSTRAINT "nc_kanban_view_v2_fk_view_id_foreign" FOREIGN KEY ("fk_view_id") REFERENCES "nc_views_v2"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "nc_models_v2" ADD CONSTRAINT "nc_models_v2_base_id_foreign" FOREIGN KEY ("base_id") REFERENCES "nc_bases_v2"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "nc_models_v2" ADD CONSTRAINT "nc_models_v2_project_id_foreign" FOREIGN KEY ("project_id") REFERENCES "nc_projects_v2"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "nc_project_users_v2" ADD CONSTRAINT "nc_project_users_v2_project_id_foreign" FOREIGN KEY ("project_id") REFERENCES "nc_projects_v2"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "nc_project_users_v2" ADD CONSTRAINT "nc_project_users_v2_fk_user_id_foreign" FOREIGN KEY ("fk_user_id") REFERENCES "nc_users_v2"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "nc_shared_views_v2" ADD CONSTRAINT "nc_shared_views_v2_fk_view_id_foreign" FOREIGN KEY ("fk_view_id") REFERENCES "nc_views_v2"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "nc_sort_v2" ADD CONSTRAINT "nc_sort_v2_fk_column_id_foreign" FOREIGN KEY ("fk_column_id") REFERENCES "nc_columns_v2"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "nc_sort_v2" ADD CONSTRAINT "nc_sort_v2_fk_view_id_foreign" FOREIGN KEY ("fk_view_id") REFERENCES "nc_views_v2"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "nc_sync_source_v2" ADD CONSTRAINT "nc_sync_source_v2_project_id_foreign" FOREIGN KEY ("project_id") REFERENCES "nc_projects_v2"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "nc_sync_source_v2" ADD CONSTRAINT "nc_sync_source_v2_fk_user_id_foreign" FOREIGN KEY ("fk_user_id") REFERENCES "nc_users_v2"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "nc_teams_v2" ADD CONSTRAINT "nc_teams_v2_org_id_foreign" FOREIGN KEY ("org_id") REFERENCES "nc_orgs_v2"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "nc_team_users_v2" ADD CONSTRAINT "nc_team_users_v2_org_id_foreign" FOREIGN KEY ("org_id") REFERENCES "nc_orgs_v2"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "nc_team_users_v2" ADD CONSTRAINT "nc_team_users_v2_user_id_foreign" FOREIGN KEY ("user_id") REFERENCES "nc_users_v2"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "nc_views_v2" ADD CONSTRAINT "nc_views_v2_fk_model_id_foreign" FOREIGN KEY ("fk_model_id") REFERENCES "nc_models_v2"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "player" ADD CONSTRAINT "FK_1aad05b09bda2079429cd8ba9d8" FOREIGN KEY ("leagueTeamId") REFERENCES "team"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "settings" ADD CONSTRAINT "FK_cb5f64b730072c78ba13d5db952" FOREIGN KEY ("modifiedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "trade_item" ADD CONSTRAINT "FK_93c36c896adc55ffa2fde088079" FOREIGN KEY ("senderId") REFERENCES "team"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "trade_item" ADD CONSTRAINT "FK_1abdf634a91dc15221fecbd2535" FOREIGN KEY ("recipientId") REFERENCES "team"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "trade_item" ADD CONSTRAINT "FK_b0526160a5fca917459d481e202" FOREIGN KEY ("tradeId") REFERENCES "trade"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "trade_participant" ADD CONSTRAINT "FK_6f42978de8c286663f97f12c9dc" FOREIGN KEY ("teamId") REFERENCES "team"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "trade_participant" ADD CONSTRAINT "FK_55814676906f1f2c458fa255042" FOREIGN KEY ("tradeId") REFERENCES "trade"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "user" ADD CONSTRAINT "FK_77f62757967de516e50ff134e35" FOREIGN KEY ("teamId") REFERENCES "team"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
