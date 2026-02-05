import {
  InsertRecipe,
  Recipe,
  InsertRecipeIngredient,
} from "../../database/schemas/schema.js";
import { randomUUID } from "crypto";
import { RecipeFilters, RecipeStorage } from "./recipe.repository.js";
import { IngredientsRepository } from "../ingredients/ingredients.repository.js";

export type { RecipeFilters };

import { AIRecipeService } from "../ai/services/ai-recipe.service.js";
import { AIRecipeRequest } from "../ai/interfaces/ai.interfaces.js";
import {
  IMemberRepository,
  MemberRepository,
} from "../member/member.repository.js";

export class RecipeService {
  private storage: RecipeStorage;
  private ingredientStorage: IngredientsRepository;
  private aiRecipeService: AIRecipeService;
  private memberRepository: IMemberRepository;

  constructor(
    storage: RecipeStorage,
    ingredientStorage: IngredientsRepository,
    aiRecipeService: AIRecipeService,
    memberRepository: IMemberRepository = new MemberRepository(),
  ) {
    this.storage = storage;
    this.ingredientStorage = ingredientStorage;
    this.aiRecipeService = aiRecipeService;
    this.memberRepository = memberRepository;
  }

  // 🧑‍🍳 Create a new recipe

  async createRecipe(accountId: string, data: any): Promise<Recipe> {
    const recipeData = {
      ...data,
      id: randomUUID(),
      accountId,
      createdAt: new Date(),
      updatedAt: new Date(),
      isActive: true,
    };

    const recipe = await this.storage.createRecipe(recipeData);

    // 2️⃣ Convert raw ingredients → DB ingredient mapping
    const finalIngredients = [];

    for (const ing of data.ingredients) {
      const ingredient = await this.ingredientStorage.findOrCreateIngredient({
        ...ing,
      });

      finalIngredients.push({
        recipeId: recipe.id,
        ingredientId: ingredient.id,
        quantity: String(ing.quantity),
        unit: ing.unit,
        isOptional: ing.isOptional ?? false,
        notes: ing.notes || null,
      });
    }

    // Insert one-by-one (Consider bulk insert in future optimization)
    for (const fi of finalIngredients) {
      await this.storage.addRecipeIngredient(fi);
    }
    return recipe;
  }

  // ✏️ Update recipe (only owner or admin)
  async updateRecipe(
    recipeId: string,
    accountId: string,
    updates: Partial<InsertRecipe> & { scoreChange?: number },
  ) {
    const existing = await this.storage.getRecipeById(recipeId);
    if (!existing) throw new Error("Recipe not found");
    if (existing.accountId && existing.accountId !== accountId)
      throw new Error("You don’t have permission to update this recipe.");

    // Handle score change separately - increment/decrement instead of replace
    if (updates.scoreChange !== undefined) {
      const currentScore = existing.score || 0;
      const newScore = currentScore + updates.scoreChange;

      console.log(
        `Recipe ${recipeId}: Score ${currentScore} → ${newScore} (change: ${updates.scoreChange > 0 ? "+" : ""}${updates.scoreChange})`,
      );

      // Remove scoreChange from updates and add the calculated score
      //eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { scoreChange: _scoreChange, ...restUpdates } = updates;
      return await this.storage.updateRecipe(recipeId, {
        ...restUpdates,
        score: newScore,
      });
    }

    return await this.storage.updateRecipe(recipeId, updates);
  }

  // ❌ Delete recipe (only owner)
  async deleteRecipe(recipeId: string, accountId: string) {
    const existing = await this.storage.getRecipeById(recipeId);
    if (!existing) throw new Error("Recipe not found");
    if (existing.accountId && existing.accountId !== accountId)
      throw new Error("You don’t have permission to delete this recipe.");

    return await this.storage.deleteRecipe(recipeId);
  }

  // 🌍 Toggle public/private
  async toggleVisibility(
    recipeId: string,
    accountId: string,
    isPublic: boolean,
  ) {
    const recipe = await this.storage.getRecipeById(recipeId);
    if (!recipe) throw new Error("Recipe not found");
    if (recipe.accountId !== accountId) throw new Error("Unauthorized");

    return await this.storage.toggleRecipeVisibility(recipeId, isPublic);
  }

  // 💤 Deactivate recipe (soft delete)
  async deactivateRecipe(recipeId: string, accountId: string) {
    const recipe = await this.storage.getRecipeById(recipeId);
    if (!recipe) throw new Error("Recipe not found");
    if (recipe.accountId !== accountId) throw new Error("Unauthorized");

    return await this.storage.deactivateRecipe(recipeId);
  }

  // 🍳 Update cooking status
  async updateCookingStatus(
    recipeId: string,
    accountId: string,
    status: string,
  ) {
    const recipe = await this.storage.getRecipeById(recipeId);
    if (!recipe) throw new Error("Recipe not found");
    if (recipe.accountId !== accountId) throw new Error("Unauthorized");

    return await this.storage.updateCookingStatus(recipeId, status);
  }

  async getRecipes(accountId: string, filters: RecipeFilters) {
    return await this.storage.getRecipes(accountId, filters);
  }

  // 📄 Get recipe with ingredients
  async getRecipeDetails(recipeId: string) {
    const recipe = await this.storage.getRecipeWithIngredients(recipeId);
    if (!recipe) throw new Error("Recipe not found");
    return recipe;
  }

  // 🔎 Search by name or keywords
  async searchRecipes(query: string, accountId?: string) {
    return await this.storage.searchRecipesByName(query, accountId);
  }

  // 💰 Filter by budget
  async searchByBudget(accountId: string, maxBudget: number, members: number) {
    return await this.storage.searchRecipesByBudget(
      accountId,
      maxBudget,
      members,
    );
  }

  // 🕒 Recently created recipes
  async getRecentRecipes(accountId: string, limit = 10) {
    return await this.storage.getRecentRecipes(accountId, limit);
  }

  // 🌎 Public recipes
  async getPublicRecipes() {
    return await this.storage.getPublicRecipes();
  }

  // 🧂 Add an ingredient to recipe
  async addIngredient(
    recipeId: string,
    ingredient: InsertRecipeIngredient,
    accountId: string,
  ) {
    const recipe = await this.storage.getRecipeById(recipeId);
    if (!recipe) throw new Error("Recipe not found");
    if (recipe.accountId !== accountId) throw new Error("Unauthorized");

    return await this.storage.addRecipeIngredient({ ...ingredient, recipeId });
  }

  // ❌ Remove ingredient
  async removeIngredient(
    recipeId: string,
    ingredientId: string,
    accountId: string,
  ) {
    const recipe = await this.storage.getRecipeById(recipeId);
    if (!recipe) throw new Error("Recipe not found");
    if (recipe.accountId !== accountId) throw new Error("Unauthorized");

    return await this.storage.removeRecipeIngredient(recipeId, ingredientId);
  }

  // 🍽️ Get ingredients for recipe
  async getIngredients(recipeId: string) {
    return await this.storage.getRecipeIngredients(recipeId);
  }

  // Generate AI recipes

  async generateAIRecipes(payload: any, accountId: string) {
    // Aggregate health data from payload and target member
    const aggregatedDietaryRestrictions = new Set<string>([]);
    const aggregatedAllergies = new Set<string>(payload.allergies || []);
    const aggregatedHealthGoals = new Set<string>(payload.healthGoals || []);
    const aggregatedConditions = new Set<string>(
      payload.healthConditions || [],
    );
    const healthProfilesList: any[] = [];

    // If target members are specified, fetch their health profiles
    if (payload.targetMembers && payload.targetMembers.length > 0) {
      try {
        const fetchResult =
          await this.memberRepository.findHealthProfilesByMemberIds(
            payload.targetMembers,
          );

        for (const profile of fetchResult) {
          // Add to detailed list
          healthProfilesList.push({
            id: profile.memberId, // Check your repo result structure, mapping assumed
            name: profile.member?.name, // If joined
            dietaryRestrictions: profile.dietaryRestrictions || [],
            allergies: profile.allergies || [],
            healthConditions: profile.conditions || [],
            healthGoals: profile.goals || [],
          });

          // Also aggregate for global safety constraints (zero tolerance)
          if (
            profile.dietaryRestrictions &&
            Array.isArray(profile.dietaryRestrictions)
          ) {
            profile.dietaryRestrictions.forEach((dr: string) =>
              aggregatedDietaryRestrictions.add(dr),
            );
          }
          if (profile.allergies && Array.isArray(profile.allergies)) {
            profile.allergies.forEach((alg: string) =>
              aggregatedAllergies.add(alg),
            );
          }
          // We don't necessarily need to aggregate conditions/goals globally if we have per-member profiles,
          // but keeping them doesn't hurt as general context.
          if (profile.goals && Array.isArray(profile.goals)) {
            profile.goals.forEach((g: string) => aggregatedHealthGoals.add(g));
          }
          if (profile.conditions && Array.isArray(profile.conditions)) {
            profile.conditions.forEach((c: string) =>
              aggregatedConditions.add(c),
            );
          }
        }
      } catch (error) {
        console.error("Error fetching member health profiles:", error);
        // Continue with payload data only if fetch fails
      }
    }

    const request: AIRecipeRequest = {
      accountId: accountId,
      mealType: payload.mealType,
      memberCount: payload.memberCount || 1,
      recipeCount: payload.recipeCount || 1,

      servings: payload.servings || 4,
      usePantryItems: payload.usePantryItems || false,
      pantryOnly: payload.pantryOnly || false,
      maxBudgetPerServing: payload.maxBudgetPerServing,
      dietaryRestrictions: Array.from(aggregatedDietaryRestrictions),
      allergies: Array.from(aggregatedAllergies),
      cuisine: payload.cuisine, // Explicit single cuisine preference
      preferredCuisines: payload.preferredCuisines || payload.cuisines || [], // Handle both field names
      difficulty: payload.difficulty || "medium", // Default to medium
      maxPrepTime: payload.maxPrepTime || 60,
      healthGoals: Array.from(aggregatedHealthGoals),
      healthConditions: Array.from(aggregatedConditions),
      healthProfiles: healthProfilesList,
    };

    return await this.aiRecipeService.generatePersonalizedRecipes(request);
  }

  // 🕵️‍♀️ Search/Generate Custom Recipe
  async generateAICustomRecipes(payload: any, accountId: string) {
    // payload: { customRecipe: string, mealType: string ... }
    // Frontend sends: recipeName, mealType, servings, dietaryRestrictions
    return await this.aiRecipeService.searchSpecificRecipe(
      payload.recipeName || payload.customRecipe,
      payload.mealType || "dinner", // default fallback
      payload.servings || 4,
      payload.dietaryRestrictions,
      accountId,
    );
  }
  async interactWithRecipe(
    userId: string,
    recipeId: string,
    action: "like" | "dislike" | "favorite",
  ) {
    // 1. Get current interaction state
    const interactions = await this.storage.getRecipeInteractions(userId, [
      recipeId,
    ]);
    const current = interactions[0] || {
      isLiked: false,
      isDisliked: false,
      isFavorite: false,
    };

    let scoreDelta = 0;
    const updates: {
      isLiked?: boolean;
      isDisliked?: boolean;
      isFavorite?: boolean;
    } = {};

    switch (action) {
      case "like":
        if (current.isLiked) {
          // Untoggle Like
          scoreDelta -= 2;
          updates.isLiked = false;
        } else {
          // Toggle Like
          scoreDelta += 2;
          updates.isLiked = true;

          // Remove Dislike if present
          if (current.isDisliked) {
            scoreDelta += 2;
            updates.isDisliked = false;
          }
          // Remove Favorite if present
          if (current.isFavorite) {
            scoreDelta -= 3;
            updates.isFavorite = false;
          }
        }
        break;

      case "dislike":
        if (current.isDisliked) {
          // Untoggle Dislike
          scoreDelta += 2;
          updates.isDisliked = false;
        } else {
          // Toggle Dislike
          scoreDelta -= 2;
          updates.isDisliked = true;

          // Remove Like if present
          if (current.isLiked) {
            scoreDelta -= 2;
            updates.isLiked = false;
          }
          // Remove Favorite if present
          if (current.isFavorite) {
            scoreDelta -= 3;
            updates.isFavorite = false;
          }
        }
        break;

      case "favorite":
        if (current.isFavorite) {
          // Untoggle Favorite (Remove +3)
          scoreDelta -= 3;
          updates.isFavorite = false;
        } else {
          // Toggle Favorite (Add +3)
          scoreDelta += 3;
          updates.isFavorite = true;

          // Remove Like if present
          if (current.isLiked) {
            scoreDelta -= 2;
            updates.isLiked = false;
          }
          // Remove Dislike if present
          if (current.isDisliked) {
            scoreDelta += 2;
            updates.isDisliked = false;
          }
        }
        break;
    }

    // 2. Update interaction in DB
    await this.storage.updateRecipeInteraction(userId, recipeId, updates);

    // 3. Update global recipe score if changed
    if (scoreDelta !== 0) {
      await this.storage.updateRecipeScore(recipeId, scoreDelta);
    }

    // 4. Return new state
    return {
      ...current,
      ...updates,
      scoreDelta,
    };
  }

  // 📅 Check if recipes exist for a specific date and meal type
  async checkRecipesByDate(accountId: string, date: string, mealType: string) {
    const recipes = await this.storage.getRecipesByDateAndMealType(
      accountId,
      date,
      mealType,
    );

    if (recipes.length > 0) {
      return {
        exists: true,
        recipe: recipes[0], // Return the most recent one
      };
    }

    return {
      exists: false,
      recipe: null,
    };
  }

  // 🛍️ Get shopping list
  async getShoppingList(recipeId: string) {
    return await this.storage.retrieveShoppingList(recipeId);
  }

  // 🛍️🛒 Get merged shopping list
  async getMergedShoppingList(recipeIds: string[]) {
    return await this.storage.retrieveMergedShoppingList(recipeIds);
  }
}
