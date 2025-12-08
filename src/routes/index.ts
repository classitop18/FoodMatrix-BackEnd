import { Router } from "express";

import userRoutes from "./user.routes";

const appRouter = Router();

appRouter.use("/users", userRoutes);

export default appRouter;
