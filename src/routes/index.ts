import { Router } from "express";

import userRoutes from "./user.routes.js";
import accountRoutes from "./account.routes.js";
import memberRoutes from "./member.routes.js";
import googlePlacesRoutes from "./google-places.routes.js";
import healthProfileRoutes from "./health-profile.routes.js"

const appRouter = Router();

// User management routes (legacy - consider migrating to auth routes)
appRouter.use("/auth", userRoutes);
appRouter.use("/account", accountRoutes);
appRouter.use("/member", memberRoutes);
appRouter.use("/places", googlePlacesRoutes)
appRouter.use("/health-profile", healthProfileRoutes)

export default appRouter;
