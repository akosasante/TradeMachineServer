# List any targets that are not an actual file here to ensure they are always run
.PHONY: help
.PHONY: test-ci test-ci-unit test-ci-integration test-unit test-integration test-update-snapshots test-local
.PHONY: watch-ts-files watch-js-server dev-server dev-tsx watch-js-debug-server debug-server debug-tsx
.PHONY: docker-dev-up docker-dev-down docker-dev-logs docker-dev-shell docker-dev-restart docker-dev-rebuild
.PHONY: docker-infrastructure-up docker-infrastructure-down docker-infrastructure-logs docker-prod-test docker-full-setup
.PHONY: lint lint-fix format compile-ts copy-email-templates build serve typecheck fullcheck
.PHONY: generate-migration run-migration revert-migration

help: ## show make commands
	@echo "\n"
	@echo "Welcome to the Trade Machine server repo. The following are the available Make commands:"
	@echo "==========================================================="
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-30s\033[0m %s\n", $$1, $$2}'

# |----------- TESTING SCRIPTS ---------|
test-ci: ## run tests using CI config, and no logging
	NODE_ENV=test ORM_CONFIG=test PG_SCHEMA=test \
	npx jest --config ./jest.ci-config.js \
	--detectOpenHandles --runInBand --silent --bail --forceExit --ci --testTimeout=25000

test-ci-unit: ## run tests using CI config, and no logging
	NODE_ENV=test ORM_CONFIG=test PG_SCHEMA=test \
	npx jest --config ./jest.ci-config.js \
	--detectOpenHandles --runInBand --silent --bail --forceExit --ci --testPathPattern=unit/ --testTimeout=25000

test-ci-integration: ## run tests using CI config, and no logging
	NODE_ENV=test ORM_CONFIG=test PG_SCHEMA=test \
	npx jest --config ./jest.ci-config.js \
	--detectOpenHandles --runInBand --silent --bail --forceExit --ci --testPathPattern=integration/ --testTimeout=25000

test-unit: ## run tests using local testing config, only run tests in `unit` folder, run in parallel
	@read -r -p $$'\e[4m\e[96m Do you want to enable logging? [Y/n]\e[0m: ' GENERAL_LOGGING_ENABLED; \
	read -r -p $$'\e[4m\e[96m Do you want to enable database logging? [Y/n]\e[0m: ' DB_LOGGING_ENABLED; \
	if [[ $$GENERAL_LOGGING_ENABLED = '' || $$GENERAL_LOGGING_ENABLED = 'y' || $$GENERAL_LOGGING_ENABLED = 'Y' ]]; \
	then \
	  export ENABLE_LOGS=true; \
  	else \
  	  export ENABLE_LOGS=false; \
  	fi; \
	if [[ $$DB_LOGGING_ENABLED = '' || $$DB_LOGGING_ENABLED = 'y' || $$DB_LOGGING_ENABLED = 'Y' ]]; \
	then \
	  export DB_LOGS=true; \
	else \
	  export DB_LOGS=false; \
	fi; \
	NODE_ENV=test ORM_CONFIG=local-test \
	npx jest --config ./jest.config.js \
	--detectOpenHandles --bail --forceExit --testPathPattern=unit/

test-integration: ## run tests using local testing config, only run tests in `integration` folder, run tests serially
	@read -r -p $$'\e[4m\e[96m Do you want to enable logging? [Y/n]\e[0m: ' GENERAL_LOGGING_ENABLED; \
	read -r -p $$'\e[4m\e[96m Do you want to enable database logging? [Y/n]\e[0m: ' DB_LOGGING_ENABLED; \
	if [[ $$GENERAL_LOGGING_ENABLED = '' || $$GENERAL_LOGGING_ENABLED = 'y' || $$GENERAL_LOGGING_ENABLED = 'Y' ]]; \
	then \
	  export ENABLE_LOGS=true; \
  	else \
  	  export ENABLE_LOGS=false; \
  	fi; \
	if [[ $$DB_LOGGING_ENABLED = '' || $$DB_LOGGING_ENABLED = 'y' || $$DB_LOGGING_ENABLED = 'Y' ]]; \
	then \
	  export DB_LOGS=true; \
	else \
	  export DB_LOGS=false; \
	fi; \
	NODE_ENV=test ORM_CONFIG=local-test \
	npx jest --config ./jest.config.js \
	--detectOpenHandles --runInBand --bail --forceExit --testPathPattern=integration/ --testTimeout=25000

test-update-snapshots: ## update the jest snapshots (currently only targeted to mailer folder)
	NODE_ENV=test ORM_CONFIG=local-test \
	npx jest --config ./jest.ci-config.js \
	--detectOpenHandles --runInBand --silent --bail --forceExit --ci --testPathPattern=mailer --update-snapshot

test-watch: ## Watch for changes and run tests for git changed files
	@read -r -p $$'\e[4m\e[96m Do you want to enable logging? [Y/n]\e[0m: ' GENERAL_LOGGING_ENABLED; \
	read -r -p $$'\e[4m\e[96m Do you want to enable database logging? [Y/n]\e[0m: ' DB_LOGGING_ENABLED; \
	if [[ $$GENERAL_LOGGING_ENABLED = '' || $$GENERAL_LOGGING_ENABLED = 'y' || $$GENERAL_LOGGING_ENABLED = 'Y' ]]; \
	then \
	  export ENABLE_LOGS=true; \
  	else \
  	  export ENABLE_LOGS=false; \
  	fi; \
	if [[ $$DB_LOGGING_ENABLED = '' || $$DB_LOGGING_ENABLED = 'y' || $$DB_LOGGING_ENABLED = 'Y' ]]; \
	then \
	  export DB_LOGS=true; \
	else \
	  export DB_LOGS=false; \
	fi; \
	NODE_ENV=test ORM_CONFIG=local-test \
	npx jest --watch --config ./jest.config.js

test-file: ## Test a specific file
	@read -r -p $$'\e[4m\e[96m Exact file name to run: ' PATH_NAME; \
	read -r -p $$'\e[4m\e[96m Do you want to enable logging? [Y/n]\e[0m: ' GENERAL_LOGGING_ENABLED; \
	read -r -p $$'\e[4m\e[96m Do you want to enable database logging? [Y/n]\e[0m: ' DB_LOGGING_ENABLED; \
	if [[ $$GENERAL_LOGGING_ENABLED = '' || $$GENERAL_LOGGING_ENABLED = 'y' || $$GENERAL_LOGGING_ENABLED = 'Y' ]]; \
	then \
	  export ENABLE_LOGS=true; \
  	else \
  	  export ENABLE_LOGS=false; \
  	fi; \
	if [[ $$DB_LOGGING_ENABLED = '' || $$DB_LOGGING_ENABLED = 'y' || $$DB_LOGGING_ENABLED = 'Y' ]]; \
	then \
	  export DB_LOGS=true; \
	else \
	  export DB_LOGS=false; \
	fi; \
	NODE_ENV=test ORM_CONFIG=local-test \
	npx jest --watch --runTestsByPath $$PATH_NAME --config ./jest.config.js

test-local: test-unit test-integration ## run unit, then integration tests using local config

# |----------- LOCAL DEV SCRIPTS ---------|
watch-ts-files: ## Watch tsconfig input files and compile typescript to javascript files
	npx tsc --watch

watch-js-server: ## Run the server.js file, and restart whenever there are changes to the dist/*.js files
	NODE_ENV=development \
	npx nodemon --watch dist -- -r dotenv/config ./dist/server.js

dev-server: ## Watch typescript files for changes, incrementally compile. While watching javascript files for changes, restart JS server
	npx concurrently -k \
	-p "[{name} - {time}]" \
	-n "TS-Compile,Server" \
	-c "cyan.bold,green.bold" \
	"make watch-ts-files" "make watch-js-server"

dev-tsx: ## Modern dev server using tsx with hot reloading (no compilation step needed)
	npx tsx watch --clear-screen=false src/server.ts

watch-js-debug-server: ## Run the server.js file with DEBUG flags and watch for js changes
	NODE_ENV=development \
	npx nodemon $NODE_DEBUG_OPTION --inspect ./dist/server.js \
	-- -r dotenv/config

debug-server: ## Watch for ts file changes, and js file changes, run server with DEBUG flags
	npx concurrently $NODE_DEBUG_OPTION -k \
	-p "[{name} - {time}]" \
	-n "TypeScript,Node" \
	-c "cyan.bold,green.bold" \
	"make watch-ts-files" "make watch-js-debug-server"

debug-tsx: ## Debug server using tsx with hot reloading and inspect mode
	npx tsx watch --inspect --clear-screen=false src/server.ts

# |----------- DOCKER DEV SCRIPTS ---------|
docker-dev-up: ## Start Docker development environment with hot reloading (requires shared infrastructure)
	docker-compose up -d

docker-dev-down: ## Stop Docker development environment
	docker-compose down

docker-dev-logs: ## Show logs from Docker development environment
	docker-compose logs -f app

docker-dev-shell: ## Open shell in Docker development container
	docker-compose exec app bash

docker-dev-restart: ## Restart Docker development container
	docker-compose restart app

docker-dev-rebuild: ## Rebuild and restart Docker development environment
	docker-compose down && docker-compose build --no-cache && docker-compose up -d

docker-infrastructure-up: ## Start shared infrastructure (PostgreSQL, Redis, monitoring)
	cd .. && docker-compose -f docker-compose.shared.yml up -d

docker-infrastructure-down: ## Stop shared infrastructure
	cd .. && docker-compose -f docker-compose.shared.yml down

docker-infrastructure-logs: ## Show infrastructure logs
	cd .. && docker-compose -f docker-compose.shared.yml logs -f

docker-prod-test: ## Test production Docker build locally
	docker-compose --profile production up --build

docker-full-setup: ## Complete Docker setup: infrastructure + dev environment
	make docker-infrastructure-up && sleep 10 && make docker-dev-up

lint: ## Run typescript linting
	npx eslint --quiet . --ext .ts,.tsx

lint-fix: ## Attempt to fix any typescript lint errors
	npx eslint . --ext .ts,.tsx --fix

format: ## Reformat all files with Prettier (via ESLint)
	$(MAKE) lint-fix

# |----------- BUILD AND SERVE SCRIPTS ---------|
compile-ts: ## Compile typescript
	npx tsc

copy-email-templates: ## Copy over email templates from src to dist
	mkdir -p dist/email/templates && cp -r src/email/templates dist/email/

build: compile-ts copy-email-templates ## Build steps required to release the server app: compile typescript, and copy email templates directory

serve: ## Serve the node server statically (no restarting on file changes)
	node -r dotenv/config ./dist/server.js

typecheck: ## Check for type errors that would cause failures to build
	npx tsc --noEmit --incremental false

fullcheck: lint-fix typecheck ## Run all code quality checks (lint, format, typecheck)

# |----------- DATABASE MIGRATION SCRIPTS ---------|
generate-migration: ## Generate a new migration file with name=MIGRATION_NAME and using config for ENV
	@read -r -p $$'\e[4m\e[96m Please enter the environment/config name to use (default: development)\e[0m: ' ENV; \
  	read -r -p $$'\e[4m\e[96m Please enter migration name (required)\e[0m: ' MIGRATION_NAME; \
	if [[ $$ENV = '' ]]; \
	then \
	  export SELECTED_ENV=development; \
  	else \
  	  export SELECTED_ENV=$$ENV; \
  	fi; \
	if [[ $$MIGRATION_NAME = '' ]]; \
	then \
	  echo "A name is required"; exit 1; \
	else \
	  export SELECTED_NAME=$$MIGRATION_NAME; \
	fi; \
  	npx typeorm migration:generate -f ormconfig -c "$$SELECTED_ENV" -n "$$SELECTED_NAME"

run-migration: ## Run all unapplied migration files using config file=ENV
	@read -r -p "please enter the environment/config name to use (default: development): " ENV; \
	if [[ $$ENV = '' ]]; \
	then \
	  npx typeorm migration:run -f ormconfig -c development; \
  	else \
  	  npx typeorm migration:run -f ormconfig -c $$ENV; \
  	fi

revert-migration: ## Revert the most recently applied migration using config file=ENV
	@read -r -p "please enter the environment/config name to use (default: development): " ENV; \
	if [[ $$ENV = '' ]]; \
	then \
	  npx typeorm migration:revert -f ormconfig -c development; \
  	else \
  	  npx typeorm migration:revert -f ormconfig -c $$ENV; \
  	fi

prisma-migrate-test:
	@export $$(grep -v '^#' tests/.env | xargs) && npx prisma migrate deploy

prisma-migrate:
	@export $$(grep -v '^#' .env | xargs) && npx prisma migrate deploy