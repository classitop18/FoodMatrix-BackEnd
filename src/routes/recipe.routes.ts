import { Router } from "express";
import { RecipeController } from "../modules/recipe/recipe.controller.js";
import { RecipeService } from "../modules/recipe/recipe.service.js";
import { RecipeStorage } from "../modules/recipe/recipe.repository.js";
import { IngredientsRepository } from "../modules/ingredients/ingredients.repository.js";
import { PantryItemsStorage } from "../modules/pantry/pantry.repository.js";
import { AIRecipeServiceFactory } from "../modules/ai/ai-recipe-service.factory.js";
import { authenticate } from "../middlewares/auth.middleware.js";

const recipeRoutes = Router();

// Instantiate Repositories
// Note: These repositories use getDb() internally, but constructor might need db or be empty.
// RecipeStorage expects db client.
// IngredientsRepository handles getDb() internally.
// PantryItemsStorage handles getDb() internally.
const recipeStorage = new RecipeStorage();
const ingredientStorage = new IngredientsRepository();
const pantryStorage = new PantryItemsStorage();

// Instantiate AI Service
// We default to OpenAI, can be configured via env
const aiProvider =
  (process.env.AI_PROVIDER as "openai" | "anthropic") || "openai";

// We wrap factory creation in try-catch to avoid crashing app on startup if API key is missing
let aiRecipeService;
try {
  aiRecipeService = AIRecipeServiceFactory.create(aiProvider, {
    pantryStorage,
    recipeStorage,
  });
} catch (error) {
  console.error(
    "Failed to initialize AI Recipe Service (likely missing API ID):",
    error,
  );
  // Fallback or nullable? RecipeService constructor expects it.
  // We should probably throw or handle it in service.
  // For now, we allow it to crash if key is missing as it's a core feature being requested.
  // Or we provide a mock? No, let's let it fail so user knows to add key.
  throw error;
}

// Instantiate Service & Controller
const recipeService = new RecipeService(
  recipeStorage,
  ingredientStorage,
  aiRecipeService,
);
const recipeController = new RecipeController(recipeService);

// ============================================
// 🛤️ ROUTES
// ============================================

recipeRoutes.get("/ping", (req, res) => res.send("pong")); // Debug route (Public)

// All routes (or most) require authentication
recipeRoutes.use(authenticate);

//  Search & Listings
recipeRoutes.get("/", recipeController.getRecipes);
recipeRoutes.get("/search", recipeController.searchRecipes);
recipeRoutes.post("/search/budget", recipeController.searchByBudget); // POST because complex filters
recipeRoutes.get("/check-by-date", recipeController.checkRecipesByDate); // Check if recipe exists for date

//  AI Generation
recipeRoutes.post("/generate-ai", recipeController.generateAIRecipes);
recipeRoutes.post("/search-custom", recipeController.generateCustomRecipe);

// CRUD
recipeRoutes.post("/", recipeController.createRecipe);

// 🛒 Shopping List
recipeRoutes.post(
  "/shopping-list/merge",
  recipeController.getMergedShoppingList,
);
recipeRoutes.get("/:id/shopping-list", recipeController.getShoppingList);

recipeRoutes.get("/:id", recipeController.getRecipeById);
recipeRoutes.patch("/:id", recipeController.updateRecipe);
recipeRoutes.delete("/:id", recipeController.deleteRecipe);

// Actions
recipeRoutes.post("/:id/visibility", recipeController.toggleVisibility);
recipeRoutes.post("/:id/deactivate", recipeController.deactivateRecipe);
recipeRoutes.patch("/:id/status", recipeController.updateCookingStatus);
recipeRoutes.post("/:id/interact", recipeController.interactWithRecipe);

// Ingredients management within recipe
recipeRoutes.post("/:id/ingredients", recipeController.addIngredient);
recipeRoutes.delete(
  "/:id/ingredients/:ingredientId",
  recipeController.removeIngredient,
);

export default recipeRoutes;
