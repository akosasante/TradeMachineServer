# Migration Plan: routing-controllers to Ts.ED

## Overview

This document outlines the plan to migrate the TradeMachineServer from routing-controllers to Ts.ED framework. Ts.ED provides a more comprehensive set of features including better dependency injection, middleware management, OpenAPI integration, and improved testing capabilities.

## Table of Contents
1. [Current Architecture Assessment](#current-architecture-assessment)
2. [Ts.ED Features Overview](#ts-ed-features-overview)
3. [Migration Strategy Options](#migration-strategy-options)
4. [Implementation Plan](#implementation-plan)
5. [Shared Components Migration](#shared-components-migration)
6. [Testing Strategy](#testing-strategy)
7. [Rollout and Deployment](#rollout-and-deployment)
8. [Monitoring and Fallback Strategy](#monitoring-and-fallback-strategy)
9. [Timeline and Resources](#timeline-and-resources)

## Current Architecture Assessment

Before migration, we need to assess the current implementation:
- Catalog all existing routes and controllers
- Identify middleware and authentication mechanisms
- Document current error handling approaches
- Review current dependency injection patterns
- Audit existing validation mechanisms

## Ts.ED Features Overview

Ts.ED offers several advantages over routing-controllers:
- Better dependency injection system using `@tsed/di`
- More comprehensive middleware support
- Native OpenAPI/Swagger integration
- More robust error handling
- Better testing utilities
- Support for multiple protocols (Express, Koa)

## Migration Strategy Options

### Option 1: Side-by-Side Servers
- Run two separate server instances, each with its own port
- Gradually migrate endpoints from old to new server
- Use a proxy (like nginx) to route traffic between servers
- **Pros**: Clear separation, independent scaling
- **Cons**: More complex infrastructure, potential consistency issues

### Option 2: Path-Based Migration (/v2)
- Run both frameworks within same Express application
- Use routing-controllers for existing endpoints and Ts.ED for /v2/* endpoints
- Gradually migrate endpoints and move them to v2
- Eventually phase out routing-controllers
- **Pros**: Simpler infrastructure, shared resources
- **Cons**: Potential conflicts between frameworks

### Option 3: Incremental, In-Place Migration
- Set up Ts.ED alongside routing-controllers in same Express app
- Migrate controllers one by one, keeping same routes
- Use feature flags to switch between implementations
- **Pros**: Seamless to clients, no versioning needed
- **Cons**: More complex code, potential conflicts

### Recommended Approach

We recommend **Option 2: Path-Based Migration** for the following reasons:
1. Clearer separation of concerns during migration
2. Ability to run both frameworks side-by-side without additional infrastructure
3. Clear versioning for API consumers
4. Simpler rollback strategy
5. Gradual adoption path

## Implementation Plan

### Phase 1: Setup and Infrastructure
1. Install Ts.ED dependencies
2. Configure basic Ts.ED server under /v2 path
3. Set up shared middleware and authentication
4. Configure OpenAPI documentation
5. Create sample controller to verify setup

### Phase 2: Core Services Migration
1. Identify core services to migrate first
2. Implement new controllers in Ts.ED
3. Setup proper dependency injection for services
4. Implement necessary DTOs (Data Transfer Objects)
5. Update validation using Ts.ED validation pipe

### Phase 3: Incremental Endpoint Migration
1. Prioritize endpoints by usage/importance
2. Create corresponding Ts.ED controllers
3. Implement comprehensive tests
4. Update client to use new endpoints
5. Monitor for issues

### Phase 4: Cleanup and Finalization
1. Remove routing-controllers dependencies
2. Clean up deprecated code
3. Consolidate documentation
4. Finalize OpenAPI specs
5. Consider removing /v2 prefix once migration is complete

## Shared Components Migration

### Authentication
1. Implement Ts.ED authentication guards
2. Ensure JWT/session handling works identically
3. Migrate role-based access controls

### Error Handling
1. Create custom error filters in Ts.ED
2. Ensure error responses match existing format

### Validation
1. Move from class-validator to Ts.ED validation pipes
2. Ensure validation error messages are consistent

### Middleware
1. Convert Express middleware to Ts.ED middleware
2. Ensure middleware execution order is preserved

## Testing Strategy

1. Create parallel test suite for Ts.ED controllers
2. Ensure all endpoints have feature parity
3. Implement integration tests for both implementations
4. Consider A/B testing for critical endpoints

## Rollout and Deployment

1. Deploy with both frameworks enabled
2. Gradually introduce Ts.ED endpoints to clients
3. Monitor for issues and performance differences
4. Once stable, deprecate routing-controllers endpoints

## Monitoring and Fallback Strategy

1. Implement comprehensive logging for both implementations
2. Set up alerting for error rate differences
3. Create fallback mechanism to routing-controllers if issues arise
4. Monitor performance metrics for both frameworks

## Timeline and Resources

### Estimated Timeline
- Phase 1 (Setup): 1-2 weeks
- Phase 2 (Core Services): 2-3 weeks
- Phase 3 (Incremental Migration): 4-8 weeks (depending on codebase size)
- Phase 4 (Cleanup): 1-2 weeks

### Resources Required
- Dedicated developer(s) for migration work
- Testing resources for validation
- Documentation updates
- Client coordination for endpoint changes

## Code Example: Ts.ED Basic Setup

```typescript
import {Configuration, Inject} from '@tsed/di';
import {PlatformApplication} from '@tsed/common';
import express from 'express';
import path from 'path';
import {Server} from './server';

@Configuration({
  rootDir: __dirname,
  mount: {
    '/v2/api': [`${__dirname}/controllers/**/*.ts`]
  },
  componentsScan: [
    `${__dirname}/services/**/*.ts`,
    `${__dirname}/middleware/**/*.ts`
  ],
  middlewares: [
    'cors',
    'cookie-parser',
    'compression',
    'method-override',
    'json-parser',
    {use: 'urlencoded-parser', options: {extended: true}}
  ]
})
export class App {
  @Inject()
  app: PlatformApplication;

  @Configuration()
  settings: Configuration;

  $beforeRoutesInit(): void {
    this.app
      .use(express.json())
      .use(express.urlencoded({extended: true}));
  }
}

async function bootstrap() {
  try {
    const server = await Server.bootstrap(App);
    await server.listen();
    console.log('Server started...');
  } catch (error) {
    console.error(error);
  }
}

bootstrap();
```

## Conclusion

Migrating from routing-controllers to Ts.ED represents a significant architectural improvement for the TradeMachineServer. By following a path-based migration strategy, we can minimize disruption while gradually introducing the new framework. The comprehensive features of Ts.ED will provide better long-term maintainability, improved developer experience, and more robust API documentation.