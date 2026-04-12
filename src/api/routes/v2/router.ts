import { router } from "./utils/trpcHelpers";
import { authRouter } from "./routers/auth";
import { clientRouter } from "./routers/client";
import { tradeRouter } from "./routers/trade";
import { adminRouter } from "./routers/admin";

// Main tRPC router - this is what gets exported to the types package
export const appRouter = router({
    auth: authRouter,
    client: clientRouter,
    trades: tradeRouter,
    admin: adminRouter,
});

export type AppRouter = typeof appRouter;
