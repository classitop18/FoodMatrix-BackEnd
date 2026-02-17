import { Router } from "express";
import { EventController } from "../modules/event/event.controller.js";
import { authenticate } from "../middlewares/auth.middleware.js";

const router = Router();
const eventController = new EventController();

// All routes require authentication
router.use(authenticate);

// ===== Event CRUD =====
router.post("/", eventController.createEvent);
router.get("/", eventController.getEvents);
router.get("/stats", eventController.getAccountEventStats);

// ===== AI Helper Routes =====
router.post("/ai/merge-ingredients", eventController.mergeIngredients);

router.get("/:id", eventController.getEventById);
router.put("/:id", eventController.updateEvent);
router.delete("/:id", eventController.deleteEvent);

// ===== AI-Powered Features =====
router.post("/:id/suggest-budget", eventController.suggestBudget);
router.post("/:id/generate-recipes", eventController.generateEventRecipes);

// ===== Event Extra Items =====
router.post("/:id/items/bulk", eventController.addExtraItems);
router.post("/:id/items", eventController.addExtraItem);
router.get("/:id/items", eventController.getExtraItems);
router.put("/:id/items/:itemId", eventController.updateExtraItem);
router.delete("/:id/items/:itemId", eventController.deleteExtraItem);

// ===== Event Meals =====
router.post("/:id/meals", eventController.addMealToEvent);
router.get("/:id/meals", eventController.getEventMeals);
router.put("/:id/meals/:mealId", eventController.updateEventMeal);
router.delete("/:id/meals/:mealId", eventController.deleteEventMeal);

// ===== Event Recipes =====
router.post("/:id/meals/:mealId/recipes", eventController.addRecipeToMeal);
router.delete(
  "/:id/meals/:mealId/recipes/:recipeId",
  eventController.removeRecipeFromMeal,
);

// ===== Menu Generation =====
router.post("/:id/generate-menu", eventController.generateMenu);

// ===== Shopping List =====
router.post("/:id/shopping-list", eventController.generateShoppingList);
router.get("/:id/shopping-list", eventController.getEventShoppingList);
router.post("/:id/shopping-list/approve", eventController.approveShoppingList);
router.post("/:id/shopping-list/receipt", eventController.uploadReceipt);

// ===== Event Completion & Health =====
router.post("/:id/complete", eventController.completeEvent);
router.post("/:id/member-logs", eventController.logMemberConsumption);

// ===== Analytics =====
router.get("/:id/analytics", eventController.getEventAnalytics);

// ===== Budget Tracking =====
router.get("/:id/budget-tracking", eventController.getBudgetTracking);

// ===== Generation State Persistence =====
router.get("/:id/generation-state", eventController.getGenerationState);
router.post("/:id/generation-state", eventController.saveGenerationState);

export default router;
