#!/bin/bash
# Example: sh replace-migration-schema.sh staging dev
# This would replace staging. with dev. in all migration files

find ./dist/db/migrations/ -iname "*.js" -type f -exec sed -i '' 's/\\"'$1'\\"./\\"'$2'\\"./g' {} \;
