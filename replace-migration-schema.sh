#!/bin/bash
# Example: sh replace-migration-schema.sh staging dev
# This would replace 'staging' with 'dev' in all migration files

# First line replaces \"dev\". with \"staging\".
# Second line returns "dev", with "staging",
# Third line returns dev. with staging.

if [[ "$OSTYPE" == "darwin"* ]]; then
  find ./dist/db/migrations/ -iname "*.js" -type f -exec sed -i '' 's/\\"'$1'\\"\./\\"'$2'\\"\./g' {} \;
  find ./dist/db/migrations/ -iname "*.js" -type f -exec sed -i '' 's/"'$1'",/"'$2'",/g' {} \;
  find ./dist/db/migrations/ -iname "*.js" -type f -exec sed -i '' 's/'$1'\./'$2'\./g' {} \;
else
  find ./dist/db/migrations/ -iname "*.js" -type f -exec sed -i 's/\\"'$1'\\"\./\\"'$2'\\"\./g' {} \;
  find ./dist/db/migrations/ -iname "*.js" -type f -exec sed -i 's/"'$1'",/"'$2'",/g' {} \;
  find ./dist/db/migrations/ -iname "*.js" -type f -exec sed -i 's/'$1'\./'$2'\./g' {} \;
fi;
