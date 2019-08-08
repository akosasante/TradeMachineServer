CREATE USER :user with password ':password';
CREATE DATABASE :db_name owner :user;
-- SELECT * FROM pg_available_extensions;
\connect :db_name;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
-- \df
CREATE SCHEMA test AUTHORIZATION :user;
