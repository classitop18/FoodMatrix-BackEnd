import { Router } from "express";

import userRoutes from "./user.routes";

const appRouter = Router();

appRouter.use("/auth", userRoutes);

export default appRouter;
