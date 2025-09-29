"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.appRouter = void 0;
const trpc_1 = require("./trpc");
const auth_1 = require("./routers/auth");
// Main tRPC router - this is what gets exported to the types package
exports.appRouter = (0, trpc_1.router)({
    auth: auth_1.authRouter,
    // Future routers will go here:
    // trades: tradeRouter,
    // teams: teamRouter,
    // etc.
});
//# sourceMappingURL=router.js.map