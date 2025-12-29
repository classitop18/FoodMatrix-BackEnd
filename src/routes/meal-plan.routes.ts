import { Router } from "express";
import { MealPlanController } from "../modules/meal-plan/meal-plan.controller.js";
import { MealPlanService } from "../modules/meal-plan/meal-plan.service.js";
import { MealPlanRepository } from "../modules/meal-plan/meal-plan.repository.js";
import { authenticate } from "../middlewares/auth.middleware.js";
import { requirePermission } from "../middlewares/authorization.middleware.js";
import { PERMISSIONS } from "../common/permissions.config.js";

const router = Router();

const repository = new MealPlanRepository();
const service = new MealPlanService(repository);
const controller = new MealPlanController(service);

// Apply auth middleware to all routes
router.use(authenticate);

// GET /api/meal-plans - View meal plans (requires meal:view permission)
router.get(
  "/",
  requirePermission(PERMISSIONS.MEAL_VIEW),
  controller.getMealPlans,
);

// POST /api/meal-plans - Create meal plan (requires meal:create permission)
router.post(
  "/",
  requirePermission(PERMISSIONS.MEAL_CREATE),
  controller.createMealPlan,
);

// PATCH /api/meal-plans/:id - Update meal plan (requires meal:update permission)
router.patch(
  "/:id",
  requirePermission(PERMISSIONS.MEAL_UPDATE),
  controller.updateMealPlan,
);

// DELETE /api/meal-plans/:id - Delete meal plan (requires meal:delete permission)
router.delete(
  "/:id",
  requirePermission(PERMISSIONS.MEAL_DELETE),
  controller.deleteMealPlan,
);

export default router;
