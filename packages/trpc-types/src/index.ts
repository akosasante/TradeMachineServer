// Direct exports from bundled server types for full type safety
// @server-dist is a path alias that gets replaced with ./server/ during build
export type { AppRouter } from "@server-dist/api/routes/v2/router";
export type { PublicUser } from "@server-dist/DAO/v2/UserDAO";

// Re-export useful tRPC type utilities for better IDE support
import type { inferRouterInputs, inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "@server-dist/api/routes/v2/router";

/**
 * Inferred input types for all tRPC procedures.
 *
 * @example
 * ```typescript
 * type LoginInput = RouterInputs['auth']['login']['authenticate']
 * // { email: string; password: string }
 * ```
 */
export type RouterInputs = inferRouterInputs<AppRouter>;

/**
 * Inferred output types for all tRPC procedures.
 *
 * @example
 * ```typescript
 * type LoginOutput = RouterOutputs['auth']['login']['authenticate']
 * // PublicUser
 * ```
 */
export type RouterOutputs = inferRouterOutputs<AppRouter>;
