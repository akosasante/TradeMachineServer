MIGRATION_COMMAND := migration:generate

# List any targets that are not an actual file here to ensure they are always run
.PHONY: help test-ci test-unit test-integration test-update-snapshots test-local
.PHONY: disable-logs disable-db-logging test-unit-no-logs test-integration-no-logs test-local-no-logs
.PHONY: test-unit-no-db-logging test-integration-no-db-logging test-local-no-db-logging
.PHONY: watch-ts-files watch-js-server dev-server watch-js-debug-server debug-server
.PHONY: lint lint-fix compile-ts copy-email-templates build serve typecheck
.PHONY: generate-migration run-migration revert-migration

help: ## show make commands
	@echo "\n"
	@echo "Welcome to the Trade Machine server repo. The following are the available Make commands:"
	@echo "==========================================================="
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-30s\033[0m %s\n", $$1, $$2}'

# |----------- TESTING SCRIPTS ---------|
test-ci: ## run tests using CI config, and no logging
  NODE_ENV=test \
  jest --config ./jest.ci-config.js \
  --detectOpenHandles --runInBand --silent --bail --forceExit --ci

test-unit: ## run tests using local testing config, only run tests in `unit` folder, run in parallel
	NODE_ENV=test \
	jest --config ./jest.config.js \
	--detectOpenHandles --bail --forceExit --testPathPattern=unit/

test-integration: ## run tests using local testing config, only run tests in `integration` folder, run tests serially
	NODE_ENV=test \
	jest --config ./jest.config.js \
	--detectOpenHandles --runInBand --bail --forceExit --testPathPattern=integration/

test-update-snapshots: ## update the jest snapshots (currently only targeted to mailer folder)
	NODE_ENV=test \
	jest --config ./jest.ci-config.js \
	--detectOpenHandles --runInBand --silent --bail --forceExit --ci --testPathPattern=mailer --update-snapshot

test-local: test-unit test-integration ## run unit, then integration tests using local config

disable-logs: #! do not log to any output
	export ENABLE_LOGS = false

disable-db-logging: #! exclude db logs from output
	export DB_LOGS = false

test-unit-no-logs: disable-logs test-unit ## local unit tests with no logging
test-integration-no-logs: disable-logs test-integration ## local integration tests with no logging
test-local-no-logs: disable-logs test-local ## run local test suites with no logging

test-unit-no-db-logging: disable-db-logging test-unit ## local unit tests with no database logging
test-integration-no-db-logging: disable-db-logging test-integration ## local integration tests with no database logging
test-local-no-db-logging: disable-db-logging test-local ## run local test suites with no database logging

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

watch-js-debug-server: ## Run the server.js file with DEBUG flags and watch for js changes
	NODE_ENV=development \
	nodemon $NODE_DEBUG_OPTION --inspect ./dist/server.js \
	-- -r dotenv/config

debug-server: ## Watch for ts file changes, and js file changes, run server with DEBUG flags
	npx concurrently $NODE_DEBUG_OPTION -k \
	-p "[{name} - {time}]" \
	-n "TypeScript,Node" \
	-c "cyan.bold,green.bold" \
	"make watch-ts-files" "make watch-js-debug-server"

lint: ## Run typescript linting
	npx tslint -c tslint.json -p tsconfig.json -t stylish

lint-fix: ## Attempt to fix any typescript lint errors
	npx tslint -c tslint.json -p tsconfig.json -t stylish --fix

# |----------- BUILD AND SERVE SCRIPTS ---------|
compile-ts: ## Compile typescript
	npx tsc

copy-email-templates: ## Copy over email templates from src to dist
	mkdir -p dist/email/templates && cp -r src/email/templates dist/email/

build: compile-ts copy-email-templates ## Build steps required to release the server app: compile typescript, and copy email templates directory

serve: ## Serve the node server statically (no restarting on file changes)
	node -r dotenv/config ./dist/server.js

typecheck: ## Check for type errors that would caausee faiilures to build
	tsc --noEmit --incremental false

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
