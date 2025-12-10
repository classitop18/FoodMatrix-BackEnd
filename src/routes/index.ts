import { Router } from "express";

import userRoutes from "./user.routes.ts";

const appRouter = Router();


// User management routes (legacy - consider migrating to auth routes)
appRouter.use("/auth", userRoutes);

export default appRouter;
