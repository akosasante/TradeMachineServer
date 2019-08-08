CREATE USER :user with password ':password';
CREATE DATABASE :db_name owner :user;
\connect :db_name;
CREATE SCHEMA test AUTHORIZATION :user;
