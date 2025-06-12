/*
  Warnings:

  - You are about to drop the `nc_acl` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `nc_api_tokens` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `nc_audit` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `nc_audit_v2` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `nc_bases_v2` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `nc_col_formula_v2` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `nc_col_lookup_v2` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `nc_col_relations_v2` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `nc_col_rollup_v2` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `nc_col_select_options_v2` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `nc_columns_v2` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `nc_cron` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `nc_disabled_models_for_role` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `nc_disabled_models_for_role_v2` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `nc_evolutions` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `nc_filter_exp_v2` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `nc_form_view_columns_v2` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `nc_form_view_v2` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `nc_gallery_view_columns_v2` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `nc_gallery_view_v2` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `nc_grid_view_columns_v2` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `nc_grid_view_v2` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `nc_hook_logs_v2` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `nc_hooks` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `nc_hooks_v2` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `nc_kanban_view_columns_v2` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `nc_kanban_view_v2` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `nc_loaders` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `nc_migrations` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `nc_models` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `nc_models_v2` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `nc_orgs_v2` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `nc_plugins` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `nc_plugins_v2` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `nc_project_users_v2` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `nc_projects` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `nc_projects_users` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `nc_projects_v2` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `nc_relations` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `nc_resolvers` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `nc_roles` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `nc_routes` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `nc_rpc` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `nc_shared_bases` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `nc_shared_views` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `nc_shared_views_v2` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `nc_sort_v2` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `nc_store` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `nc_sync_logs_v2` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `nc_sync_source_v2` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `nc_team_users_v2` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `nc_teams_v2` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `nc_users_v2` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `nc_views_v2` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `oban_jobs` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `xc_knex_migrations` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `xc_knex_migrations_lock` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `xc_knex_migrationsv2` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `xc_knex_migrationsv2_lock` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "nc_audit_v2" DROP CONSTRAINT "nc_audit_v2_base_id_foreign";

-- DropForeignKey
ALTER TABLE "nc_audit_v2" DROP CONSTRAINT "nc_audit_v2_fk_model_id_foreign";

-- DropForeignKey
ALTER TABLE "nc_audit_v2" DROP CONSTRAINT "nc_audit_v2_project_id_foreign";

-- DropForeignKey
ALTER TABLE "nc_bases_v2" DROP CONSTRAINT "nc_bases_v2_project_id_foreign";

-- DropForeignKey
ALTER TABLE "nc_col_formula_v2" DROP CONSTRAINT "nc_col_formula_v2_fk_column_id_foreign";

-- DropForeignKey
ALTER TABLE "nc_col_lookup_v2" DROP CONSTRAINT "nc_col_lookup_v2_fk_column_id_foreign";

-- DropForeignKey
ALTER TABLE "nc_col_lookup_v2" DROP CONSTRAINT "nc_col_lookup_v2_fk_lookup_column_id_foreign";

-- DropForeignKey
ALTER TABLE "nc_col_lookup_v2" DROP CONSTRAINT "nc_col_lookup_v2_fk_relation_column_id_foreign";

-- DropForeignKey
ALTER TABLE "nc_col_relations_v2" DROP CONSTRAINT "nc_col_relations_v2_fk_child_column_id_foreign";

-- DropForeignKey
ALTER TABLE "nc_col_relations_v2" DROP CONSTRAINT "nc_col_relations_v2_fk_column_id_foreign";

-- DropForeignKey
ALTER TABLE "nc_col_relations_v2" DROP CONSTRAINT "nc_col_relations_v2_fk_mm_child_column_id_foreign";

-- DropForeignKey
ALTER TABLE "nc_col_relations_v2" DROP CONSTRAINT "nc_col_relations_v2_fk_mm_model_id_foreign";

-- DropForeignKey
ALTER TABLE "nc_col_relations_v2" DROP CONSTRAINT "nc_col_relations_v2_fk_mm_parent_column_id_foreign";

-- DropForeignKey
ALTER TABLE "nc_col_relations_v2" DROP CONSTRAINT "nc_col_relations_v2_fk_parent_column_id_foreign";

-- DropForeignKey
ALTER TABLE "nc_col_relations_v2" DROP CONSTRAINT "nc_col_relations_v2_fk_related_model_id_foreign";

-- DropForeignKey
ALTER TABLE "nc_col_rollup_v2" DROP CONSTRAINT "nc_col_rollup_v2_fk_column_id_foreign";

-- DropForeignKey
ALTER TABLE "nc_col_rollup_v2" DROP CONSTRAINT "nc_col_rollup_v2_fk_relation_column_id_foreign";

-- DropForeignKey
ALTER TABLE "nc_col_rollup_v2" DROP CONSTRAINT "nc_col_rollup_v2_fk_rollup_column_id_foreign";

-- DropForeignKey
ALTER TABLE "nc_col_select_options_v2" DROP CONSTRAINT "nc_col_select_options_v2_fk_column_id_foreign";

-- DropForeignKey
ALTER TABLE "nc_columns_v2" DROP CONSTRAINT "nc_columns_v2_fk_model_id_foreign";

-- DropForeignKey
ALTER TABLE "nc_disabled_models_for_role_v2" DROP CONSTRAINT "nc_disabled_models_for_role_v2_fk_view_id_foreign";

-- DropForeignKey
ALTER TABLE "nc_filter_exp_v2" DROP CONSTRAINT "nc_filter_exp_v2_fk_column_id_foreign";

-- DropForeignKey
ALTER TABLE "nc_filter_exp_v2" DROP CONSTRAINT "nc_filter_exp_v2_fk_hook_id_foreign";

-- DropForeignKey
ALTER TABLE "nc_filter_exp_v2" DROP CONSTRAINT "nc_filter_exp_v2_fk_parent_id_foreign";

-- DropForeignKey
ALTER TABLE "nc_filter_exp_v2" DROP CONSTRAINT "nc_filter_exp_v2_fk_view_id_foreign";

-- DropForeignKey
ALTER TABLE "nc_form_view_columns_v2" DROP CONSTRAINT "nc_form_view_columns_v2_fk_column_id_foreign";

-- DropForeignKey
ALTER TABLE "nc_form_view_columns_v2" DROP CONSTRAINT "nc_form_view_columns_v2_fk_view_id_foreign";

-- DropForeignKey
ALTER TABLE "nc_form_view_v2" DROP CONSTRAINT "nc_form_view_v2_fk_view_id_foreign";

-- DropForeignKey
ALTER TABLE "nc_gallery_view_columns_v2" DROP CONSTRAINT "nc_gallery_view_columns_v2_fk_column_id_foreign";

-- DropForeignKey
ALTER TABLE "nc_gallery_view_columns_v2" DROP CONSTRAINT "nc_gallery_view_columns_v2_fk_view_id_foreign";

-- DropForeignKey
ALTER TABLE "nc_gallery_view_v2" DROP CONSTRAINT "nc_gallery_view_v2_fk_cover_image_col_id_foreign";

-- DropForeignKey
ALTER TABLE "nc_gallery_view_v2" DROP CONSTRAINT "nc_gallery_view_v2_fk_view_id_foreign";

-- DropForeignKey
ALTER TABLE "nc_grid_view_columns_v2" DROP CONSTRAINT "nc_grid_view_columns_v2_fk_column_id_foreign";

-- DropForeignKey
ALTER TABLE "nc_grid_view_columns_v2" DROP CONSTRAINT "nc_grid_view_columns_v2_fk_view_id_foreign";

-- DropForeignKey
ALTER TABLE "nc_grid_view_v2" DROP CONSTRAINT "nc_grid_view_v2_fk_view_id_foreign";

-- DropForeignKey
ALTER TABLE "nc_hooks_v2" DROP CONSTRAINT "nc_hooks_v2_fk_model_id_foreign";

-- DropForeignKey
ALTER TABLE "nc_kanban_view_columns_v2" DROP CONSTRAINT "nc_kanban_view_columns_v2_fk_column_id_foreign";

-- DropForeignKey
ALTER TABLE "nc_kanban_view_columns_v2" DROP CONSTRAINT "nc_kanban_view_columns_v2_fk_view_id_foreign";

-- DropForeignKey
ALTER TABLE "nc_kanban_view_v2" DROP CONSTRAINT "nc_kanban_view_v2_fk_view_id_foreign";

-- DropForeignKey
ALTER TABLE "nc_models_v2" DROP CONSTRAINT "nc_models_v2_base_id_foreign";

-- DropForeignKey
ALTER TABLE "nc_models_v2" DROP CONSTRAINT "nc_models_v2_project_id_foreign";

-- DropForeignKey
ALTER TABLE "nc_project_users_v2" DROP CONSTRAINT "nc_project_users_v2_fk_user_id_foreign";

-- DropForeignKey
ALTER TABLE "nc_project_users_v2" DROP CONSTRAINT "nc_project_users_v2_project_id_foreign";

-- DropForeignKey
ALTER TABLE "nc_shared_views_v2" DROP CONSTRAINT "nc_shared_views_v2_fk_view_id_foreign";

-- DropForeignKey
ALTER TABLE "nc_sort_v2" DROP CONSTRAINT "nc_sort_v2_fk_column_id_foreign";

-- DropForeignKey
ALTER TABLE "nc_sort_v2" DROP CONSTRAINT "nc_sort_v2_fk_view_id_foreign";

-- DropForeignKey
ALTER TABLE "nc_sync_source_v2" DROP CONSTRAINT "nc_sync_source_v2_fk_user_id_foreign";

-- DropForeignKey
ALTER TABLE "nc_sync_source_v2" DROP CONSTRAINT "nc_sync_source_v2_project_id_foreign";

-- DropForeignKey
ALTER TABLE "nc_team_users_v2" DROP CONSTRAINT "nc_team_users_v2_org_id_foreign";

-- DropForeignKey
ALTER TABLE "nc_team_users_v2" DROP CONSTRAINT "nc_team_users_v2_user_id_foreign";

-- DropForeignKey
ALTER TABLE "nc_teams_v2" DROP CONSTRAINT "nc_teams_v2_org_id_foreign";

-- DropForeignKey
ALTER TABLE "nc_views_v2" DROP CONSTRAINT "nc_views_v2_fk_model_id_foreign";

-- DropTable
DROP TABLE "nc_acl";

-- DropTable
DROP TABLE "nc_api_tokens";

-- DropTable
DROP TABLE "nc_audit";

-- DropTable
DROP TABLE "nc_audit_v2";

-- DropTable
DROP TABLE "nc_bases_v2";

-- DropTable
DROP TABLE "nc_col_formula_v2";

-- DropTable
DROP TABLE "nc_col_lookup_v2";

-- DropTable
DROP TABLE "nc_col_relations_v2";

-- DropTable
DROP TABLE "nc_col_rollup_v2";

-- DropTable
DROP TABLE "nc_col_select_options_v2";

-- DropTable
DROP TABLE "nc_columns_v2";

-- DropTable
DROP TABLE "nc_cron";

-- DropTable
DROP TABLE "nc_disabled_models_for_role";

-- DropTable
DROP TABLE "nc_disabled_models_for_role_v2";

-- DropTable
DROP TABLE "nc_evolutions";

-- DropTable
DROP TABLE "nc_filter_exp_v2";

-- DropTable
DROP TABLE "nc_form_view_columns_v2";

-- DropTable
DROP TABLE "nc_form_view_v2";

-- DropTable
DROP TABLE "nc_gallery_view_columns_v2";

-- DropTable
DROP TABLE "nc_gallery_view_v2";

-- DropTable
DROP TABLE "nc_grid_view_columns_v2";

-- DropTable
DROP TABLE "nc_grid_view_v2";

-- DropTable
DROP TABLE "nc_hook_logs_v2";

-- DropTable
DROP TABLE "nc_hooks";

-- DropTable
DROP TABLE "nc_hooks_v2";

-- DropTable
DROP TABLE "nc_kanban_view_columns_v2";

-- DropTable
DROP TABLE "nc_kanban_view_v2";

-- DropTable
DROP TABLE "nc_loaders";

-- DropTable
DROP TABLE "nc_migrations";

-- DropTable
DROP TABLE "nc_models";

-- DropTable
DROP TABLE "nc_models_v2";

-- DropTable
DROP TABLE "nc_orgs_v2";

-- DropTable
DROP TABLE "nc_plugins";

-- DropTable
DROP TABLE "nc_plugins_v2";

-- DropTable
DROP TABLE "nc_project_users_v2";

-- DropTable
DROP TABLE "nc_projects";

-- DropTable
DROP TABLE "nc_projects_users";

-- DropTable
DROP TABLE "nc_projects_v2";

-- DropTable
DROP TABLE "nc_relations";

-- DropTable
DROP TABLE "nc_resolvers";

-- DropTable
DROP TABLE "nc_roles";

-- DropTable
DROP TABLE "nc_routes";

-- DropTable
DROP TABLE "nc_rpc";

-- DropTable
DROP TABLE "nc_shared_bases";

-- DropTable
DROP TABLE "nc_shared_views";

-- DropTable
DROP TABLE "nc_shared_views_v2";

-- DropTable
DROP TABLE "nc_sort_v2";

-- DropTable
DROP TABLE "nc_store";

-- DropTable
DROP TABLE "nc_sync_logs_v2";

-- DropTable
DROP TABLE "nc_sync_source_v2";

-- DropTable
DROP TABLE "nc_team_users_v2";

-- DropTable
DROP TABLE "nc_teams_v2";

-- DropTable
DROP TABLE "nc_users_v2";

-- DropTable
DROP TABLE "nc_views_v2";

-- DropTable
DROP TABLE "oban_jobs";

-- DropTable
DROP TABLE "xc_knex_migrations";

-- DropTable
DROP TABLE "xc_knex_migrations_lock";

-- DropTable
DROP TABLE "xc_knex_migrationsv2";

-- DropTable
DROP TABLE "xc_knex_migrationsv2_lock";
