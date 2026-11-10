# Dependency Security Remediation

## Compatibility Boundary

This remediation keeps Node 20.10, TypeScript 4.9, routing-controllers 0.9,
class-validator 0.12, class-transformer 0.3, Prisma 4, and Zod 3. It does not
attempt the framework, ORM, compiler, or runtime migrations. TypeORM receives
the within-range 0.3.31 security update, not a new major version.

Do not use `npm audit fix --force`: the current recommendations include
incompatible upgrades and downgrades of application and test dependencies.

## Changes

- Apply within-range security fixes in the lockfile.
- Constrain Jest Extended to major 3 and ts-jest to major 29 so installs do not
  pull newer tooling requiring a newer compiler or Jest major.
- Constrain nodemon to major 3 for the vulnerable update-notifier dependency.
- Update eslint-plugin-jsdoc to major 46, which supports Node 20, and replace
  its removed newline-after-description rule with tag-lines/startLines.
- Pin preview-email's mailparser dependency to 3.9.3. Later releases pull
  html-to-text 10, which requires Node >=20.19.0. This preserves the current
  runtime at the cost of retaining preview/parser advisories. Remove or revisit
  this override when the Node migration is complete.
- Preserve pre-existing SWC lockfile metadata changes and unrelated work.

## Deferred Findings

The audit snapshot during this remediation moved from 136 findings
(58 high, 9 critical) to 81 findings (23 high, 3 critical).
Counts can change as the advisory database changes.

Remaining high/critical dependency chains include routing-controllers,
class-validator/validator, multer/koa-multer, Axios/Slack, email rendering and
preview dependencies, custom-fonts-in-emails/sharp, OpenTelemetry, Faker,
and Zod. These are deferred rather than suppressed. Reassess exploitability
against actual inputs and deployment exposure before release; an audit count
is not an exploitability assessment or a guarantee of application safety.

Coordinate major changes with the existing framework and Prisma migrations.
Email rendering, uploads, telemetry startup, and tRPC validation each need
explicit regression coverage before upgrading their owning packages.

## Verification

On Node 20.10.0, dependency installation completed without engine warnings,
all locked dependency Node engine ranges accepted that runtime, and TypeScript
passed with `./node_modules/.bin/tsc --noEmit --incremental false`.

Focused tests passed: 9 suites, 134 tests, 6 snapshots. Command:

```sh
BASE_URL=http://localhost:3030 NODE_ENV=test ORM_CONFIG=local-test \
  ./node_modules/.bin/jest --config ./jest.config.js --runInBand \
  --coverage=false --forceExit \
  --testPathPattern='tests/unit/(espn/espnApi|scheduled_jobs/mlbMinorsScheduledUpdate|email/mailer|api/routes/v2/trpc)'
```

The mailer snapshots require BASE_URL; do not regenerate snapshots to accept
undefined links. Full database-backed integration and deployment checks are
still required before release. Dependency lifecycle scripts were disabled
during this remediation, so a clean install in the normal build environment
remains an additional release check.