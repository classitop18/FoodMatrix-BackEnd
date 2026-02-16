import { AdvancedRecipePromptBuilder } from "../builder/recipe-prompt.builder.js";
import {
  AIProvider,
  AIGeneratedRecipe,
  AIRecipeRequest,
  NutritionInfo,
  RECIPE_GENERATION_SYSTEM_PROMPT,
  RecipeParser,
  RecipeStorage,
} from "../interfaces/ai.interfaces.js";
import fs from "fs";
import fsPromises from "fs/promises";
import path from "path";
import axios from "axios";
import { randomUUID } from "crypto";
import { scaleQuantityString } from "../../../utils/math.utils.js";
import { AppError } from "../../../utils/app-error.utils.js";

export class AIRecipeService {
  constructor(
    private aiProvider: AIProvider,
    private promptBuilder: AdvancedRecipePromptBuilder,
    private recipeParser: RecipeParser,
    private recipeStorage: RecipeStorage,
  ) {}

  private async downloadAndSaveImage(
    url: string,
    // recipeName: string,
  ): Promise<string> {
    try {
      const uploadsDir = path.join(
        process.cwd(),
        "public",
        "uploads",
        "recipes",
      );
      if (!fs.existsSync(uploadsDir)) {
        await fsPromises.mkdir(uploadsDir, { recursive: true });
      }

      const extension = "png"; // DALL-E usually returns PNG
      const filename = `${randomUUID()}.${extension}`;
      const filepath = path.join(uploadsDir, filename);

      const response = await axios({
        url,
        method: "GET",
        responseType: "arraybuffer",
      });

      await fsPromises.writeFile(filepath, response.data);

      return `/uploads/recipes/${filename}`;
    } catch (error) {
      console.error("Failed to download image:", error);
      return url; // Fallback to original URL
    }
  }

  async generatePersonalizedRecipes(
    request: AIRecipeRequest,
  ): Promise<AIGeneratedRecipe[]> {
    try {
      // Validate request
      this.validateRequest(request);

      // Load user's recipe history with scores (last 1 months)
      const recipeHistory = await this.recipeStorage.getRecentRecipesWithScores(
        request.accountId,
        request.cuisine,
      );

      // Enhance request with historical data
      const enhancedRequest: AIRecipeRequest = {
        ...request,
        recipeHistory,
        avoidRecentRecipes: recipeHistory
          .filter(
            (r) =>
              r?.lastInteraction >
              new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
          ) // Last 14 days (current + previous week)
          .map((r) => r?.recipeName),
      };

      console.log("🤖 AI Recipe Generation Started:", {
        provider: this.aiProvider.getProviderName(),
        accountId: request.accountId,
        mealType: request.mealType,
        recipeCount: request.recipeCount,
        servings: request.servings,
        usePantry: request.usePantryItems,
        pantryOnly: request.pantryOnly,
        historySize: recipeHistory.length,
        recentRecipesToAvoid: enhancedRequest.avoidRecentRecipes?.length || 0,
      });

      // Build advanced prompt with all learning data
      const prompt = await this.promptBuilder.buildPrompt(enhancedRequest);

      // Write full prompt to file to avoid truncation
      try {
        const logsDir = path.join(process.cwd(), "logs");
        if (!fs.existsSync(logsDir)) {
          await fsPromises.mkdir(logsDir, { recursive: true });
        }
        const logFile = path.join(logsDir, "last_ai_prompt.log");
        const logContent = `
==========================================
TIMESTAMP: ${new Date().toISOString()}
==========================================
REQUEST DATA:
${JSON.stringify(enhancedRequest, null, 2)}
==========================================
GENERATED PROMPT:
${typeof prompt === "string" ? prompt : JSON.stringify(prompt, null, 2)}
==========================================
`;
        await fsPromises.writeFile(logFile, logContent);
        console.log(`✅ Detailed AI Prompt written to: ${logFile}`);
      } catch (err) {
        console.error("Failed to write prompt debug log:", err);
      }

      // Generate recipes using AI
      const maxTokens = this.calculateMaxTokens(request.recipeCount);
      const response = await this.aiProvider.createCompletion({
        prompt,
        systemPrompt: RECIPE_GENERATION_SYSTEM_PROMPT,
        maxTokens,
        temperature: 0.7,
      });
      console.log("✅ AI Response Received:", {
        contentLength: response.content.length,
        tokensUsed: response.usage?.totalTokens || "N/A",
      });
      console.log("AI RESPONSE:", JSON.stringify(response, null, 2));
      // Parse and validate recipes
      const recipes = this.recipeParser.parse(
        response.content,
        enhancedRequest,
      );

      // Post-processing validations
      const validatedRecipes = await this.postProcessRecipes(
        recipes,
        enhancedRequest,
      );

      console.log({ validatedRecipes, enhancedRequest });

      // Store generated recipes for future learning
      const recipesWithIds: any =
        await this.recipeStorage.storeAIGeneratedRecipes(
          validatedRecipes,
          enhancedRequest,
        );

      console.log("🎉 Recipe Generation Complete:", {
        recipesGenerated: validatedRecipes.length,
        avgHealthScore: this.calculateAvgHealthScore(validatedRecipes),
        avgCostPerServing: this.calculateAvgCost(validatedRecipes),
        pantryUsage: this.calculatePantryUsage(validatedRecipes),
      });

      return recipesWithIds;
    } catch (error) {
      console.error("❌ AI Recipe Generation Error:", error);
      const message =
        error instanceof Error ? error.message : "Unknown error occurred";

      if (message.includes("timeout") || message.includes("ETIMEDOUT")) {
        throw new Error(
          "Recipe generation timed out. Please try again with fewer recipes or simpler requirements.",
        );
      }

      if (message.includes("budget") || message.includes("pantry")) {
        throw new Error(
          `Constraint error: ${message}. Please adjust your requirements.`,
        );
      }

      throw new Error(`Failed to generate AI recipes: ${message}`);
    }
  }

  private validateRequest(request: AIRecipeRequest): void {
    // Validate recipe count
    if (request.recipeCount < 1 || request.recipeCount > 5) {
      throw new Error("Recipe count must be between 1 and 5");
    }

    // Validate servings
    if (request.servings < 1 || request.servings > 20) {
      throw new Error("Servings must be between 1 and 20");
    }

    // Validate budget
    if (request.maxBudgetPerServing && request.maxBudgetPerServing < 1) {
      throw new Error("Budget per serving must be at least $1");
    }

    // Validate pantry-only mode
    if (request.pantryOnly && !request.usePantryItems) {
      throw new Error("pantryOnly requires usePantryItems to be true");
    }

    // Validate required fields
    if (!request.accountId) {
      throw new Error("accountId is required");
    }

    if (!request.mealType) {
      throw new Error("mealType is required");
    }
  }

  private calculateMaxTokens(recipeCount: number): number {
    // Allocate tokens based on recipe count
    const baseTokens = 2000;
    const tokensPerRecipe = 1500;
    return baseTokens + recipeCount * tokensPerRecipe;
  }

  private async postProcessRecipes(
    recipes: AIGeneratedRecipe[],
    request: AIRecipeRequest,
  ): Promise<AIGeneratedRecipe[]> {
    // Process recipes in parallel
    return Promise.all(
      recipes.map(async (recipe) => {
        // Ensure servings match request
        if (recipe.servings !== request.servings) {
          recipe = this.adjustServings(recipe, request.servings);
        }

        // Validate budget compliance
        if (
          request.maxBudgetPerServing &&
          recipe.costAnalysis.costPerServing > request.maxBudgetPerServing * 1.1
        ) {
          console.warn(
            `Recipe "${recipe.name}" exceeds budget: ${recipe.costAnalysis.costPerServing}`,
          );
        }

        // Ensure nutrition exists
        if (!recipe.nutrition) {
          recipe.nutrition = this.estimateNutrition(recipe);
        }

        // Validate pantry constraints
        if (request.pantryOnly) {
          const nonPantryItems = recipe.ingredients.filter(
            (ing) => !ing.isPantryItem,
          );
          if (nonPantryItems.length > 0) {
            console.warn(
              `Recipe "${recipe.name}" has non-pantry items in pantry-only mode`,
            );
          }
        }

        // Generate AI Image if provider supports it (OpenAI)
        try {
          // Generate AI Image if provider supports it (OpenAI)
          if (this.aiProvider.getProviderName() === "OpenAI") {
            console.log(`🎨 Generating AI Image for: ${recipe.name}`);
            const imagePrompt = `Professional food photography of ${recipe.name}, ${recipe.description.substring(0, 100)}, high resolution, 4k, appetizing, studio lighting, top down view`;

            const generatedUrl = await this.aiProvider.generateImage({
              prompt: imagePrompt,
              size: "1024x1024",
              quality: "standard",
            });

            if (generatedUrl && generatedUrl.length > 0) {
              // Download and save locally
              const localUrl = await this.downloadAndSaveImage(
                generatedUrl,
                // recipe.name,
              );
              recipe.imageUrl = localUrl;
            } else {
              console.warn(
                `⚠️ DALL-E returned empty URL for ${recipe.name}, using fallback`,
              );
              recipe.imageUrl = `https://placehold.co/1024x1024/3d326d/FFF?text=${encodeURIComponent(recipe.name)}`;
            }
          } else {
            // Fallback for non-OpenAI providers
            recipe.imageUrl = `https://placehold.co/1024x1024/7dab4f/FFF?text=${encodeURIComponent(recipe.name)}`;
          }
        } catch (imageError) {
          console.error(
            `⚠️ Failed to generate AI image for ${recipe.name}, falling back to placeholder`,
            imageError,
          );
          recipe.imageUrl = `https://placehold.co/1024x1024/e0e0e0/333?text=${encodeURIComponent(recipe.name)}`;
        }

        return recipe;
      }),
    );
  }

  private adjustServings(
    recipe: AIGeneratedRecipe,
    targetServings: number,
  ): AIGeneratedRecipe {
    const ratio = targetServings / recipe.servings;

    return {
      ...recipe,
      servings: targetServings,
      ingredients: recipe.ingredients.map((ing) => ({
        ...ing,
        quantity: this.scaleQuantity(ing.quantity, ratio),
        estimatedCost: ing.estimatedCost * ratio,
      })),
      costAnalysis: {
        totalCost: recipe.costAnalysis.totalCost * ratio,
        costPerServing: recipe.costAnalysis.costPerServing,
        budgetEfficiency: recipe.costAnalysis.budgetEfficiency,
        pantryItemsSavings:
          (recipe.costAnalysis.pantryItemsSavings || 0) * ratio,
      },
    };
  }

  private scaleQuantity(quantity: string, ratio: number): string {
    return scaleQuantityString(quantity, ratio);
  }

  private estimateNutrition(recipe: { mealType: string }): NutritionInfo {
    // Fallback nutrition estimation based on meal type
    const baseNutrition: Record<string, NutritionInfo> = {
      breakfast: {
        calories: 400,
        protein_g: 15,
        carbs_g: 50,
        fat_g: 15,
        fiber_g: 6,
        sugar_g: 10,
      },
      lunch: {
        calories: 500,
        protein_g: 25,
        carbs_g: 55,
        fat_g: 18,
        fiber_g: 8,
        sugar_g: 8,
      },
      dinner: {
        calories: 600,
        protein_g: 30,
        carbs_g: 60,
        fat_g: 20,
        fiber_g: 10,
        sugar_g: 6,
      },
      snack: {
        calories: 200,
        protein_g: 8,
        carbs_g: 25,
        fat_g: 8,
        fiber_g: 4,
        sugar_g: 12,
      },
    };

    return baseNutrition[recipe.mealType.toLowerCase()] || baseNutrition.dinner;
  }

  private calculateAvgHealthScore(recipes: AIGeneratedRecipe[]): number {
    const sum = recipes.reduce((acc, r) => acc + r.healthScore, 0);
    return Math.round(sum / recipes.length);
  }

  private calculateAvgCost(recipes: AIGeneratedRecipe[]): number {
    const sum = recipes.reduce(
      (acc, r) => acc + r.costAnalysis.costPerServing,
      0,
    );
    return Math.round((sum / recipes.length) * 100) / 100;
  }

  private calculatePantryUsage(recipes: AIGeneratedRecipe[]): string {
    const totalIngredients = recipes.reduce(
      (acc, r) => acc + r.ingredients.length,
      0,
    );
    const pantryIngredients = recipes.reduce(
      (acc, r) => acc + r.ingredients.filter((i) => i.isPantryItem).length,
      0,
    );
    const percentage =
      totalIngredients > 0
        ? Math.round((pantryIngredients / totalIngredients) * 100)
        : 0;
    return `${percentage}%`;
  }

  /**
   * Converts a database recipe to AIGeneratedRecipe format
   * Fetches ingredients and formats everything to match AI output structure
   */
  private async convertDatabaseRecipeToAIFormat(
    dbRecipe: any,
    targetServings: number,
  ): Promise<AIGeneratedRecipe> {
    // Fetch recipe with ingredients
    const recipeWithIngredients =
      await this.recipeStorage.getRecipeWithIngredients(dbRecipe.id);

    // Parse instructions (stored as JSON string in DB)
    let instructions: string[] = [];
    try {
      instructions =
        typeof dbRecipe.instructions === "string"
          ? JSON.parse(dbRecipe.instructions)
          : dbRecipe.instructions;
    } catch {
      instructions = [dbRecipe.instructions || "No instructions available"];
    }

    // Convert database ingredients to AI format
    const ingredients: any = (recipeWithIngredients?.ingredients || []).map(
      (ing: any) => ({
        name: ing.ingredient.name,
        quantity: ing.quantity || "1",
        unit: ing.unit || "unit",
        isOptional: ing.isOptional || false,
        notes: ing.notes || undefined,
        estimatedCost: parseFloat(ing.ingredient.averagePrice || "1.5"),
        category: this.categorizeIngredient(ing.ingredient.category),
        isPantryItem: false,
      }),
    );

    // Calculate total cost
    const totalCost = ingredients.reduce(
      (sum: any, ing: any) => sum + ing.estimatedCost,
      0,
    );
    const servings = dbRecipe.servings || 1;

    // Adjust for target servings
    const servingRatio = targetServings / servings;

    // Build nutrition info (use DB data if available, otherwise estimate)
    const nutrition: NutritionInfo = dbRecipe.calories
      ? {
          calories: Math.round(dbRecipe.calories * servingRatio),
          protein_g: Math.round((dbRecipe.calories * 0.25) / 4), // Estimate from calories
          carbs_g: Math.round((dbRecipe.calories * 0.45) / 4),
          fat_g: Math.round((dbRecipe.calories * 0.3) / 9),
          fiber_g: 8,
          sugar_g: 6,
          sodium_mg: 600,
          cholesterol_mg: 50,
        }
      : this.estimateNutrition({
          mealType: dbRecipe.mealType,
          servings: targetServings,
        } as any);

    // Calculate health score based on nutrition
    const healthScore = this.calculateHealthScore(nutrition);

    // Build AI formatted recipe
    const aiRecipe: AIGeneratedRecipe = {
      id: dbRecipe.id,
      name: dbRecipe.name,
      imageUrl: dbRecipe.imageUrl, // Preserve image URL
      description: dbRecipe.description || `Delicious ${dbRecipe.name}`,
      cuisineType: dbRecipe.cuisineType || "International",
      mealType: dbRecipe.mealType,
      servings: targetServings,
      totalTimeMinutes: dbRecipe.totalTimeMinutes || 45,
      difficultyLevel: dbRecipe.difficultyLevel || "medium",
      ingredients: ingredients.map((ing: any) => ({
        ...ing,
        quantity:
          servingRatio !== 1
            ? this.scaleQuantity(ing.quantity, servingRatio)
            : ing.quantity,
        estimatedCost: ing.estimatedCost * servingRatio,
      })),
      instructions,
      costAnalysis: {
        totalCost: Math.round(totalCost * servingRatio * 100) / 100,
        costPerServing: Math.round((totalCost / servings) * 100) / 100,
        budgetEfficiency: 0.8,
        pantryItemsSavings: 0,
      },
      nutrition,
      nutritionalHighlights: this.generateNutritionalHighlights(nutrition),
      healthScore,
      pantryOptimization: [],
      cookingTips: [`This recipe serves ${targetServings} people`],
      variations: [],
      webSourceInspirations: [
        `Traditional ${dbRecipe.name} recipe from database`,
      ],
      healthConsiderations: [],
      aiReasoningNotes: "Retrieved from recipe database",
      shoppingList: ingredients.map((ing: any) => ({
        ingredientName: ing.name,
        quantity:
          servingRatio !== 1
            ? this.scaleQuantity(ing.quantity, servingRatio)
            : ing.quantity,
        unit: ing.unit,
      })),
    };

    return aiRecipe;
  }

  /**
   * Categorizes ingredient based on database category
   */
  private categorizeIngredient(
    dbCategory: string,
  ):
    | "produce"
    | "pantry"
    | "dairy"
    | "protein"
    | "seafood"
    | "meat"
    | "bakery"
    | "spices"
    | "beverages"
    | "frozen"
    | "other" {
    const categoryMap: Record<string, any> = {
      produce: "produce",
      vegetables: "produce",
      fruits: "produce",
      dairy: "dairy",
      milk: "dairy",
      cheese: "dairy",
      meat: "meat",
      beef: "meat",
      pork: "meat",
      chicken: "meat",
      poultry: "meat",
      seafood: "seafood",
      fish: "seafood",
      pantry: "pantry",
      grains: "pantry",
      spices: "spices",
      herbs: "spices",
      bakery: "bakery",
      bread: "bakery",
      beverages: "beverages",
      drinks: "beverages",
      frozen: "frozen",
    };

    const normalized = dbCategory.toLowerCase();
    return categoryMap[normalized] || "other";
  }

  /**
   * Calculates health score from nutrition info
   */
  private calculateHealthScore(nutrition: NutritionInfo): number {
    let score = 70; // Base score

    // Protein bonus
    if (nutrition.protein_g > 20) score += 10;
    else if (nutrition.protein_g > 15) score += 5;

    // Fiber bonus
    if (nutrition.fiber_g > 8) score += 10;
    else if (nutrition.fiber_g > 5) score += 5;

    // Sugar penalty
    if (nutrition.sugar_g > 20) score -= 10;
    else if (nutrition.sugar_g > 15) score -= 5;

    // Sodium penalty
    if (nutrition.sodium_mg && nutrition.sodium_mg > 1000) score -= 10;
    else if (nutrition.sodium_mg && nutrition.sodium_mg > 700) score -= 5;

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Generates nutritional highlights from nutrition data
   */
  private generateNutritionalHighlights(nutrition: NutritionInfo): string[] {
    const highlights: string[] = [];

    if (nutrition.protein_g > 20) {
      highlights.push(`High in protein (${nutrition.protein_g}g)`);
    }
    if (nutrition.fiber_g > 8) {
      highlights.push(`Good source of fiber (${nutrition.fiber_g}g)`);
    }
    if (nutrition.calories < 400) {
      highlights.push("Low calorie option");
    }
    if (nutrition.sugar_g < 10) {
      highlights.push("Low in sugar");
    }

    return highlights.length > 0 ? highlights : ["Balanced and nutritious"];
  }
  /**
   * Searches for a specific recipe by name and meal type
   * First checks database for existing recipes, then falls back to AI generation
   * Returns a fully detailed recipe with authentic instructions, nutrition, and cost analysis
   *
   * @param recipeName - The name of the recipe to search for
   * @param mealType - The meal type (breakfast, lunch, dinner, snack)
   * @param servings - Optional: Number of servings (defaults to 4)
   * @param dietaryRestrictions - Optional: Array of dietary restrictions to apply
   * @param accountId - Optional: Account ID for personalized search
   * @returns Promise<AIGeneratedRecipe | null> - Complete recipe object or null if failed
   */
  private calculateSimilarity(s1: string, s2: string): number {
    const longer = s1.length > s2.length ? s1 : s2;
    const shorter = s1.length > s2.length ? s2 : s1;
    if (longer.length === 0) {
      return 1.0;
    }
    const editDistance = (str1: string, str2: string) => {
      const costs = [];
      for (let i = 0; i <= str1.length; i++) {
        let lastValue = i;
        for (let j = 0; j <= str2.length; j++) {
          if (i === 0) {
            costs[j] = j;
          } else {
            if (j > 0) {
              let newValue = costs[j - 1];
              if (str1.charAt(i - 1) !== str2.charAt(j - 1)) {
                newValue =
                  Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
              }
              costs[j - 1] = lastValue;
              lastValue = newValue;
            }
          }
        }
        if (i > 0) {
          costs[str2.length] = lastValue;
        }
      }
      return costs[str2.length];
    };
    return (
      (longer.length - editDistance(longer, shorter)) /
      parseFloat(longer.length.toString())
    );
  }

  /**
   * Searches for a specific recipe by name and meal type
   * First checks database for existing recipes, then falls back to AI generation
   * Returns a fully detailed recipe with authentic instructions, nutrition, and cost analysis
   *
   * @param recipeName - The name of the recipe to search for
   * @param mealType - The meal type (breakfast, lunch, dinner, snack)
   * @param servings - Optional: Number of servings (defaults to 4)
   * @param dietaryRestrictions - Optional: Array of dietary restrictions to apply
   * @param accountId - Optional: Account ID for personalized search
   * @returns Promise<AIGeneratedRecipe[]> - Array of recipes (top 3 matches or 1 AI generated)
   */
  async searchSpecificRecipe(
    recipeName: string,
    mealType: string,
    servings: number = 4,
    dietaryRestrictions?: string[],
    accountId?: string,
  ): Promise<AIGeneratedRecipe[]> {
    try {
      console.log("🔍 Custom Recipe Search Started:", {
        recipeName,
        mealType,
        servings,
        dietaryRestrictions: dietaryRestrictions?.length || 0,
        accountId: accountId || "none",
      });

      // 🎯 STEP 1: Search database first for matching recipe
      console.log("📚 Searching database for existing recipe...");
      // Fetch broader set of candidates using simple text search
      const dbRecipes = await this.recipeStorage.searchRecipesByName(
        recipeName,
        accountId,
      );

      // Perform fuzzy matching in memory
      const matches = dbRecipes
        .map((r) => ({
          recipe: r,
          similarity: this.calculateSimilarity(
            r.name.toLowerCase(),
            recipeName.toLowerCase(),
          ),
        }))
        .filter((match) => match.similarity >= 0.85) // 85% threshold
        .sort((a, b) => b.similarity - a.similarity); // Sort by similarity desc

      if (matches.length > 0) {
        console.log(
          `✅ Found ${matches.length} matches in database > 85% similarity`,
        );

        // Take top 3
        const topMatches = matches.slice(0, 3);

        // Convert to AI format
        const aiFormattedRecipes = await Promise.all(
          topMatches.map(async (m) => {
            return await this.convertDatabaseRecipeToAIFormat(
              m.recipe,
              servings,
            );
          }),
        );

        console.log(
          "🎉 Returning top DB matches:",
          aiFormattedRecipes.map((r) => r.name),
        );
        return aiFormattedRecipes;
      }

      // 🤖 STEP 2: No database match found, generate using AI
      console.log(
        "⚠️ Recipe not found in database (or low similarity), generating with AI...",
      );

      const prompt = await this.promptBuilder.buildRecipeSearchPrompt(
        recipeName,
        mealType,
        servings,
        dietaryRestrictions,
      );

      console.log({ prompt }, "prompt");

      const response = await this.aiProvider.createCompletion({
        prompt,
        systemPrompt: this.getRecipeSearchSystemPrompt(),
        maxTokens: 2500,
        temperature: 0.7,
      });

      console.log("✅ Recipe Search Response Received:", {
        contentLength: response.content.length,
        tokensUsed: response.usage?.totalTokens || "N/A",
      });

      // Parse AI Response
      const recipe = this.parseRecipeResponse(
        response.content,
        recipeName,
        mealType,
        servings,
      );

      if (recipe) {
        console.log(
          "🎉 Recipe Successfully Generated with AI. Handling Image...",
        );

        // 🖼️ STEP 2.5: Generate Image for AI Recipe (Crucial)
        try {
          if (this.aiProvider.getProviderName() === "OpenAI") {
            console.log(`🎨 Generating AI Image for: ${recipe.name}`);
            const imagePrompt = `Professional food photography of ${recipe.name}, ${recipe.description.substring(0, 100)}, high resolution, 4k, appetizing, studio lighting, top down view`;

            const generatedUrl = await this.aiProvider.generateImage({
              prompt: imagePrompt,
              size: "1024x1024",
              quality: "standard",
            });

            if (generatedUrl && generatedUrl.length > 0) {
              const localUrl = await this.downloadAndSaveImage(generatedUrl);
              recipe.imageUrl = localUrl;
            } else {
              recipe.imageUrl = `https://placehold.co/1024x1024/3d326d/FFF?text=${encodeURIComponent(recipe.name)}`;
            }
          } else {
            recipe.imageUrl = `https://placehold.co/1024x1024/7dab4f/FFF?text=${encodeURIComponent(recipe.name)}`;
          }
        } catch (imageError) {
          console.error(
            "⚠️ Failed to generate AI image for custom recipe:",
            imageError,
          );
          recipe.imageUrl = `https://placehold.co/1024x1024/e0e0e0/333?text=${encodeURIComponent(recipe.name)}`;
        }

        console.log("✅ Image handled. Score/Cost:", {
          name: recipe.name,
          healthScore: recipe.healthScore,
          costPerServing: recipe.costAnalysis.costPerServing,
        });

        // 💾 STEP 3: Store AI-generated recipe in database (if accountId provided)
        if (accountId) {
          try {
            console.log("💾 Storing custom recipe in database...");

            // Create a minimal AIRecipeRequest for storage
            const storageRequest = {
              accountId,
              mealType,
              memberCount: 1,
              servings,
              recipeCount: 1,
              maxBudgetPerServing: recipe.costAnalysis.costPerServing,
              usePantryItems: false,
              dietaryRestrictions: dietaryRestrictions || [],
            };

            // Store the recipe using the same method as personalized recipes
            const [storedRecipe] =
              await this.recipeStorage.storeAIGeneratedRecipes(
                [recipe],
                storageRequest,
              );

            console.log("✅ Custom recipe stored in database:", {
              id: storedRecipe.id,
              name: storedRecipe.name,
            });

            // Return the stored recipe with ID
            return [storedRecipe];
          } catch (storageError) {
            console.error(
              "⚠️ Failed to store custom recipe in database:",
              storageError,
            );
            // Continue and return the recipe even if storage fails
            console.log("⚠️ Returning recipe without storing (storage failed)");
          }
        } else {
          console.log("⚠️ No accountId provided, skipping database storage");
        }

        return [recipe];
      }

      return [];
    } catch (error) {
      console.error("❌ Recipe Search Error:", error);

      if (error instanceof AppError) {
        throw error;
      }

      const message = error instanceof Error ? error.message : "Unknown error";

      if (message.includes("timeout") || message.includes("ETIMEDOUT")) {
        throw new AppError("Recipe search timed out. Please try again.", 408);
      }

      if (message.includes("does not appear to be a real food item")) {
        throw new AppError(message, 400);
      }

      throw new AppError(`Failed to search recipe: ${message}`, 500);
    }
  }

  /**
   * Searches for multiple variations of a recipe
   * Useful for getting different versions of the same dish (e.g., healthy version, quick version, etc.)
   */
  async searchRecipeVariations(
    recipeName: string,
    mealType: string,
    variationCount: number = 3,
    servings: number = 4,
  ): Promise<AIGeneratedRecipe[]> {
    try {
      console.log("🔍 Recipe Variations Search Started:", {
        recipeName,
        variationCount,
        mealType,
      });

      const prompt = this.buildVariationsPrompt(
        recipeName,
        mealType,
        variationCount,
        servings,
      );

      const response = await this.aiProvider.createCompletion({
        prompt,
        systemPrompt: this.getRecipeSearchSystemPrompt(),
        maxTokens: 5000,
        temperature: 0.8, // Higher temperature for more variety
      });

      const recipes = this.parseMultipleRecipes(
        response.content,
        recipeName,
        mealType,
        servings,
      );

      console.log("🎉 Recipe Variations Generated:", {
        count: recipes.length,
        avgHealthScore: this.calculateAvgHealthScore(recipes),
      });

      return recipes.slice(0, variationCount);
    } catch (error) {
      console.error("❌ Recipe Variations Error:", error);
      throw new Error(
        `Failed to generate recipe variations: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }
  /**
   * Builds prompt for recipe variations
   */
  private buildVariationsPrompt(
    recipeName: string,
    mealType: string,
    count: number,
    servings: number,
  ): string {
    return `Create ${count} authentic VARIATIONS of "${recipeName}" as ${mealType} dishes.

Each variation should be meaningfully different:
- Variation 1: Traditional/Classic version
- Variation 2: Healthy/Light version (lower calories, more vegetables)
- Variation 3: Quick/Easy version (under 30 minutes)
${count > 3 ? "- Variation 4: Gourmet/Restaurant-style version" : ""}

**REQUIREMENTS:**
- All ${count} recipes for ${servings} servings each
- Each must have complete nutrition, cost analysis, and instructions
- Maintain the core identity of "${recipeName}" while varying preparation
- Use the same JSON format as single recipe search
- Return as JSON ARRAY of ${count} recipe objects

**Return format:**
\`\`\`json
[
  { /* Recipe 1 - Traditional */ },
  { /* Recipe 2 - Healthy */ },
  { /* Recipe 3 - Quick */ }
]
\`\`\`

Follow all requirements from single recipe search for EACH variation.`;
  }
  /**
   * Gets the specialized system prompt for recipe search
   */
  private getRecipeSearchSystemPrompt(): string {
    return `You are a world-class professional chef, recipe developer, and nutrition scientist with 20+ years of experience.

                Your expertise includes:
                - Authentic recipes from 50+ world cuisines
                - Precise nutritional calculations and macronutrient analysis
                - Practical home cooking techniques
                - Cost-effective meal planning
                - Dietary adaptations (vegan, gluten-free, low-sodium, etc.)
                - Food science and cooking chemistry

                Your responses are:
                - Technically accurate and professionally detailed
                - Based on authentic culinary traditions
                - Nutritionally sound with realistic calculations
                - Practically achievable for home cooks
                - Cost-conscious with 2025 market prices

                CRITICAL: You respond ONLY with valid JSON. No markdown, no code blocks, no explanatory text.
                Every recipe must have complete, realistic nutrition data calculated from actual ingredients.`;
  }
  /**
   * Parses single recipe response from AI
   */
  private parseRecipeResponse(
    content: string,
    recipeName: string,
    mealType: string,
    servings: number,
  ): AIGeneratedRecipe | null {
    try {
      // Extract JSON from response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.error("No JSON found in response");
        return null;
      }

      const recipe = JSON.parse(jsonMatch[0]);

      // Validation Check (NEW)
      if (recipe.isValid === false) {
        throw new AppError(
          recipe.invalidReason ||
            "Recpie validation failed: Not a valid food item.",
          400,
        );
      }

      // Validate and enhance
      return this.validateAndEnhanceRecipe(
        recipe,
        recipeName,
        mealType,
        servings,
      );
    } catch (error) {
      // Re-throw validation errors as is
      if (error instanceof AppError) {
        throw error;
      }

      if (
        error instanceof Error &&
        (error.message.includes("Not a valid food item") ||
          error.message.includes("does not appear to be a real food item"))
      ) {
        throw new AppError(error.message, 400);
      }

      console.error("Failed to parse recipe:", error);
      return null;
    }
  }
  /**
   * Parses multiple recipes from variations response
   */
  private parseMultipleRecipes(
    content: string,
    recipeName: string,
    mealType: string,
    servings: number,
  ): AIGeneratedRecipe[] {
    try {
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        console.warn("No JSON array found, trying single object");
        const single = this.parseRecipeResponse(
          content,
          recipeName,
          mealType,
          servings,
        );
        return single ? [single] : [];
      }

      const recipes = JSON.parse(jsonMatch[0]);
      return recipes
        .map((recipe: any) =>
          this.validateAndEnhanceRecipe(recipe, recipeName, mealType, servings),
        )
        .filter((r: any) => r !== null);
    } catch (error) {
      console.error("Failed to parse multiple recipes:", error);
      return [];
    }
  }
  /**
   * Validates and enhances a recipe object with defaults and corrections
   */
  private validateAndEnhanceRecipe(
    recipe: any,
    recipeName: string,
    mealType: string,
    servings: number,
  ): AIGeneratedRecipe {
    // Ensure nutrition exists and is valid
    if (!recipe.nutrition || typeof recipe.nutrition !== "object") {
      console.warn("Missing nutrition data, adding estimates");
      recipe.nutrition = this.estimateNutrition({ mealType });
    }

    // Validate nutrition math
    const calcCalories =
      recipe.nutrition.protein_g * 4 +
      recipe.nutrition.carbs_g * 4 +
      recipe.nutrition.fat_g * 9;

    if (Math.abs(calcCalories - recipe.nutrition.calories) > 50) {
      console.warn("Nutrition math incorre    sct, recalculating calories");
      recipe.nutrition.calories = Math.round(calcCalories);
    }

    // Ensure all ingredients have categories
    if (recipe.ingredients) {
      recipe.ingredients = recipe.ingredients.map((ing: any) => ({
        ...ing,
        category: ing.category || "other",
        isPantryItem: ing.isPantryItem ?? false,
        estimatedCost: ing.estimatedCost || 1.5,
      }));
    }

    // Calculate total cost if missing
    if (!recipe.costAnalysis || !recipe.costAnalysis.totalCost) {
      const totalCost =
        recipe.ingredients?.reduce(
          (sum: number, ing: any) => sum + (ing.estimatedCost || 0),
          0,
        ) || servings * 5;

      recipe.costAnalysis = {
        totalCost: Math.round(totalCost * 100) / 100,
        costPerServing: Math.round((totalCost / servings) * 100) / 100,
        budgetEfficiency: 0.75,
      };
    }

    return {
      name: recipe.name || recipeName,
      description: recipe.description || `Delicious ${recipeName}`,
      cuisineType: recipe.cuisineType || this.guessCuisineFromName(recipeName),
      mealType: recipe.mealType || mealType,
      servings: recipe.servings || servings,
      totalTimeMinutes: recipe.totalTimeMinutes || 45,
      difficultyLevel: recipe.difficultyLevel || "medium",
      ingredients: recipe.ingredients || [],
      instructions: recipe.instructions || [
        "Recipe instructions not available",
      ],
      costAnalysis: recipe.costAnalysis,
      nutrition: recipe.nutrition,
      nutritionalHighlights: recipe.nutritionalHighlights || [
        "Nutritious and balanced",
      ],
      healthScore: Math.max(0, Math.min(100, recipe.healthScore || 70)),
      pantryOptimization: recipe.pantryOptimization || [],
      cookingTips: recipe.cookingTips || [],
      variations: recipe.variations || [],
      webSourceInspirations: recipe.webSourceInspirations || [
        `Traditional ${recipeName} recipe`,
      ],
      healthConsiderations: recipe.healthConsiderations || [],
      aiReasoningNotes:
        recipe.aiReasoningNotes ||
        "Authentic recipe based on traditional preparation methods",
      // AI often hallucinates specific image URLs (like Wikimedia paths that don't exist).
      // We will generate a real AI image in the post-processing step.
      imageUrl: "", // Set explicitly to empty so post-processor knows to generate one
      shoppingList: recipe.shoppingList || [],
    };
  }
  /**
   * Guesses cuisine type from recipe name
   */
  private guessCuisineFromName(recipeName: string): string {
    const name = recipeName.toLowerCase();

    const cuisineKeywords: Record<string, string> = {
      "pasta|pizza|risotto|lasagna": "Italian",
      "curry|tikka|biryani|naan": "Indian",
      "taco|burrito|enchilada|quesadilla": "Mexican",
      "sushi|ramen|teriyaki|tempura": "Japanese",
      "stir fry|fried rice|dumpling|noodle": "Chinese",
      "croissant|baguette|quiche|crepe": "French",
      "paella|tapas|gazpacho": "Spanish",
      "pad thai|curry|satay": "Thai",
      "kebab|shawarma|falafel|hummus": "Middle Eastern",
      "burger|bbq|mac and cheese|fried chicken": "American",
    };

    for (const [keywords, cuisine] of Object.entries(cuisineKeywords)) {
      const regex = new RegExp(keywords, "i");
      if (regex.test(name)) {
        return cuisine;
      }
    }

    return "International";
  }

  /**
   * Estimates costs for a list of ingredients using AI
   */
  async estimateIngredientCosts(
    ingredients: { name: string; quantity: number; unit: string }[],
  ): Promise<Record<string, number>> {
    if (ingredients.length === 0) return {};

    try {
      const prompt =
        await this.promptBuilder.buildIngredientCostPrompt(ingredients);

      const response = await this.aiProvider.createCompletion({
        prompt,
        systemPrompt:
          "You are a helpful culinary assistant and expert grocery pricer.",
        maxTokens: 1000,
        temperature: 0.3, // Low temperature for more deterministic pricing
      });

      const jsonMatch = response.content.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        console.warn("No JSON found in cost estimation response");
        return {};
      }

      const estimates = JSON.parse(jsonMatch[0]);
      const costMap: Record<string, number> = {};

      estimates.forEach((item: any) => {
        if (item.name && typeof item.estimatedCost === "number") {
          costMap[item.name.toLowerCase()] = item.estimatedCost;
        }
      });

      return costMap;
    } catch (error) {
      console.error("Failed to estimate ingredient costs:", error);
      return {};
    }
  }
}
