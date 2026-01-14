import { NextFunction, Response } from "express";
import { RecipeService } from "./recipe.service.js";
import { AuthenticatedRequest } from "../../middlewares/auth.middleware.js";
import { sendResponse } from "@/utils/response.utils.js";
import { AppError } from "@/utils/app-error.utils.js";

interface SessionRequest {
  session?: {
    accountId?: string;
  };
}

export class RecipeController {
  private recipeService: RecipeService;

  constructor(recipeService: RecipeService) {
    this.recipeService = recipeService;
  }

  private getAccountId(req: AuthenticatedRequest): string {
    // Try to get from headers (sent by frontend) or session (if set by some middleware)
    const accountId =
      (req.headers["x-account-id"] as string) ||
      (req as unknown as SessionRequest).session?.accountId; // Fallback if custom session middleware exists

    if (!accountId) {
      return "";
    }
    return accountId;
  }

  getRecipes = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const accountId = this.getAccountId(req);
      if (!accountId) throw new AppError("Account ID is required", 401);

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
        userId: req.user?.id,
        viewScope: req.query.viewScope as "personal" | "global",
      };

      const result = await this.recipeService.getRecipes(accountId, filters);
      return sendResponse(res, result, "Recipes fetched successfully", 200);
    } catch (err) {
      next(err);
    }
  };
  // 📄 Get single recipe with ingredients
  getRecipeById = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const accountId = this.getAccountId(req);
      if (!accountId) throw new AppError("Account ID is required", 401);

      const recipe = await this.recipeService.getRecipeDetails(req.params.id);
      if (!recipe) throw new AppError("Recipe not found", 404);

      return sendResponse(res, recipe, "Recipe fetched successfully", 200);
    } catch (err) {
      next(err);
    }
  };

  // 🧑‍🍳 Create a new recipe
  createRecipe = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const accountId = this.getAccountId(req);
      if (!accountId) throw new AppError("Account ID is required", 401);

      const recipe = await this.recipeService.createRecipe(accountId, req.body);
      return sendResponse(res, recipe, "Recipe Created Successfully", 201);
    } catch (err) {
      next(err);
    }
  };

  // ✏️ Update recipe
  updateRecipe = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const accountId = this.getAccountId(req);
      if (!accountId) throw new AppError("Account ID is required", 401);

      const updated = await this.recipeService.updateRecipe(
        req.params.id,
        accountId,
        req.body,
      );
      return sendResponse(res, updated, "Recipe updated successfully", 200);
    } catch (err) {
      next(err);
    }
  };

  // ❌ Delete recipe
  deleteRecipe = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const accountId = this.getAccountId(req);
      if (!accountId) throw new AppError("Account ID is required", 401);
      await this.recipeService.deleteRecipe(req.params.id, accountId);
      return sendResponse(
        res,
        { success: true },
        "Recipe deleted successfully",
        200,
      );
    } catch (err) {
      next(err);
    }
  };

  // Toggle recipe visibility (public/private)
  toggleVisibility = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const accountId = this.getAccountId(req);
      if (!accountId) throw new AppError("Account ID is required", 401);

      const { isPublic } = req.body;
      const result = await this.recipeService.toggleVisibility(
        req.params.id,
        accountId,
        isPublic,
      );
      return sendResponse(res, result, "Visibility toggled", 200);
    } catch (err) {
      next(err);
    }
  };

  // 💤 Deactivate (soft delete)
  deactivateRecipe = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const accountId = this.getAccountId(req);
      if (!accountId) throw new AppError("Account ID is required", 401);

      const result = await this.recipeService.deactivateRecipe(
        req.params.id,
        accountId,
      );
      return sendResponse(res, result, "Recipe deactivated", 200);
    } catch (err) {
      next(err);
    }
  };

  // 🍳 Update cooking status
  updateCookingStatus = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const accountId = this.getAccountId(req);
      if (!accountId) throw new AppError("Account ID is required", 401);

      const { status } = req.body;
      // Validate status
      if (!["cooked", "not_cooked", "not_interested"].includes(status)) {
        throw new AppError("Invalid status value", 400);
      }

      const result = await this.recipeService.updateCookingStatus(
        req.params.id,
        accountId,
        status,
      );
      return sendResponse(res, result, "Cooking status updated", 200);
    } catch (err) {
      next(err);
    }
  };

  // 🔎 Search by keyword
  searchRecipes = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const accountId = this.getAccountId(req);
      // Search might be allowed for public recipes without accountId, but let's enforce safely for now or allow optional?
      // Existing service allows optional accountId.
      // If strictly protected route, we expect accountId. But let's act robust.

      const query = req.query.q as string;
      if (!query) throw new AppError("Missing search query", 400);

      const results = await this.recipeService.searchRecipes(query, accountId);
      return sendResponse(res, results, "Search results", 200);
    } catch (err) {
      next(err);
    }
  };

  // 💰 Search by budget
  searchByBudget = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const accountId = this.getAccountId(req);
      if (!accountId) throw new AppError("Account ID is required", 401);

      const { maxBudget, members } = req.body;
      const results = await this.recipeService.searchByBudget(
        accountId,
        maxBudget,
        members,
      );
      return sendResponse(res, results, "Budget search results", 200);
    } catch (err) {
      next(err);
    }
  };

  // 🧂 Add an ingredient
  addIngredient = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const accountId = this.getAccountId(req);
      if (!accountId) throw new AppError("Account ID is required", 401);

      const recipeId = req.params.id;
      const ingredient = await this.recipeService.addIngredient(
        recipeId,
        req.body,
        accountId,
      );
      return sendResponse(res, ingredient, "Ingredient added", 201);
    } catch (err) {
      next(err);
    }
  };

  // ❌ Remove ingredient
  removeIngredient = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const accountId = this.getAccountId(req);
      if (!accountId) throw new AppError("Account ID is required", 401);

      const { recipeId, ingredientId } = req.params;
      await this.recipeService.removeIngredient(
        recipeId,
        ingredientId,
        accountId,
      );
      return sendResponse(res, { success: true }, "Ingredient removed", 200);
    } catch (err) {
      next(err);
    }
  };

  // 🧠 Generate AI recipes (ChatGPT / GPT-5)
  generateAIRecipes = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const accountId = this.getAccountId(req);
      if (!accountId) throw new AppError("Account ID is required", 401);

      const response = await this.recipeService.generateAIRecipes(
        req.body,
        accountId,
      );
      return sendResponse(res, response, "AI recipes generated", 200);
    } catch (err) {
      next(err);
    }
  };

  // 🔍 Generate Custom AI Recipe (Search)
  generateCustomRecipe = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const accountId = this.getAccountId(req);
      if (!accountId) throw new AppError("Account ID is required", 401);

      const response = await this.recipeService.generateAICustomRecipes(
        req.body,
        accountId,
      );
      return sendResponse(res, response, "Custom recipe generated", 200);
    } catch (err) {
      next(err);
    }
  };
  // Interact with recipe (Like, Dislike, Favorite)
  interactWithRecipe = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      // Assuming userId is attached to request by auth middleware
      const userId = req.user?.id;
      if (!userId) throw new AppError("User authentication required", 401);

      const { action } = req.body;
      if (!["like", "dislike", "favorite"].includes(action)) {
        throw new AppError("Invalid interaction action", 400);
      }

      const result = await this.recipeService.interactWithRecipe(
        userId,
        req.params.id,
        action,
      );

      return sendResponse(res, result, `Recipe interaction: ${action}`, 200);
    } catch (err) {
      next(err);
    }
  };

  // 📅 Check if recipes exist for a specific date and meal type
  checkRecipesByDate = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const accountId = this.getAccountId(req);
      if (!accountId) throw new AppError("Account ID is required", 401);

      const { date, mealType } = req.query;

      if (!date || !mealType) {
        throw new AppError("Date and mealType are required", 400);
      }

      const result = await this.recipeService.checkRecipesByDate(
        accountId,
        date as string,
        mealType as string,
      );

      return sendResponse(
        res,
        result,
        result.exists ? "Recipe found" : "No recipe found",
        200,
      );
    } catch (err) {
      next(err);
    }
  };
  // 🛍️ Get shopping list for single recipe
  getShoppingList = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const list = await this.recipeService.getShoppingList(req.params.id);
      return sendResponse(res, list, "Shopping list fetched", 200);
    } catch (err) {
      next(err);
    }
  };

  // 🛍️ Get merged shopping list
  getMergedShoppingList = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      // Support both body (POST) and query (GET)
      let recipeIds: string[] = [];

      if (req.body && Array.isArray(req.body.recipeIds)) {
        recipeIds = req.body.recipeIds;
      } else if (req.query.ids) {
        recipeIds = (req.query.ids as string).split(",");
      }

      if (!recipeIds || recipeIds.length === 0) {
        throw new AppError("Recipe IDs are required", 400);
      }

      const list = await this.recipeService.getMergedShoppingList(recipeIds);
      return sendResponse(res, list, "Merged shopping list fetched", 200);
    } catch (err) {
      next(err);
    }
  };
}
