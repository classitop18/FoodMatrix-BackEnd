import { Router } from "express";

import userRoutes from "./user.routes.js";
import accountRoutes from "./account.routes.js";
import memberRoutes from "./member.routes.js";
import googlePlacesRoutes from "./google-places.routes.js";
import healthProfileRoutes from "./health-profile.routes.js";
import invitationRoutes from "./invitation.routes.js";
import pantryRoutes from "./pantry.routes.js";
import ingredientRoutes from "./ingredient.routes.js";
import mealPlanRoutes from "./meal-plan.routes.js";
import recipeRoutes from "./recipe.routes.js";
import pdfRoutes from "./pdf.routes.js";
import eventRoutes from "./event.routes.js";
import receiptRoutes from "./receipt.routes.js";

const appRouter = Router();

// User management routes (legacy - consider migrating to auth routes)
appRouter.use("/auth", userRoutes);
appRouter.use("/account", accountRoutes);
appRouter.use("/member", memberRoutes);
appRouter.use("/places", googlePlacesRoutes);
appRouter.use("/health-profile", healthProfileRoutes);
appRouter.use("/invitations", invitationRoutes);
appRouter.use("/pantry", pantryRoutes);
appRouter.use("/ingredients", ingredientRoutes);
appRouter.use("/meal-plans", mealPlanRoutes);
appRouter.use("/recipes", recipeRoutes);
appRouter.use("/pdf", pdfRoutes);
appRouter.use("/events", eventRoutes);
appRouter.use("/receipts", receiptRoutes);

export default appRouter;
