import {
  eq,
  sql,
  desc,
  and,
  ilike,
  asc,
  inArray,
  getTableColumns,
  gte,
  lte,
} from "drizzle-orm";
import { getDb } from "../../database/db.js";
import {
  recipes,
  ingredients,
  recipeIngredients,
  recipeShoppingListItems,
  userRecipeInteractions,
  Ingredient,
  InsertRecipe,
  InsertRecipeIngredient,
  InsertRecipeShoppingListItem,
  Recipe,
  RecipeIngredient,
} from "../../database/schemas/schema.js";

import {
  AIGeneratedRecipe,
  AIRecipeRequest,
  ShoppingListItem,
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
        shoppingList?: ShoppingListItem[];
      })
    | undefined
  >;

  getRecentRecipes(accountId: string, limit?: number): Promise<Recipe[]>;
  getRecentRecipesWithScores(
    accountId: string,
    cuisineType: string,
  ): Promise<Recipe[]>;
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

  addRecipeShoppingListItems(
    items: InsertRecipeShoppingListItem[],
  ): Promise<void>;

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
  retrieveShoppingList(recipeId: string): Promise<ShoppingListItem[]>;
  retrieveMergedShoppingList(recipeIds: string[]): Promise<ShoppingListItem[]>;
  getRecipesByDateAndMealType(
    accountId: string,
    date: string,
    mealType: string,
  ): Promise<Recipe[]>;
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
        instructions: this.safeJsonParse(recipe.instructions, []),
        nutrition: recipe.nutrition,
        costAnalysis: recipe?.costAnalysis,

        // Health and scoring
        healthScore: recipe.healthScore,
        budgetEfficiency: recipe.budgetEfficiency
          ? parseFloat(recipe.budgetEfficiency)
          : undefined,

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

    // Fetch shopping list items from new table
    const shoppingListRows = await this.db
      .select()
      .from(recipeShoppingListItems)
      .where(eq(recipeShoppingListItems.recipeId, recipeId));

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
    const nutrition = this.safeJsonParse(recipe.nutrition, null);
    const costAnalysis = this.safeJsonParse(recipe.costAnalysis, null);
    const aiMetadata = this.safeJsonParse(recipe.aiGeneratedMetadata, null);

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
      instructions: this.safeJsonParse(recipe.instructions, []),
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
      nutritionalHighlights: this.safeJsonParse(
        recipe.nutritionalHighlights,
        [],
      ),
      cookingTips: this.safeJsonParse(recipe.cookingTips, []),
      variations: this.safeJsonParse(recipe.variations, []),
      healthConsiderations: this.safeJsonParse(recipe.healthConsiderations, []),
      webSourceInspirations: this.safeJsonParse(
        recipe.webSourceInspirations,
        [],
      ),

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

      shoppingList:
        shoppingListRows.length > 0
          ? shoppingListRows.map((item: any) => ({
              ingredientName: item.ingredientName,
              quantity: item.quantity,
              unit: item.unit,
            }))
          : aiMetadata?.shoppingList ||
            ingredientsList.map((ing) => ({
              ingredientName: ing.name,
              quantity: ing.quantity,
              unit: ing.unit,
            })),

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

  // 🛒 Add shopping list items
  async addRecipeShoppingListItems(
    items: InsertRecipeShoppingListItem[],
  ): Promise<void> {
    if (items.length === 0) return;
    await this.db.insert(recipeShoppingListItems).values(items);
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

  async getRecentRecipesWithScores(
    accountId: string,
    cuisineType?: string,
  ): Promise<any[]> {
    const dateThreshold = new Date();
    dateThreshold.setDate(dateThreshold.getDate() - 30);

    // Build WHERE conditions dynamically
    const conditions = [
      sql`(${recipes.accountId} = ${accountId} OR ${recipes.isPublic} = true)`,
      sql`${recipes.createdAt} >= ${dateThreshold}`,
    ];

    // Only add cuisine filter if cuisineType is provided and not empty
    if (cuisineType && cuisineType.trim() !== "") {
      conditions.push(sql`${recipes.cuisineType} = ${cuisineType}`);
    }

    const recentRecipes = await this.db
      .select({
        name: recipes.name,
        averageRating: recipes.averageRating,
        timesCooked: recipes.timesCooked,
        cuisineType: recipes.cuisineType,
        mealType: recipes.mealType,
      })
      .from(recipes)
      .where(and(...conditions))
      .orderBy(desc(recipes.createdAt));

    return recentRecipes.map((r: any) => ({
      recipeName: r.name,
      score: parseFloat(r.averageRating || "0"),
      interactions: [], // No detailed interactions table available yet
      lastInteraction: r.updatedAt || r.createdAt,
      timesCooked: r.timesCooked || 0,
      cuisineType: r.cuisineType,
      mealType: r.mealType,
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
              shoppingList: recipe.shoppingList, // Persist specific shopping list
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
        // Enforce cleanup and standardization of ingredient name as requested
        const ingredientName = ing.name ? ing.name.trim() : "";
        if (!ingredientName) continue;

        // Check if ingredient already available in DB
        const ingredient = await this.db
          .select()
          .from(ingredients)
          .where(ilike(ingredients.name, ingredientName))
          .limit(1);

        let ingredientId = ingredient?.[0]?.id;

        // If available matches -> use it
        // If not available -> add it to ingredients table
        if (!ingredientId) {
          const [newIng] = await this.db
            .insert(ingredients)
            .values({
              name: ingredientName, // use clean name
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

        // Add to recipe-ingredients (junction table)
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

      // 4️⃣ Store shopping list items
      if (recipe.shoppingList && recipe.shoppingList.length > 0) {
        const shoppingListItems: InsertRecipeShoppingListItem[] = [];

        for (const item of recipe.shoppingList) {
          const shoppingItemName = item.ingredientName
            ? item.ingredientName.trim()
            : "";
          if (!shoppingItemName) continue;

          // 4.1 Check if this item exists in ingredients table (fuzzy match or exact)
          let ingredientId: string | undefined;

          // Try to match with ingredients we JUST added to the recipe first (context awareness)
          const matchingRecipeIngredient = await this.db
            .select({
              id: recipeIngredients.id,
              ingredientId: recipeIngredients.ingredientId,
            })
            .from(recipeIngredients)
            .leftJoin(
              ingredients,
              eq(recipeIngredients.ingredientId, ingredients.id),
            )
            .where(
              and(
                eq(recipeIngredients.recipeId, saved.id),
                ilike(ingredients.name, shoppingItemName),
              ),
            )
            .limit(1);

          let recipeIngredientId = matchingRecipeIngredient[0]?.id;

          if (!recipeIngredientId) {
            // 4.2 If not in recipe ingredients, check global ingredients table
            const existingIngredient = await this.db
              .select()
              .from(ingredients)
              .where(ilike(ingredients.name, shoppingItemName))
              .limit(1);

            ingredientId = existingIngredient[0]?.id;

            // 4.3 If not in global ingredients, create it
            if (!ingredientId) {
              const [newIng] = await this.db
                .insert(ingredients)
                .values({
                  name: shoppingItemName,
                  category: "pantry", // Default to pantry for shopping list items
                  averageUnit: item.unit || "unit",
                  isPerishable: false,
                })
                .returning();
              ingredientId = newIng.id;
            }

            // 4.4 Create a recipe_ingredient entry (even if quantity is different or 0, it links the item)
            // User requested: "pehle recipe ingredients me add kro"
            const [newRecipeIng] = await this.db
              .insert(recipeIngredients)
              .values({
                recipeId: saved.id,
                ingredientId: ingredientId,
                quantity: item.quantity, // Use shopping list quantity
                unit: item.unit,
                isOptional: false,
                category: "pantry",
                isPantryItem: false,
                notes: "From Shopping List",
              })
              .returning();

            recipeIngredientId = newRecipeIng.id;
          }

          // 4.5 Add to shopping list items payload
          shoppingListItems.push({
            recipeId: saved.id,
            recipeIngredientId: recipeIngredientId, // Linked!
            ingredientName: shoppingItemName,
            quantity: item.quantity,
            unit: item.unit,
            isChecked: false,
          });
        }

        await this.addRecipeShoppingListItems(shoppingListItems);
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

  // 🛍️ Get shopping list for a single recipe
  async retrieveShoppingList(recipeId: string): Promise<ShoppingListItem[]> {
    // 1. Try to get explicit shopping list items
    const shoppingListRows = await this.db
      .select()
      .from(recipeShoppingListItems)
      .where(eq(recipeShoppingListItems.recipeId, recipeId));

    if (shoppingListRows.length > 0) {
      return shoppingListRows.map((item: any) => ({
        ingredientName: item.ingredientName,
        quantity: item.quantity,
        unit: item.unit,
        isChecked: item.isChecked || false,
      }));
    }

    // 2. Fallback: Get ingredients
    const ingredientsData = await this.getRecipeIngredients(recipeId);
    if (ingredientsData.length > 0) {
      return ingredientsData.map((ing) => ({
        ingredientName: ing.ingredient.name,
        quantity: ing.quantity || "1",
        unit: ing.unit || "unit",
        isChecked: false,
      }));
    }

    // 3. Last resort: AI Metadata (requires fetching recipe)
    const recipe = await this.getRecipeById(recipeId);
    if (recipe?.aiGeneratedMetadata) {
      const metadata = this.safeJsonParse(recipe.aiGeneratedMetadata, {});
      if (metadata.shoppingList && Array.isArray(metadata.shoppingList)) {
        return metadata.shoppingList;
      }
    }

    return [];
  }

  // 🛍️🛒 Get merged shopping list for multiple recipes
  async retrieveMergedShoppingList(
    recipeIds: string[],
  ): Promise<ShoppingListItem[]> {
    let allItems: ShoppingListItem[] = [];

    // Fetch lists for all recipes (parallelly for performance)
    const lists = await Promise.all(
      recipeIds.map((id) => this.retrieveShoppingList(id)),
    );

    // Flatten
    allItems = lists.flat();

    // Merge logic
    // Group by Ingredient Name + Unit (normalized)
    const mergedMap = new Map<string, ShoppingListItem>();

    for (const item of allItems) {
      const name = item.ingredientName.trim().toLowerCase();
      const unit = item.unit ? item.unit.trim().toLowerCase() : "unit";
      const key = `${name}::${unit}`;

      if (mergedMap.has(key)) {
        const existing = mergedMap.get(key)!;

        // Try to sum quantities if they are numeric
        const existingQty = parseFloat(existing.quantity);
        const currentQty = parseFloat(item.quantity);

        if (!isNaN(existingQty) && !isNaN(currentQty)) {
          existing.quantity = (existingQty + currentQty).toString();
        } else {
          // If cannot sum, maybe append? Or just leave as is (showing simplest first).
          // Better to show "1 cup + 2 tbsp" style?
          // For now, simplicity: if one is not number, just keep the first one or append strings?
          // User asked to MERGE.
          // Let's trying appending string if not numeric.
          if (existing.quantity !== item.quantity) {
            // prevent duplicates like "1 item, 1 item"
            // actually simpler to just sum if numbers, else ignored
          }
        }
      } else {
        mergedMap.set(key, { ...item }); // clone to avoid mutation issues
      }
    }

    return Array.from(mergedMap.values());
  }

  // 📅 Get recipes by date and meal type
  async getRecipesByDateAndMealType(
    accountId: string,
    date: string,
    mealType: string,
  ): Promise<Recipe[]> {
    // Parse the date string and create separate date objects for start and end of day
    const targetDate = new Date(date);

    // Create start of day (00:00:00.000)
    const startOfDay = new Date(
      targetDate.getFullYear(),
      targetDate.getMonth(),
      targetDate.getDate(),
      0,
      0,
      0,
      0,
    );

    // Create end of day (23:59:59.999)
    const endOfDay = new Date(
      targetDate.getFullYear(),
      targetDate.getMonth(),
      targetDate.getDate(),
      23,
      59,
      59,
      999,
    );

    return this.db
      .select()
      .from(recipes)
      .where(
        and(
          eq(recipes.accountId, accountId),
          gte(recipes.createdAt, startOfDay),
          lte(recipes.createdAt, endOfDay),
          eq(recipes.mealType, mealType.toLowerCase() as any),
        ),
      )
      .orderBy(desc(recipes.createdAt))
      .limit(1);
  }

  private safeJsonParse(data: any, fallback: any = []) {
    if (!data) return fallback;
    if (typeof data === "object") return data;
    try {
      return JSON.parse(data);
    } catch {
      return fallback;
    }
  }
}
