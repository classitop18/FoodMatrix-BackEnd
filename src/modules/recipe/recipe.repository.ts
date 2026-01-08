import {
  eq,
  sql,
  desc,
  and,
  ilike,
  asc,
  inArray,
  getTableColumns,
} from "drizzle-orm";
import { getDb } from "../../database/db.js";
import {
  recipes,
  ingredients,
  recipeIngredients,
  userRecipeInteractions,
  Ingredient,
  InsertRecipe,
  InsertRecipeIngredient,
  Recipe,
  RecipeIngredient,
} from "../../database/schemas/schema.js";

import {
  AIGeneratedRecipe,
  AIRecipeRequest,
} from "../ai/interfaces/ai.interfaces.js";

// type DrizzleClient = ReturnType<typeof getDb>;

export interface RecipeFilters {
  cuisines?: string;
  mealTypes?: string;
  difficulty?: string;
  minPrepTime?: number;
  maxPrepTime?: number;
  minCalories?: number;
  maxCalories?: number;
  minBudget?: number;
  maxBudget?: number;
  dateFilter?: string;
  search?: string;
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  userId?: string;
  viewScope?: "personal" | "global";
}

export interface RecipeStorageInterface {
  createRecipe(recipe: InsertRecipe): Promise<Recipe>;
  updateRecipe(
    recipeId: string,
    data: Partial<InsertRecipe>,
  ): Promise<Recipe | undefined>;
  deleteRecipe(recipeId: string): Promise<boolean>;
  toggleRecipeVisibility(
    recipeId: string,
    isPublic: boolean,
  ): Promise<Recipe | undefined>;
  deactivateRecipe(recipeId: string): Promise<Recipe | undefined>;

  updateCookingStatus(
    recipeId: string,
    status: string,
  ): Promise<Recipe | undefined>;

  getRecipes(accountId: string, filters: RecipeFilters): Promise<any>;
  getRecipeById(recipeId: string): Promise<Recipe | undefined>;
  getRecipeWithIngredients(recipeId: string): Promise<
    | (Recipe & {
        ingredients: (RecipeIngredient & { ingredient: Ingredient })[];
      })
    | undefined
  >;

  getRecentRecipes(accountId: string, limit?: number): Promise<Recipe[]>;
  getRecentRecipesWithScores(accountId: string): Promise<Recipe[]>;
  searchRecipesByName(query: string, accountId?: string): Promise<Recipe[]>;
  searchRecipesByBudget(
    accountId: string,
    maxCostPerServing: number,
    memberCount: number,
  ): Promise<Recipe[]>;
  getPublicRecipes(): Promise<Recipe[]>;

  addRecipeIngredient(
    recipeIngredient: InsertRecipeIngredient,
  ): Promise<RecipeIngredient>;
  removeRecipeIngredient(
    recipeId: string,
    ingredientId: string,
  ): Promise<boolean>;
  getRecipeIngredients(
    recipeId: string,
  ): Promise<(RecipeIngredient & { ingredient: Ingredient })[]>;

  getRecipeInteractions(userId: string, recipeIds: string[]): Promise<any[]>;
  updateRecipeInteraction(
    userId: string,
    recipeId: string,
    updates: { isLiked?: boolean; isDisliked?: boolean; isFavorite?: boolean },
  ): Promise<void>;
  updateRecipeScore(recipeId: string, scoreDelta: number): Promise<void>;
}

export class RecipeStorage implements RecipeStorageInterface {
  private _db: any = null;

  private get db() {
    if (!this._db) {
      this._db = getDb();
    }
    return this._db;
  }

  // 🧑‍🍳 Create a new recipe
  async createRecipe(recipe: InsertRecipe): Promise<Recipe> {
    const [newRecipe] = await this.db
      .insert(recipes)
      .values(recipe)
      .returning();

    return newRecipe;
  }

  // ✏️ Update recipe fields
  async updateRecipe(
    recipeId: string,
    data: Partial<InsertRecipe>,
  ): Promise<Recipe | undefined> {
    const [updated] = await this.db
      .update(recipes)
      .set({ ...data, updatedAt: sql`now()` })
      .where(eq(recipes.id, recipeId))
      .returning();
    return updated;
  }

  // 🗑️ Soft delete (or hard delete if needed)
  async deleteRecipe(recipeId: string): Promise<boolean> {
    const deleted = await this.db
      .delete(recipes)
      .where(eq(recipes.id, recipeId))
      .returning();
    return deleted.length > 0;
  }

  // 🌍 Make recipe public/private
  async toggleRecipeVisibility(
    recipeId: string,
    isPublic: boolean,
  ): Promise<Recipe | undefined> {
    const [updated] = await this.db
      .update(recipes)
      .set({ isPublic, updatedAt: sql`now()` })
      .where(eq(recipes.id, recipeId))
      .returning();
    return updated;
  }

  // 💤 Deactivate (without deleting)
  async deactivateRecipe(recipeId: string): Promise<Recipe | undefined> {
    const [updated] = await this.db
      .update(recipes)
      .set({ isActive: false, updatedAt: sql`now()` })
      .where(eq(recipes.id, recipeId))
      .returning();
    return updated;
  }

  // 🍳 Update cooking status
  async updateCookingStatus(
    recipeId: string,
    status: string,
  ): Promise<Recipe | undefined> {
    const [updated] = await this.db
      .update(recipes)
      .set({ cookingStatus: status, updatedAt: sql`now()` })
      .where(eq(recipes.id, recipeId))
      .returning();
    return updated;
  }

  // async getRecipesAlternative(accountId: string, filters: RecipeFilters) {
  //     const {
  //         cuisines,
  //         mealTypes,
  //         difficulty,
  //         minPrepTime,
  //         maxPrepTime,
  //         minCalories,
  //         maxCalories,
  //         minBudget,
  //         maxBudget,
  //         dateFilter,
  //         search,
  //         page = 1,
  //         pageSize = 10,
  //     } = filters;

  //     // Start building query
  //     let query = this.db
  //         .select()
  //         .from(recipes)
  //         .where(
  //             or(
  //                 eq(recipes.accountId, accountId),
  //                 eq(recipes.isPublic, true),
  //                 isNull(recipes.accountId)
  //             )
  //         );

  //     // Apply filters conditionally
  //     if (cuisines) {
  //         const cuisineArray = cuisines.split(',');
  //         query = query.where(inArray(recipes.cuisineType, cuisineArray));
  //     }

  //     if (mealTypes) {
  //         const mealTypeArray = mealTypes.split(',');
  //         query = query.where(inArray(recipes.mealType, mealTypeArray as any));
  //     }

  //     if (difficulty) {
  //         const difficultyArray = difficulty.split(',');
  //         query = query.where(inArray(recipes.difficultyLevel, difficultyArray as any));
  //     }

  //     if (minPrepTime) {
  //         query = query.where(gte(recipes.totalTimeMinutes, minPrepTime));
  //     }

  //     if (maxPrepTime) {
  //         query = query.where(lte(recipes.totalTimeMinutes, maxPrepTime));
  //     }

  //     if (minCalories) {
  //         query = query.where(gte(recipes.calories, minCalories));
  //     }

  //     if (maxCalories) {
  //         query = query.where(lte(recipes.calories, maxCalories));
  //     }

  //     if (search) {
  //         query = query.where(
  //             or(
  //                 ilike(recipes.name, `% ${ search }% `),
  //                 ilike(recipes.description, `% ${ search }% `),
  //                 ilike(recipes.cuisineType, `% ${ search }% `)
  //             )
  //         );
  //     }

  //     // Get count
  //     const countResult = await query;
  //     const totalRecipes = countResult.length;

  //     // Apply pagination
  //     const offset = (page - 1) * pageSize;
  //     const recipesList = await query
  //         .orderBy(desc(recipes.createdAt))
  //         .limit(pageSize)
  //         .offset(offset);

  //     return {
  //         recipes: recipesList,
  //         pagination: {
  //             page,
  //             pageSize,
  //             totalRecipes,
  //             totalPages: Math.ceil(totalRecipes / pageSize),
  //         },
  //     };
  // }

  async getRecipes(
    accountId: string,
    filters: RecipeFilters,
  ): Promise<{
    recipes: any[];

    pagination: {
      page: number;
      pageSize: number;
      totalRecipes: number;
      totalPages: number;
    };
  }> {
    const {
      cuisines,
      mealTypes,
      difficulty,
      minPrepTime,
      maxPrepTime,
      minCalories,
      maxCalories,
      minBudget,
      maxBudget,
      dateFilter,
      search,
      page = 1,
      pageSize = 10,
      sortBy = "createdAt",
      sortOrder = "desc",
      userId,
      viewScope = "personal", // Default to 'personal' as per user request
    } = filters;

    console.log({ filters });

    // Build dynamic WHERE conditions
    const conditions = [];

    if (viewScope === "global") {
      // Show: account recipes OR public recipes OR system recipes
      conditions.push(
        sql`(${recipes.accountId} = ${accountId} OR ${recipes.isPublic} = true OR ${recipes.accountId} IS NULL)`,
      );
    } else {
      // Default / personal: Show ONLY account recipes
      conditions.push(eq(recipes.accountId, accountId));
    }

    // ... (rest of filters remain same, I will reuse existing logic if possible, but I am replacing the whole block to be safe with query construction)

    // Filter logic...
    if (cuisines) {
      const cuisineArray = cuisines
        .split(",")
        .map((c) => c.trim().toLowerCase());
      conditions.push(sql`LOWER(${recipes.cuisineType}) IN ${cuisineArray} `);
    }
    if (mealTypes) {
      const mealTypeArray = mealTypes
        .split(",")
        .map((m) => m.trim().toLowerCase());
      conditions.push(sql`LOWER(${recipes.mealType}) IN ${mealTypeArray} `);
    }
    if (difficulty) {
      const difficultyArray = difficulty
        .split(",")
        .map((d) => d.trim().toLowerCase());
      conditions.push(
        sql`LOWER(${recipes.difficultyLevel}) IN ${difficultyArray} `,
      );
    }
    if (minPrepTime !== undefined)
      conditions.push(sql`${recipes.totalTimeMinutes} >= ${minPrepTime} `);
    if (maxPrepTime !== undefined)
      conditions.push(sql`${recipes.totalTimeMinutes} <= ${maxPrepTime} `);
    if (minCalories !== undefined)
      conditions.push(sql`${recipes.calories} >= ${minCalories} `);
    if (maxCalories !== undefined)
      conditions.push(sql`${recipes.calories} <= ${maxCalories} `);
    if (minBudget !== undefined)
      conditions.push(
        sql`CAST(${recipes.estimatedCostPerServing} AS DECIMAL) >= ${minBudget} `,
      );
    if (maxBudget !== undefined)
      conditions.push(
        sql`CAST(${recipes.estimatedCostPerServing} AS DECIMAL) <= ${maxBudget} `,
      );

    if (dateFilter && dateFilter !== "all") {
      const now = new Date();
      let dateThreshold: Date;
      switch (dateFilter) {
        case "today":
          dateThreshold = new Date(now.setHours(0, 0, 0, 0));
          break;
        case "week":
          dateThreshold = new Date(now.setDate(now.getDate() - 7));
          break;
        case "month":
          dateThreshold = new Date(now.setMonth(now.getMonth() - 1));
          break;
        case "year":
          dateThreshold = new Date(now.setFullYear(now.getFullYear() - 1));
          break;
        default:
          dateThreshold = new Date(0);
      }
      conditions.push(sql`${recipes.createdAt} >= ${dateThreshold} `);
    }

    if (search) {
      const searchTerm = `%${search.trim()}%`;
      conditions.push(
        sql`(${recipes.name} ILIKE ${searchTerm} OR ${recipes.description} ILIKE ${searchTerm} OR ${recipes.cuisineType} ILIKE ${searchTerm})`,
      );
    }

    const whereClause = and(...conditions);

    // Get total count
    const countQuery = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(recipes)
      .where(whereClause);

    const totalRecipes = Number(countQuery[0]?.count || 0);
    const totalPages = Math.ceil(totalRecipes / pageSize);

    // Sorting
    const orderByClauses = [];
    if (search) {
      const searchTerm = `%${search.trim()}%`;
      orderByClauses.push(
        sql`CASE WHEN ${recipes.name} ILIKE ${searchTerm} THEN 1 WHEN ${recipes.cuisineType} ILIKE ${searchTerm} THEN 2 ELSE 3 END ASC`,
      );
    }

    let primarySort;
    const sortDirection = sortOrder === "asc" ? asc : desc;
    switch (sortBy) {
      case "name":
        primarySort = sortDirection(recipes.name);
        break;
      case "totalTimeMinutes":
        primarySort = sortDirection(recipes.totalTimeMinutes);
        break;
      case "calories":
        primarySort = sortDirection(recipes.calories);
        break;
      case "estimatedCostPerServing":
        primarySort = sortDirection(recipes.estimatedCostPerServing);
        break;
      case "score":
        primarySort = desc(recipes.score);
        break; // Default score sort desc
      case "createdAt":
      default:
        primarySort = sortDirection(recipes.createdAt);
    }
    orderByClauses.push(primarySort);

    // Query with Join
    const offset = (page - 1) * pageSize;
    let query = this.db
      .select({
        ...getTableColumns(recipes),
        isLiked: userRecipeInteractions.isLiked,
        isDisliked: userRecipeInteractions.isDisliked,
        isFavorite: userRecipeInteractions.isFavorite,
      })
      .from(recipes);

    if (userId) {
      query = query.leftJoin(
        userRecipeInteractions,
        and(
          eq(recipes.id, userRecipeInteractions.recipeId),
          eq(userRecipeInteractions.userId, userId),
        ),
      );
    } else {
      // Dummy join or no join? If no join, fields will be missing/undefined in TS?
      // Actually if we Select fields from userRecipeInteractions but don't join, it might error or return nulls depending on driver.
      // Better to conditionally select. But TS types are static.
      // Let's just join on FALSE if no userId, effectively returning nulls.
      query = query.leftJoin(userRecipeInteractions, sql`1 = 0`);
    }

    const recipesList = await query
      .where(whereClause)
      .orderBy(...orderByClauses)
      .limit(pageSize)
      .offset(offset);

    // collect recipeIds from results

    const recipeIds = recipesList.map((r: any) => r.id);

    // Get ingredients with ALL enhanced data
    const ingredientsRows = await this.db
      .select({
        recipeId: recipeIngredients.recipeId,
        ingredientId: recipeIngredients.ingredientId,
        quantity: recipeIngredients.quantity,
        unit: recipeIngredients.unit,
        isOptional: recipeIngredients.isOptional,
        notes: recipeIngredients.notes,
        estimatedCost: recipeIngredients.estimatedCost,
        category: recipeIngredients.category,
        isPantryItem: recipeIngredients.isPantryItem,
        name: ingredients.name,
      })
      .from(recipeIngredients)
      .leftJoin(ingredients, eq(ingredients.id, recipeIngredients.ingredientId))
      .where(inArray(recipeIngredients.recipeId, recipeIds));

    // 🔥 Transform recipes to AI format with parsed JSON fields

    const recipesWithIngredients = recipesList.map((recipe: any) => {
      const recipeIngredientsList = ingredientsRows

        .filter((i: any) => i.recipeId === recipe.id)

        .map((ing: any) => ({
          name: ing.name || "",
          quantity: ing.quantity || "",
          unit: ing.unit || "",
          isOptional: ing.isOptional || false,
          notes: ing.notes || "",
          estimatedCost: ing.estimatedCost ? parseFloat(ing.estimatedCost) : 0,
          category: ing.category || "other",
          isPantryItem: ing.isPantryItem || false,
        }));

      // // Parse JSON fields and return in AI format
      // const nutrition = recipe.nutrition ? JSON.parse(recipe.nutrition as string) : null;
      // const costAnalysis = recipe.costAnalysis ? JSON.parse(recipe.costAnalysis as string) : null;
      // const aiMetadata = recipe.aiGeneratedMetadata ? JSON.parse(recipe.aiGeneratedMetadata as string) : null;

      console.log(recipe.aiGeneratedMetadata, "nutritionnutritionnutrition");

      return {
        id: recipe.id,
        name: recipe.name,
        description: recipe.description || "",
        cuisineType: recipe.cuisineType,
        mealType: recipe.mealType,
        imageUrl: recipe?.imageUrl || null,
        servings: recipe.servings,
        totalTimeMinutes: recipe.totalTimeMinutes,
        prepTimeMinutes: recipe.prepTimeMinutes,
        cookTimeMinutes: recipe.cookTimeMinutes,
        difficultyLevel: recipe.difficultyLevel,
        estimatedCostPerServing: recipe.estimatedCostPerServing,
        calories: recipe.calories,
        isPublic: recipe.isPublic,
        createdAt: recipe.createdAt,

        // 🔥 Parsed AI-generated data
        instructions: recipe.instructions
          ? JSON.parse(recipe.instructions)
          : [],
        nutrition: recipe.nutrition,
        costAnalysis: recipe?.costAnalysis,
        // nutritionalHighlights: recipe.nutritionalHighlights ? JSON.parse(recipe.nutritionalHighlights as string) : [],
        // cookingTips: recipe.cookingTips ? JSON.parse(recipe.cookingTips as string) : [],
        // variations: recipe.variations ? JSON.parse(recipe.variations as string) : [],
        // healthConsiderations: recipe.healthConsiderations ? JSON.parse(recipe.healthConsiderations as string) : [],
        // webSourceInspirations: recipe.webSourceInspirations ? JSON.parse(recipe.webSourceInspirations as string) : [],

        // Health and scoring
        healthScore: recipe.healthScore,
        budgetEfficiency: recipe.budgetEfficiency
          ? parseFloat(recipe.budgetEfficiency)
          : undefined,

        // Pantry data from metadata
        // pantryOptimization: aiMetadata?.pantryOptimization || [],
        // canGenerateRecipe: aiMetadata?.canGenerateRecipe !== false,
        // insufficientPantryReason: aiMetadata?.insufficientPantryReason,
        // suggestedPantryAdditions: aiMetadata?.suggestedPantryAdditions || [],
        // pantryItemsUsedCount: aiMetadata?.pantryItemsUsedCount || 0,

        // AI reasoning
        aiReasoningNotes: recipe.aiReasoningNotes,

        // Statistics
        timesCooked: recipe.timesCooked || 0,
        averageRating: recipe.averageRating
          ? parseFloat(recipe.averageRating)
          : undefined,
        totalRatings: recipe.totalRatings || 0,

        // Interactions
        score: recipe.score || 0,
        isLiked: recipe.isLiked || false,
        isDisliked: recipe.isDisliked || false,
        isFavorite: recipe.isFavorite || false,

        // Ingredients in AI format
        ingredients: recipeIngredientsList,
      };
    });

    return {
      recipes: recipesWithIngredients,
      pagination: {
        page,
        pageSize,
        totalRecipes,
        totalPages,
      },
    };
  }

  // 🔍 Get single recipe
  async getRecipeById(recipeId: string): Promise<Recipe | undefined> {
    const [recipe] = await this.db
      .select()
      .from(recipes)
      .where(eq(recipes.id, recipeId));
    return recipe;
  }

  // 🧾 Get recipe + ingredients in AI format

  async getRecipeWithIngredients(recipeId: string): Promise<any | undefined> {
    const recipe = await this.getRecipeById(recipeId);
    if (!recipe) return undefined;

    const ingredientsData = await this.getRecipeIngredients(recipeId);

    // Transform to AI format
    const ingredientsList = ingredientsData.map((ing) => ({
      name: ing.ingredient.name,
      quantity: ing.quantity || "",
      unit: ing.unit || "",
      isOptional: ing.isOptional || false,
      notes: ing.notes || "",
      estimatedCost: ing.estimatedCost ? parseFloat(ing.estimatedCost) : 0,
      category: ing.category || "other",
      isPantryItem: ing.isPantryItem || false,
    }));

    // Parse JSON fields
    const nutrition = recipe.nutrition
      ? JSON.parse(recipe.nutrition as string)
      : null;
    const costAnalysis = recipe.costAnalysis
      ? JSON.parse(recipe.costAnalysis as string)
      : null;
    const aiMetadata = recipe.aiGeneratedMetadata
      ? JSON.parse(recipe.aiGeneratedMetadata as string)
      : null;

    console.log({ recipe });

    return {
      id: recipe.id,
      name: recipe.name,
      description: recipe.description || "",
      cuisineType: recipe.cuisineType,
      mealType: recipe.mealType,
      servings: recipe.servings,
      totalTimeMinutes: recipe.totalTimeMinutes,
      prepTimeMinutes: recipe.prepTimeMinutes,
      cookTimeMinutes: recipe.cookTimeMinutes,
      difficultyLevel: recipe.difficultyLevel,
      estimatedCostPerServing: recipe.estimatedCostPerServing,
      calories: recipe.calories,
      isPublic: recipe.isPublic,
      createdAt: recipe.createdAt,

      // Parsed AI data
      instructions: recipe.instructions ? JSON.parse(recipe.instructions) : [],
      nutrition: nutrition,
      costAnalysis: costAnalysis || {
        totalCost: costAnalysis?.totalCost || 0,
        costPerServing: recipe.estimatedCostPerServing
          ? parseFloat(recipe.estimatedCostPerServing)
          : 0,
        budgetEfficiency: recipe.budgetEfficiency
          ? parseFloat(recipe.budgetEfficiency)
          : 0,
      },
      nutritionalHighlights: recipe.nutritionalHighlights
        ? JSON.parse(recipe.nutritionalHighlights as string)
        : [],
      cookingTips: recipe.cookingTips
        ? JSON.parse(recipe.cookingTips as string)
        : [],
      variations: recipe.variations
        ? JSON.parse(recipe.variations as string)
        : [],
      healthConsiderations: recipe.healthConsiderations
        ? JSON.parse(recipe.healthConsiderations as string)
        : [],
      webSourceInspirations: recipe.webSourceInspirations
        ? JSON.parse(recipe.webSourceInspirations as string)
        : [],

      healthScore: recipe.healthScore,
      budgetEfficiency: recipe.budgetEfficiency
        ? parseFloat(recipe.budgetEfficiency)
        : undefined,

      pantryOptimization: aiMetadata?.pantryOptimization || [],
      canGenerateRecipe: aiMetadata?.canGenerateRecipe !== false,
      insufficientPantryReason: aiMetadata?.insufficientPantryReason,
      suggestedPantryAdditions: aiMetadata?.suggestedPantryAdditions || [],
      pantryItemsUsedCount: aiMetadata?.pantryItemsUsedCount || 0,

      aiReasoningNotes: recipe.aiReasoningNotes,

      timesCooked: recipe.timesCooked || 0,
      averageRating: recipe.averageRating
        ? parseFloat(recipe.averageRating)
        : undefined,
      totalRatings: recipe.totalRatings || 0,

      ingredients: ingredientsList,
    };
  }

  // 🕒 Get recently created recipes
  async getRecentRecipes(accountId: string, limit = 10): Promise<Recipe[]> {
    return this.db
      .select()
      .from(recipes)
      .where(
        sql`${recipes.accountId} = ${accountId} OR ${recipes.isPublic} = true`,
      )
      .orderBy(desc(recipes.createdAt))
      .limit(limit);
  }

  // 🔎 Search recipes by name or keyword
  async searchRecipesByName(
    query: string,
    accountId?: string,
  ): Promise<Recipe[]> {
    const q = `% ${query}% `;
    if (accountId) {
      return this.db
        .select()
        .from(recipes)
        .where(
          sql`(${recipes.accountId} = ${accountId} OR ${recipes.isPublic} = true) 
            AND ${recipes.name} ILIKE ${q} `,
        )
        .orderBy(desc(recipes.createdAt));
    }
    return this.db
      .select()
      .from(recipes)
      .where(sql`${recipes.isPublic} = true AND ${recipes.name} ILIKE ${q} `)
      .orderBy(desc(recipes.createdAt));
  }

  // 💰 Budget-based search
  async searchRecipesByBudget(
    accountId: string,
    maxCostPerServing: number,
    //eslint-disable-next-line @typescript-eslint/no-unused-vars
    memberCount: number,
  ): Promise<Recipe[]> {
    return this.db
      .select()
      .from(recipes)
      .where(
        sql`(${recipes.accountId} = ${accountId} 
          OR ${recipes.isPublic} = true 
          OR ${recipes.accountId} IS NULL)
          AND ${recipes.estimatedCostPerServing} <= ${maxCostPerServing}
          AND ${recipes.isActive} = true`,
      )
      .orderBy(recipes.estimatedCostPerServing)
      .limit(50);
  }

  // 🌎 Get all public recipes
  async getPublicRecipes(): Promise<Recipe[]> {
    return this.db
      .select()
      .from(recipes)
      .where(eq(recipes.isPublic, true))
      .orderBy(desc(recipes.createdAt));
  }

  // 🧂 Add ingredient to recipe
  async addRecipeIngredient(
    recipeIngredient: InsertRecipeIngredient,
  ): Promise<RecipeIngredient> {
    const [newIngredient] = await this.db
      .insert(recipeIngredients)
      .values(recipeIngredient)
      .returning();
    return newIngredient;
  }

  // ❌ Remove ingredient from recipe
  async removeRecipeIngredient(
    recipeId: string,
    ingredientId: string,
  ): Promise<boolean> {
    const deleted = await this.db
      .delete(recipeIngredients)
      .where(
        and(
          eq(recipeIngredients.recipeId, recipeId),
          eq(recipeIngredients.ingredientId, ingredientId),
        ),
      )
      .returning();
    return deleted.length > 0;
  }

  // 🧾 Get recipe ingredients with details
  async getRecipeIngredients(
    recipeId: string,
  ): Promise<(RecipeIngredient & { ingredient: Ingredient })[]> {
    return this.db
      .select({
        ...getTableColumns(recipeIngredients),
        ingredient: getTableColumns(ingredients),
      })
      .from(recipeIngredients)
      .innerJoin(
        ingredients,
        eq(recipeIngredients.ingredientId, ingredients.id),
      )
      .where(eq(recipeIngredients.recipeId, recipeId));
  }

  async getRecentRecipesWithScores(accountId: string): Promise<any[]> {
    const dateThreshold = new Date();
    dateThreshold.setDate(dateThreshold.getDate() - 60);

    const recentRecipes = await this.db
      .select({
        id: recipes.id,
        name: recipes.name,
        averageRating: recipes.averageRating,
        updatedAt: recipes.updatedAt,
        createdAt: recipes.createdAt,
        timesCooked: recipes.timesCooked,
        cuisineType: recipes.cuisineType,
        mealType: recipes.mealType,
      })
      .from(recipes)
      .where(
        and(
          sql`(${recipes.accountId} = ${accountId} OR ${recipes.isPublic} = true)`,
          sql`${recipes.createdAt} >= ${dateThreshold}`,
        ),
      )
      .orderBy(desc(recipes.createdAt));

    return recentRecipes.map((r: any) => ({
      recipeId: r.id,
      recipeName: r.name,
      score: parseFloat(r.averageRating || "0"),
      interactions: [], // No detailed interactions table available yet
      lastInteraction: r.updatedAt || r.createdAt,
      timesCooked: r.timesCooked || 0,
      cuisineType: r.cuisineType,
      mealType: r.mealType,
      ingredients: [],
    }));
  }

  async getRecipeInteractions(
    userId: string,
    recipeIds: string[],
  ): Promise<any[]> {
    return this.db
      .select()
      .from(userRecipeInteractions)
      .where(
        and(
          eq(userRecipeInteractions.userId, userId),
          inArray(userRecipeInteractions.recipeId, recipeIds),
        ),
      );
  }

  async updateRecipeInteraction(
    userId: string,
    recipeId: string,
    updates: { isLiked?: boolean; isDisliked?: boolean; isFavorite?: boolean },
  ): Promise<void> {
    const existing = await this.db
      .select()
      .from(userRecipeInteractions)
      .where(
        and(
          eq(userRecipeInteractions.userId, userId),
          eq(userRecipeInteractions.recipeId, recipeId),
        ),
      )
      .limit(1);

    if (existing.length > 0) {
      await this.db
        .update(userRecipeInteractions)
        .set({ ...updates, updatedAt: sql`now()` })
        .where(eq(userRecipeInteractions.id, existing[0].id));
    } else {
      await this.db.insert(userRecipeInteractions).values({
        userId,
        recipeId,
        ...updates,
      });
    }
  }

  async updateRecipeScore(recipeId: string, scoreDelta: number): Promise<void> {
    await this.db
      .update(recipes)
      .set({
        score: sql`${recipes.score} + ${scoreDelta}`,
        updatedAt: sql`now()`,
      })
      .where(eq(recipes.id, recipeId));
  }

  async storeAIGeneratedRecipes(
    aiResponse: AIGeneratedRecipe[],
    request: AIRecipeRequest,
  ): Promise<AIGeneratedRecipe[]> {
    if (!request.accountId) {
      console.log("Skipping recipe storage — no accountId found");
      // Return original recipes with temporary IDs if no accountId
      return aiResponse.map((recipe, index) => ({
        ...recipe,
        id: `temp - ${Date.now()} -${index} `,
      }));
    }

    const recipesWithIds: AIGeneratedRecipe[] = [];

    for (const recipe of aiResponse) {
      // 1️⃣ Build recipe entry for `recipes` table with ALL AI data
      const insertRecipe: InsertRecipe = {
        accountId: request.accountId,
        name: recipe.name,
        description: recipe.description || "",
        imageUrl: recipe.imageUrl || null, // Map Image URL
        instructions: JSON.stringify(recipe.instructions || []),
        servings: recipe.servings,
        prepTimeMinutes: recipe.totalTimeMinutes * 0.4, // estimated split
        cookTimeMinutes: recipe.totalTimeMinutes * 0.6,
        totalTimeMinutes: recipe.totalTimeMinutes,

        difficultyLevel: recipe.difficultyLevel as any,
        mealType: recipe.mealType as any,
        cuisineType: recipe.cuisineType as any,
        estimatedCostPerServing:
          recipe.costAnalysis?.costPerServing?.toString() || null,
        calories: recipe.nutrition?.calories || null,

        // 🔥 NEW: Store ALL AI-generated data
        nutrition: recipe.nutrition ? JSON.stringify(recipe.nutrition) : null,
        costAnalysis: recipe.costAnalysis
          ? JSON.stringify(recipe.costAnalysis)
          : null,
        nutritionalHighlights: recipe.nutritionalHighlights
          ? JSON.stringify(recipe.nutritionalHighlights)
          : null,
        cookingTips: recipe.cookingTips
          ? JSON.stringify(recipe.cookingTips)
          : null,
        variations: recipe.variations
          ? JSON.stringify(recipe.variations)
          : null,
        healthConsiderations: recipe.healthConsiderations
          ? JSON.stringify(recipe.healthConsiderations)
          : null,
        webSourceInspirations: recipe.webSourceInspirations
          ? JSON.stringify(recipe.webSourceInspirations)
          : null,

        // Health and scoring
        healthScore: recipe.healthScore || null,
        budgetEfficiency:
          recipe.costAnalysis?.budgetEfficiency?.toString() || null,

        // AI reasoning
        aiReasoningNotes: recipe.aiReasoningNotes || null,
        aiGeneratedMetadata: recipe.pantryOptimization
          ? JSON.stringify({
              pantryOptimization: recipe.pantryOptimization,
              canGenerateRecipe: recipe.canGenerateRecipe,
              insufficientPantryReason: recipe.insufficientPantryReason,
              suggestedPantryAdditions: recipe.suggestedPantryAdditions,
              pantryItemsUsedCount: recipe.pantryItemsUsedCount,
            })
          : null,

        // Initialize statistics
        timesCooked: 0,
        averageRating: null,
        totalRatings: 0,
      };

      // 2️⃣ Insert into recipes table
      const saved = await this.createRecipe(insertRecipe);

      // 3️⃣ Store ingredients into recipe_ingredients with enhanced data
      for (const ing of recipe.ingredients) {
        const ingredient = await this.db
          .select()
          .from(ingredients)
          .where(ilike(ingredients.name, ing.name))
          .limit(1);

        let ingredientId = ingredient?.[0]?.id;

        // If ingredient doesn't exist → create one
        if (!ingredientId) {
          const [newIng] = await this.db
            .insert(ingredients)
            .values({
              name: ing.name || "",
              category: ing.category || "misc",
              averagePrice: ing.estimatedCost
                ? ing.estimatedCost.toString()
                : null,
              averageUnit: ing.unit || "unit",
              isPerishable: false,
              shelfLifeDays: 0,
            })
            .returning();

          ingredientId = newIng.id;
        }

        // Insert into junction table with ALL ingredient data

        const recipeIng: any = {
          recipeId: saved.id,
          ingredientId,
          quantity: ing.quantity || "1",
          unit: ing.unit as any,
          isOptional: ing.isOptional || false,
          notes: ing.notes || "",

          // 🔥 NEW: Store enhanced ingredient data
          estimatedCost: ing.estimatedCost?.toString() || null,
          category: ing.category || null,
          isPantryItem: ing.isPantryItem || false,
          substitutions: null, // Can be added if available in ingredient data
          preparationNotes: null, // Can be added if available
        };

        await this.addRecipeIngredient(recipeIng);
      }

      // 🔥 Add the database ID to the AI generated recipe
      recipesWithIds.push({
        ...recipe,
        id: saved.id.toString(), // Convert DB id to string for consistency
      });
    }

    console.log(
      `✅ Stored ${recipesWithIds.length} recipes with complete AI data for account: ${request.accountId} `,
    );

    return recipesWithIds;
  }
}
