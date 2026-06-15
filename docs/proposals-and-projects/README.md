# Proposals & Projects

Design proposals, migration plans, and analyses for TradeMachineServer. These are more exploratory and longer-lived than [ADRs](../adr/README.md) — some are in-progress, some partially adopted, some historical. When a proposal and an ADR disagree about what was actually decided, **the ADR is authoritative.**

## Index

### Trade features
| Doc | Summary |
|---|---|
| [trade-builder-api-proposal.md](./trade-builder-api-proposal.md) | Backend / v2 DAO proposal for the new Trade Request builder UI — what to add, what existing DAOs cover, and what's deferred. Decided scope is recorded in [ADR 0003](../adr/0003-trade-builder-v2-daos.md). |

### Dockerization & deployment
| Doc | Summary |
|---|---|
| [summary.md](./summary.md) | TradeMachine Server dockerization plan — high-level summary / entry point for the Docker effort. |
| [docker-deployment-plan.md](./docker-deployment-plan.md) | Docker deployment plan for the server. |
| [docker-setup-and-deployment-documentation.md](./docker-setup-and-deployment-documentation.md) | Docker setup and deployment documentation. |
| [postgres_redis_docker_migration.md](./postgres_redis_docker_migration.md) | Plan for migrating PostgreSQL and Redis to Docker. |
| [server-setup-guide.md](./server-setup-guide.md) | Server setup guide for Docker deployment. |
| [advanced-github-actions-droplet.md](./advanced-github-actions-droplet.md) | Advanced GitHub Actions deployment to a DigitalOcean droplet. |
| [health-check-endpoint.ts](./health-check-endpoint.ts) | Reference implementation of a health-check endpoint for Docker health checks (intended for `src/api/routes/`). |
| [github-actions-workflows/](./github-actions-workflows/) | Sample GitHub Actions workflow YAML (`docker-build-publish.yml`, `docker-deploy.yml`) supporting the Docker deployment plan. |

### Migrations & improvements
| Doc | Summary |
|---|---|
| [ts-ed-migration-plan.md](./ts-ed-migration-plan.md) | Migration plan from `routing-controllers` to Ts.ED for the API framework. |
| [email-system-analysis.md](./email-system-analysis.md) | Email system analysis & recommendations. |
| [Potential_Improvements.md](./Potential_Improvements.md) | Grab-bag of potential improvements to the codebase/platform. |

## Adding a doc

Drop the file in this directory and **add a row to the appropriate table above** (create a new section if none fits). If the proposal leads to a firm decision, capture that decision as an [ADR](../adr/README.md) and cross-link the two.
