import { Router } from "express";
import { MealPlanController } from "../modules/meal-plan/meal-plan.controller.js";
import { MealPlanService } from "../modules/meal-plan/meal-plan.service.js";
import { MealPlanRepository } from "../modules/meal-plan/meal-plan.repository.js";
import { authenticate } from "../middlewares/auth.middleware.js";

const router = Router();

const repository = new MealPlanRepository();
const service = new MealPlanService(repository);
const controller = new MealPlanController(service);

// Apply auth middleware to all routes
router.use(authenticate);

router.get("/", controller.getMealPlans);
router.post("/", controller.createMealPlan);
router.patch("/:id", controller.updateMealPlan);
router.delete("/:id", controller.deleteMealPlan);

export default router;
