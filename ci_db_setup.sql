CREATE USER :user with password ':password';
CREATE DATABASE :db_name owner :user;
SELECT * FROM pg_available_extensions;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
\connect :db_name;
CREATE SCHEMA test AUTHORIZATION :user;
