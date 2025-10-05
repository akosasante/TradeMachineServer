import { router } from "./trpcHelpers";
import { authRouter } from "./routers/auth";
import { clientRouter } from "./routers/client";

// Main tRPC router - this is what gets exported to the types package
export const appRouter = router({
    auth: authRouter,
    client: clientRouter,
    // Future routers will go here:
    // trades: tradeRouter,
    // teams: teamRouter,
    // etc.
});

export type AppRouter = typeof appRouter;
