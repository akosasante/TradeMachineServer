import { router } from './trpc';
import { authRouter } from './routers/auth';

// Main tRPC router - this is what gets exported to the types package
export const appRouter = router({
    auth: authRouter,
    // Future routers will go here:
    // trades: tradeRouter,
    // teams: teamRouter,
    // etc.
});

export type AppRouter = typeof appRouter;