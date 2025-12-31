import {
  AIGeneratedRecipe,
  AIRecipeRequest,
  RecipeParser,
} from "../interfaces/ai.interfaces.js";

export class JSONRecipeParser implements RecipeParser {
  parse(aiText: string, request: AIRecipeRequest): AIGeneratedRecipe[] {
    try {
      const jsonMatch = aiText.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        console.warn("No JSON array found, trying object match");
        const objectMatch = aiText.match(/\{[\s\S]*\}/);
        if (objectMatch) {
          const singleRecipe = JSON.parse(objectMatch[0]);
          return this.validateAndEnhanceRecipes([singleRecipe], request);
        }
        throw new Error("No JSON found in AI response");
      }

      const recipes = JSON.parse(jsonMatch[0]);
      return this.validateAndEnhanceRecipes(recipes, request);
    } catch (parseError) {
      console.error("Error parsing AI response:", parseError);
      console.log("Raw AI response:", aiText.substring(0, 500));
      return this.getFallbackRecipes(request);
    }
  }

  private validateAndEnhanceRecipes(
    recipes: any[],
    request: AIRecipeRequest,
  ): AIGeneratedRecipe[] {
    const defaultBudget = request.maxBudgetPerServing || 8;
    const targetServings = request.servings;

    return recipes
      .map((recipe: any, index: number) => {
        // Validate nutrition is present
        if (!recipe.nutrition || typeof recipe.nutrition !== "object") {
          console.warn(`Recipe ${index} missing nutrition, adding defaults`);
          recipe.nutrition = {
            calories: 400,
            protein_g: 20,
            carbs_g: 45,
            fat_g: 15,
            fiber_g: 5,
            sugar_g: 8,
          };
        }

        // Validate ingredients have categories
        if (recipe.ingredients) {
          recipe.ingredients = recipe.ingredients.map((ing: any) => ({
            ...ing,
            category: ing.category || "other",
            isPantryItem: ing.isPantryItem || false,
          }));
        }

        // Calculate pantryItemsUsedCount if not provided
        const pantryItemsUsedCount =
          recipe.pantryItemsUsedCount ??
          (recipe.ingredients?.filter((ing: any) => ing.isPantryItem).length ||
            0);

        return {
          name: recipe.name || `AI Recipe ${index + 1}`,
          description: recipe.description || "Delicious AI-generated recipe",
          imageUrl: recipe.imageUrl, // Preserve AI generated image URL
          cuisineType: recipe.cuisineType || "fusion",
          mealType: request.mealType,
          servings: recipe.servings || targetServings,
          totalTimeMinutes: recipe.totalTimeMinutes || 30,
          difficultyLevel: recipe.difficultyLevel || "medium",
          ingredients: recipe.ingredients || [],
          instructions: recipe.instructions || [
            "Cooking instructions not available",
          ],
          costAnalysis: {
            totalCost:
              recipe.costAnalysis?.totalCost || defaultBudget * targetServings,
            costPerServing:
              recipe.costAnalysis?.costPerServing || defaultBudget,
            budgetEfficiency: Math.max(
              0,
              Math.min(1, recipe.costAnalysis?.budgetEfficiency || 0.8),
            ),
            pantryItemsSavings: recipe.costAnalysis?.pantryItemsSavings || 0,
          },
          nutrition: recipe.nutrition,
          nutritionalHighlights: recipe.nutritionalHighlights || [
            "Nutritious and balanced",
          ],
          healthScore: Math.max(0, Math.min(100, recipe.healthScore || 75)),
          pantryOptimization: recipe.pantryOptimization || [],
          cookingTips: recipe.cookingTips || [],
          variations: recipe.variations || [],
          webSourceInspirations: recipe.webSourceInspirations || [
            "Popular online recipes",
          ],
          healthConsiderations: recipe.healthConsiderations || [],
          aiReasoningNotes:
            recipe.aiReasoningNotes ||
            "Recipe selected based on your preferences",

          // Preserve pantry feasibility tracking fields
          canGenerateRecipe: recipe.canGenerateRecipe,
          insufficientPantryReason: recipe.insufficientPantryReason,
          suggestedPantryAdditions: recipe.suggestedPantryAdditions,
          pantryItemsUsedCount: pantryItemsUsedCount,
        };
      })
      .slice(0, request.recipeCount);
  }

  private getFallbackRecipes(request: AIRecipeRequest): AIGeneratedRecipe[] {
    const baseCost = request.maxBudgetPerServing || 8;
    const servings = request.servings;

    return [
      {
        name: `Simple ${request.mealType}`,
        description: "A nutritious family meal",
        cuisineType: "comfort",
        mealType: request.mealType,
        servings: servings,
        totalTimeMinutes: 30,
        difficultyLevel: "easy" as const,
        ingredients: [
          {
            name: "Main ingredient",
            quantity: "1",
            unit: "lb",
            isOptional: false,
            estimatedCost: baseCost * 0.6,
            category: "protein",
          },
        ],
        instructions: ["Prepare ingredients", "Cook", "Serve"],
        costAnalysis: {
          totalCost: baseCost * servings,
          costPerServing: baseCost,
          budgetEfficiency: 0.8,
        },
        nutrition: {
          calories: 400,
          protein_g: 25,
          carbs_g: 40,
          fat_g: 15,
          fiber_g: 5,
          sugar_g: 6,
        },
        nutritionalHighlights: ["Balanced meal"],
        healthScore: 70,
        pantryOptimization: [],
        cookingTips: [],
        variations: [],
        webSourceInspirations: [],
      },
    ];
  }
}
