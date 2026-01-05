import { NextFunction, Request, Response } from "express";
import { RecipeService } from "./recipe.service.js";
import { AuthenticatedRequest } from "../../middlewares/auth.middleware.js";
import { sendSuccess } from "@/utils/response.utils.js";

export class RecipeController {
  private recipeService: RecipeService;

  constructor(recipeService: RecipeService) {
    this.recipeService = recipeService;
  }

  private getAccountId(req: AuthenticatedRequest): string {
    // Try to get from headers (sent by frontend) or session (if set by some middleware)
    const accountId =
      (req.headers["x-account-id"] as string) ||
      (req as any).session?.accountId; // Fallback if custom session middleware exists

    if (!accountId) {
      return "";
    }
    return accountId;
  }

  getRecipes = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const accountId = this.getAccountId(req as AuthenticatedRequest);
      if (!accountId)
        return res.status(401).json({ message: "Account ID is required" });

      // Extract query parameters
      const filters = {
        cuisines: req.query.cuisines as string,
        mealTypes: req.query.mealTypes as string,
        difficulty: req.query.difficulty as string,
        minPrepTime: req.query.minPrepTime
          ? parseInt(req.query.minPrepTime as string)
          : undefined,
        maxPrepTime: req.query.maxPrepTime
          ? parseInt(req.query.maxPrepTime as string)
          : undefined,
        minCalories: req.query.minCalories
          ? parseInt(req.query.minCalories as string)
          : undefined,
        maxCalories: req.query.maxCalories
          ? parseInt(req.query.maxCalories as string)
          : undefined,
        minBudget: req.query.minBudget
          ? parseFloat(req.query.minBudget as string)
          : undefined,
        maxBudget: req.query.maxBudget
          ? parseFloat(req.query.maxBudget as string)
          : undefined,
        dateFilter: req.query.dateFilter as string,
        search: req.query.search as string,
        page: req.query.page ? parseInt(req.query.page as string) : 1,
        pageSize: req.query.pageSize
          ? parseInt(req.query.pageSize as string)
          : 10,
        sortBy: req.query.sortBy as string,
        sortOrder: req.query.sortOrder as "asc" | "desc",
      };

      const result = await this.recipeService.getRecipes(accountId, filters);
      sendSuccess(res, result, "Recipes fetched successfully", 200);
    } catch (err) {
      console.error("Error fetching recipes:", err);
      next(err);
    }
  };
  // 📄 Get single recipe with ingredients
  getRecipeById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const accountId = this.getAccountId(req as AuthenticatedRequest);
      if (!accountId)
        return res.status(401).json({ message: "Account ID is required" });

      const recipe = await this.recipeService.getRecipeDetails(req.params.id);
      if (!recipe) return res.status(404).json({ message: "Recipe not found" });

      sendSuccess(res, recipe, "Recipe fetched successfully", 200);

    } catch (err) {
      console.error("Error fetching recipe:", err);
      next(err);
    }
  };

  // 🧑‍🍳 Create a new recipe
  createRecipe = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const accountId = this.getAccountId(req as AuthenticatedRequest);
      if (!accountId)
        return res.status(401).json({ message: "Account ID is required" });

      const recipe = await this.recipeService.createRecipe(accountId, req.body);
      sendSuccess(res, recipe, "Recipe Created Successfully", 201)

    } catch (err) {
      console.error("Error creating recipe:", err);
      next(err)
    }
  };

  // ✏️ Update recipe
  updateRecipe = async (req: Request, res: Response) => {
    try {
      const accountId = this.getAccountId(req as AuthenticatedRequest);
      if (!accountId)
        return res.status(401).json({ message: "Account ID is required" });

      const updated = await this.recipeService.updateRecipe(
        req.params.id,
        accountId,
        req.body,
      );
      res.json(updated);
    } catch (err: any) {
      console.error("Error updating recipe:", err);
      res
        .status(500)
        .json({ message: err.message || "Failed to update recipe" });
    }
  };

  // ❌ Delete recipe
  deleteRecipe = async (req: Request, res: Response) => {
    try {
      const accountId = this.getAccountId(req as AuthenticatedRequest);
      if (!accountId)
        return res.status(401).json({ message: "Account ID is required" });
      await this.recipeService.deleteRecipe(req.params.id, accountId);
      res.json({ success: true });
    } catch (err: any) {
      console.error("Error deleting recipe:", err);
      res
        .status(500)
        .json({ message: err.message || "Failed to delete recipe" });
    }
  };

  // Toggle recipe visibility (public/private)
  toggleVisibility = async (req: Request, res: Response) => {
    try {
      const accountId = this.getAccountId(req as AuthenticatedRequest);
      if (!accountId)
        return res.status(401).json({ message: "Account ID is required" });

      const { isPublic } = req.body;
      const result = await this.recipeService.toggleVisibility(
        req.params.id,
        accountId,
        isPublic,
      );
      res.json(result);
    } catch (err: any) {
      console.error("Error toggling visibility:", err);
      res
        .status(500)
        .json({ message: err.message || "Failed to toggle visibility" });
    }
  };

  // 💤 Deactivate (soft delete)
  deactivateRecipe = async (req: Request, res: Response) => {
    try {
      const accountId = this.getAccountId(req as AuthenticatedRequest);
      if (!accountId)
        return res.status(401).json({ message: "Account ID is required" });

      const result = await this.recipeService.deactivateRecipe(
        req.params.id,
        accountId,
      );
      res.json(result);
    } catch (err: any) {
      console.error("Error deactivating recipe:", err);
      res
        .status(500)
        .json({ message: err.message || "Failed to deactivate recipe" });
    }
  };

  // 🍳 Update cooking status
  updateCookingStatus = async (req: Request, res: Response) => {
    try {
      const accountId = this.getAccountId(req as AuthenticatedRequest);
      if (!accountId)
        return res.status(401).json({ message: "Account ID is required" });

      const { status } = req.body;
      // Validate status
      if (!["cooked", "not_cooked", "not_interested"].includes(status)) {
        return res.status(400).json({ message: "Invalid status value" });
      }

      const result = await this.recipeService.updateCookingStatus(
        req.params.id,
        accountId,
        status,
      );
      res.json(result);
    } catch (err: any) {
      console.error("Error updating cooking status:", err);
      res
        .status(500)
        .json({ message: err.message || "Failed to update cooking status" });
    }
  };

  // 🔎 Search by keyword
  searchRecipes = async (req: Request, res: Response) => {
    try {
      const accountId = this.getAccountId(req as AuthenticatedRequest);
      // Search might be allowed for public recipes without accountId, but let's enforce safely for now or allow optional?
      // Existing service allows optional accountId.
      // If strictly protected route, we expect accountId. But let's act robust.

      const query = req.query.q as string;
      if (!query)
        return res.status(400).json({ message: "Missing search query" });

      const results = await this.recipeService.searchRecipes(query, accountId);
      res.json(results);
    } catch (err) {
      console.error("Error searching recipes:", err);
      res.status(500).json({ message: "Failed to search recipes" });
    }
  };

  // 💰 Search by budget
  searchByBudget = async (req: Request, res: Response) => {
    try {
      const accountId = this.getAccountId(req as AuthenticatedRequest);
      if (!accountId)
        return res.status(401).json({ message: "Account ID is required" });

      const { maxBudget, members } = req.body;
      const results = await this.recipeService.searchByBudget(
        accountId,
        maxBudget,
        members,
      );
      res.json(results);
    } catch (err) {
      console.error("Error filtering recipes by budget:", err);
      res.status(500).json({ message: "Failed to filter recipes" });
    }
  };

  // 🧂 Add an ingredient
  addIngredient = async (req: Request, res: Response) => {
    try {
      const accountId = this.getAccountId(req as AuthenticatedRequest);
      if (!accountId)
        return res.status(401).json({ message: "Account ID is required" });

      const recipeId = req.params.id;
      const ingredient = await this.recipeService.addIngredient(
        recipeId,
        req.body,
        accountId,
      );
      res.status(201).json(ingredient);
    } catch (err) {
      console.error("Error adding ingredient:", err);
      res.status(500).json({ message: "Failed to add ingredient" });
    }
  };

  // ❌ Remove ingredient
  removeIngredient = async (req: Request, res: Response) => {
    try {
      const accountId = this.getAccountId(req as AuthenticatedRequest);
      if (!accountId)
        return res.status(401).json({ message: "Account ID is required" });

      const { recipeId, ingredientId } = req.params;
      await this.recipeService.removeIngredient(
        recipeId,
        ingredientId,
        accountId,
      );
      res.json({ success: true });
    } catch (err) {
      console.error("Error removing ingredient:", err);
      res.status(500).json({ message: "Failed to remove ingredient" });
    }
  };

  // 🧠 Generate AI recipes (ChatGPT / GPT-5)
  generateAIRecipes = async (req: Request, res: Response) => {
    try {
      const accountId = this.getAccountId(req as AuthenticatedRequest);
      if (!accountId)
        return res.status(401).json({ message: "Account ID is required" });

      const response = await this.recipeService.generateAIRecipes(
        req.body,
        accountId,
      );
      res.json(response);
    } catch (err: any) {
      console.error("AI Recipe Generation Error:", err);
      res
        .status(500)
        .json({ message: err.message || "AI recipe generation failed" });
    }
  };

  // 🔍 Generate Custom AI Recipe (Search)
  generateCustomRecipe = async (req: Request, res: Response) => {
    try {
      const accountId = this.getAccountId(req as AuthenticatedRequest);
      if (!accountId)
        return res.status(401).json({ message: "Account ID is required" });

      const response = await this.recipeService.generateAICustomRecipes(
        req.body,
        accountId,
      );
      res.json(response);
    } catch (err: any) {
      console.error("AI Custom Recipe Search Error:", err);
      res
        .status(500)
        .json({ message: err.message || "Custom recipe search failed" });
    }
  };
}
