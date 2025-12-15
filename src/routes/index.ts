import { Router } from "express";

import userRoutes from "./user.routes.ts";
import accountRoutes from "./account.routes.ts"

const appRouter = Router();

// User management routes (legacy - consider migrating to auth routes)
appRouter.use("/auth", userRoutes);
appRouter.use("/account", accountRoutes)

export default appRouter;
