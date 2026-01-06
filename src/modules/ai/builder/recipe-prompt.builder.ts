import { PantryItemsStorage } from "@/modules/pantry/pantry.repository.js";
import {
  AIRecipeRequest,
  RecipePromptBuilder,
  RecipeScore,
} from "../interfaces/ai.interfaces.js";

export class AdvancedRecipePromptBuilder implements RecipePromptBuilder {
  private pantryStorage: PantryItemsStorage;

  constructor(pantryStorage: PantryItemsStorage) {
    this.pantryStorage = pantryStorage;
  }

  async buildPrompt(request: AIRecipeRequest): Promise<string> {
    // Build all prompt sections
    const pantrySection = await this.buildPantrySection(request);
    const learningSection = this.buildLearningSection(request);
    const requirementsSection = this.buildRequirementsSection(request);
    const constraintsSection = this.buildConstraintsSection(request);
    const outputFormatSection = this.buildOutputFormatSection(request);

    return `${pantrySection}

                ${learningSection}

                ${requirementsSection}

                ${constraintsSection}

                ${outputFormatSection}`;
  }

  /**
   * Builds the pantry-related instruction block for the AI prompt.
   *
   * Behavior:
   * - If neither pantryOnly nor usePantryItems is enabled → returns a simple note
   *   that pantry usage is not required.
   * - If pantryOnly is true → AI must create recipes *strictly using* only pantry items.
   * - If usePantryItems is true → pantry ingredients must be prioritized but additional
   *   ingredients can be suggested when necessary.
   *
   * Steps:
   * 1. Fetches the user's pantry data from DB based on accountId.
   * 2. Normalizes pantry items into a format suitable for AI prompting.
   * 3. Returns a fully formatted instruction block (Markdown) for the AI model.
   *
   * @param {AIRecipeRequest} request - User's recipe generation request containing
   * pantry preferences and the accountId.
   *
   * @returns {Promise<string>} - A formatted instruction string for inclusion in AI prompt.
   *
   * Modes:
   * - pantryOnly: enforces strict pantry-only recipe creation.
   * - usePantryItems: encourages pantry usage with flexibility.
   *
   * Notes:
   * - The returned string will be appended into the main AI prompt.
   * - Pantry instructions include rules, constraints, and structured JSON of items.
   */

  private async buildPantrySection(request: AIRecipeRequest): Promise<string> {
    if (!request.usePantryItems && !request.pantryOnly) {
      return `**PANTRY USAGE:** Not required. You can suggest any ingredients.`;
    }

    const pantryData = await this.fetchPantryData(request.accountId);
    const normalizedPantry = this.normalizePantryForPrompt(pantryData);

    if (request.pantryOnly) {
      // Check if pantry is empty or has insufficient items
      const pantryItemCount = normalizedPantry.length;
      const hasSufficientItems = pantryItemCount >= 3; // Minimum threshold for a basic recipe

      return `**⚠️ CRITICAL CONSTRAINT - PANTRY-ONLY MODE:**
                        You MUST create recipes using ONLY the ingredients listed below. Do NOT suggest any ingredients outside this list.

                        **Available Pantry Items (${pantryItemCount} items):**
                        ${JSON.stringify(normalizedPantry, null, 2)}

                        **RECIPE FEASIBILITY TRACKING:**
                        - Current pantry item count: ${pantryItemCount}
                        - Sufficient items available: ${hasSufficientItems ? "YES" : "NO"}
                        ${!hasSufficientItems ? "- ⚠️ WARNING: Limited pantry items may not be sufficient for a complete recipe" : ""}

                        **RULES:**
                        - Use ONLY these pantry items
                        - You can combine them creatively
                        - **IMPORTANT**: If pantry items are insufficient (less than 3 items or missing essential ingredients), you MUST:
                          1. Set a flag in your response: "canGenerateRecipe": false
                          2. Include "insufficientPantryReason": "Detailed explanation of what's missing"
                          3. Suggest minimum items needed: "suggestedPantryAdditions": ["item1", "item2"]
                        - If sufficient items exist, set "canGenerateRecipe": true
                        - Mark each ingredient with "isPantryItem": true
                        - If no pantry items available, inform user that recipe generation is not possible`;
    }

    // For usePantryItems mode (not pantryOnly)
    const pantryItemCount = normalizedPantry.length;

    return `**PANTRY PRIORITIZATION MODE:**
                    Strongly prioritize using ingredients from the user's pantry. You may suggest additional ingredients if needed, but maximize pantry usage.

                    **Available Pantry Items (${pantryItemCount} items - USE THESE FIRST):**
                    ${JSON.stringify(normalizedPantry, null, 2)}

                    **RECIPE FEASIBILITY TRACKING:**
                    - Current pantry item count: ${pantryItemCount}
                    ${pantryItemCount === 0 ? "- ⚠️ WARNING: No pantry items available, will need to suggest all ingredients" : ""}

                    **RULES:**
                    - Prioritize pantry items heavily (aim for 50-60% pantry usage if items available)
                    - Mark pantry items with "isPantryItem": true
                    - Mark additional items with "isPantryItem": false
                    - Calculate "pantryItemsSavings" in cost analysis
                    - Include "pantryItemsUsedCount": number of pantry items actually used in recipe
                    - Include "canGenerateRecipe": true (since additional ingredients are allowed)`;
  }

  /**
   * Builds the AI learning & personalization block for the recipe generation prompt.
   *
   * Purpose:
   * - Uses the user's historical recipe interactions (scores, cuisines, skips, repeats)
   *   to generate adaptive guidance for the AI model.
   * - Encodes personalized preferences into the prompt so the AI can tailor its
   *   output according to the user's cooking habits and feedback trends.
   *
   * Behavior:
   * - If no history is available → returns a generic “no learning data” section.
   * - Otherwise:
   *   - Extracts high-scoring recipes (favorites).
   *   - Extracts low-scoring recipes (disliked / avoid).
   *   - Identifies cuisine preferences using frequency + score patterns.
   *   - Determines commonly used ingredients (preference patterns).
   *   - Lists recently skipped recipes.
   *   - Includes a list of “avoidRecentRecipes” if provided.
   *
   * Data Analysis Steps:
   * 1. Filter high-score recipes (score ≥ 3).
   * 2. Filter low-score recipes (score ≤ -2).
   * 3. Analyze cuisine frequency + average score trends.
   * 4. Analyze ingredient-level patterns in past recipes.
   * 5. Detect "skipped" interactions to avoid similar suggestions.
   *
   * Result:
   * Returns a formatted Markdown block containing:
   * - User favorites
   * - Disliked recipes
   * - Cuisine trends
   * - Ingredient preferences
   * - Skipped recipes
   * - Recent recipes to avoid
   * - Final AI instructions based on learning patterns
   *
   * @param {AIRecipeRequest} request - Contains recipeHistory, avoidance rules, and
   * personalization metadata for analysis.
   *
   * @returns {string} - A fully composed instruction block to be appended
   * into the final AI prompt.
   */
  private buildLearningSection(request: AIRecipeRequest): string {
    if (!request.recipeHistory || request.recipeHistory.length === 0) {
      return `**AI LEARNING DATA:** No historical data available yet. Focus on variety and exploration.`;
    }

    // Analyze recipe history
    const highScoreRecipes = request.recipeHistory
      .filter((r) => r.score >= 3)
      .slice(0, 10);

    const lowScoreRecipes = request.recipeHistory
      .filter((r) => r.score <= -2)
      .slice(0, 5);

    const frequentCuisines = this.analyzeCuisinePreferences(
      request.recipeHistory,
    );
    const preferredIngredients = this.analyzeIngredientPatterns(
      request.recipeHistory,
    );
    const skippedRecipes = request.recipeHistory
      .filter((r) => r.interactions.some((i) => i.type === "skipped"))
      .map((r) => r.recipeName);

    return `**🧠 AI LEARNING & PERSONALIZATION:**

                    **User's Favorite Recipes (High Score ≥3):**
                    ${
                      highScoreRecipes.length > 0
                        ? highScoreRecipes
                            .map(
                              (r) =>
                                `- "${r.recipeName}" (Score: ${r.score}, Cooked: ${r.timesCooked}x, Cuisine: ${r.cuisineType})`,
                            )
                            .join("\n")
                        : "- None yet"
                    }

                    **Recipes User Disliked (Score ≤-2):**
                    ${
                      lowScoreRecipes.length > 0
                        ? lowScoreRecipes
                            .map(
                              (r) =>
                                `- "${r.recipeName}" (Score: ${r.score}) - AVOID similar recipes`,
                            )
                            .join("\n")
                        : "- None yet"
                    }

                    **Cuisine Preferences (Based on cooking frequency & scores):**
                    ${
                      frequentCuisines.length > 0
                        ? frequentCuisines
                            .map(
                              (c) =>
                                `- ${c.cuisine}: ${c.percentage}% preference (Avg Score: ${c.avgScore})`,
                            )
                            .join("\n")
                        : "- No clear pattern yet"
                    }

                    **Ingredient Patterns (User often cooks with):**
                    ${preferredIngredients.length > 0 ? preferredIngredients.join(", ") : "Varied ingredients"}

                    **Recently Skipped Recipes (AVOID THESE):**
                    ${skippedRecipes.length > 0 ? skippedRecipes.join(", ") : "None"}

                    ${
                      request.avoidRecentRecipes?.length
                        ? `
                    **🚫 DO NOT SUGGEST (Recent recipes - avoid repetition):**
                    ${request.avoidRecentRecipes.join(", ")}
                    `
                        : ""
                    }

                    **AI INSTRUCTIONS BASED ON LEARNING:**
                    1. Strongly favor cuisines and ingredients the user has cooked successfully
                    2. Avoid flavor profiles similar to low-scoring recipes
                    3. If user has high scores in a specific cuisine, suggest variations within that cuisine
                    4. Learn from repeated recipes - these are user favorites, suggest similar ones
                    5. Create fresh variations of high-scoring recipes rather than repeating exactly`;
  }

  /**
   * Builds the core recipe requirement block for the AI prompt.
   *
   * Purpose:
   * - Encodes all explicit recipe constraints (budget, servings, cooking time, cuisine,
   *   dietary restrictions, preferences, and family context) into a structured,
   *   human-readable Markdown format.
   * - Ensures the AI model respects strict user requirements such as budget limits,
   *   time limits, member-specific dietary needs, and recipe count.
   *
   * Behavior:
   * - Determines budget and time constraints (strict vs flexible).
   * - Derives cuisine requirements (single cuisine, preferred cuisines, or open choice).
   * - Includes family context such as number of members and serving size.
   * - Integrates health considerations and food preferences via helper methods:
   *   - `buildHealthInfo(request)`
   *   - `buildFoodPreferences(request)`
   * - Adds contextual cues such as day-of-week for choosing recipe complexity.
   *
   * Steps:
   * 1. Build budget text (strict or general guideline).
   * 2. Build time constraint (strict or flexible).
   * 3. Build cuisine preference logic based on request properties.
   * 4. Append health and dietary restrictions if present.
   * 5. Append food preferences (strict rules).
   * 6. Compose everything into a single Markdown block for the prompt.
   *
   * Output:
   * Produces a detailed, instruction-rich requirements section that the AI must follow
   * exactly while generating recipes.
   *
   * @param {AIRecipeRequest} request - Contains the user’s dietary rules, serving size,
   * cuisine preferences, family context, budget, time constraints, and recipe count.
   *
   * @returns {string} - A formatted Markdown string describing all recipe requirements
   * to guide AI output generation.
   */
  private buildRequirementsSection(request: AIRecipeRequest): string {
    const budgetGuidance = request.maxBudgetPerServing
      ? `Maximum $${request.maxBudgetPerServing} per serving (STRICT)`
      : "Budget-conscious pricing preferred";

    const healthInfo = this.buildHealthInfo(request);
    const foodPreferences = this.buildFoodPreferences(request);
    const familyInfo = `Family of ${request.memberCount} people`;
    const servingInfo = `Create recipes for ${request.servings} servings`;
    const timeConstraint = request.maxPrepTime
      ? `Maximum ${request.maxPrepTime} minutes total time (STRICT)`
      : "Reasonable cooking time for busy families (30-45 minutes ideal)";

    const memberContext = request.isForAllMembers
      ? "Recipe must accommodate ALL family members' dietary needs simultaneously"
      : "Recipe focused on specific family members' preferences";

    const cuisinePreference = request.cuisine
      ? `Primary Cuisine: ${request.cuisine} (maintain authenticity while adapting for health)`
      : request.preferredCuisines?.length
        ? `Preferred Cuisines: ${request.preferredCuisines.join(", ")} (choose one)`
        : "Any cuisine (choose based on user's learning data)";

    return `**📋 RECIPE REQUIREMENTS:**

                **Generate exactly ${request.recipeCount} recipe${request.recipeCount > 1 ? "s" : ""}** for **${request.mealType}**

                **Family & Serving Details:**
                - ${familyInfo}
                - ${servingInfo}
                - ${memberContext}
                - ${budgetGuidance}
                - ${timeConstraint}

                **Cuisine Selection:**
                - ${cuisinePreference}

                ${
                  healthInfo.length > 0
                    ? `
                **🏥 Health Considerations (CRITICAL - Must Follow):**
                ${healthInfo.map((info) => `- ${info}`).join("\n")}
                `
                    : ""
                }

                ${
                  foodPreferences.length > 0
                    ? `
                **🍽️ Food Preferences (STRICT RULES):**
                ${foodPreferences.map((pref) => `- ${pref}`).join("\n")}
                `
                    : ""
                }

                ${
                  request.dayOfWeek
                    ? `
                **📅 Context:** It's ${request.dayOfWeek} - consider this for recipe complexity and meal planning
                `
                    : ""
                }`;
  }

  // ignore unused variable
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private buildConstraintsSection(request: AIRecipeRequest): string {
    return `**⚡ CRITICAL CONSTRAINTS & RULES:**

                1. **Budget Compliance:**
                - NEVER exceed the per-serving budget
                - Use realistic 2025 grocery prices
                - If pantry items used, calculate savings

                2. **Health Safety:**
                - Complete allergen avoidance (zero tolerance)
                - Medical condition adaptations (low sodium/sugar when needed)
                - Age-appropriate nutrition for family members

                3. **Ingredient Categories:**
                - Every ingredient MUST have a "category" field
                - ONLY use: "produce", "pantry", "dairy", "protein", "seafood", "meat", "bakery", "spices", "beverages", "frozen", "other"
                - Never invent new categories

                4. **Nutrition Requirements:**
                - MANDATORY "nutrition" object in every recipe
                - Use realistic calculated values based on ingredients
                - Never use placeholder values (0, 999, etc.)

                5. **Recipe Quality:**
                - Clear, step-by-step instructions
                - Practical cooking techniques for home cooks
                - Accurate timing estimates
                - Helpful cooking tips

                6. **Cultural Authenticity:**
                - Maintain cuisine integrity
                - Use traditional cooking methods when possible
                - Suggest authentic ingredient alternatives if unavailable

                7. **Learning Integration:**
                - Reference user's successful recipes
                - Avoid patterns from disliked recipes
                - Create variations of high-scoring dishes
                - Never repeat recent suggestions exactly`;
  }

  private buildOutputFormatSection(request: AIRecipeRequest): string {
    const recipeCount = request.recipeCount;
    const servings = request.servings;

    return `**📤 OUTPUT FORMAT (JSON ONLY):**

        Return a JSON array with EXACTLY ${recipeCount} recipe object${recipeCount > 1 ? "s" : ""}:

        \`\`\`json
        [ 
        {
            "name": "Creative Recipe Name",
            "description": "2-3 sentence appetizing description highlighting key flavors and health benefits",
            "cuisineType": "${request.cuisine || "based on user preference"}",
            "mealType": "${request.mealType}",
            "servings": ${servings},
         "imageUrl": Provide a valid, real, publicly accessible HTTP image URL for this dish by searching trusted public sources (such as Wikimedia Commons, Unsplash, or similar). Do NOT generate or fabricate a URL. Do NOT return an image description or placeholder text. Return only the direct image URL. Return null ONLY if no publicly available image exists after searching.
            "totalTimeMinutes": <number>,
            "difficultyLevel": "easy|medium|hard",
            ${
              request.pantryOnly || request.usePantryItems
                ? `
            "canGenerateRecipe": true|false,
            ${
              request.pantryOnly
                ? `"insufficientPantryReason": "optional: explanation if canGenerateRecipe is false",
            "suggestedPantryAdditions": ["optional: items needed if insufficient"],`
                : ""
            }
            "pantryItemsUsedCount": <number of pantry items used>,`
                : ""
            }
            
            "ingredients": [  
            {
                "name": "ingredient name",
                "quantity": "precise amount",
                "unit": "measurement (["cup","tbsp","tsp","oz","lb","gram","kg","ml","liter","piece","clove","slice","dozen","can","bunch","jar"])",
                "isOptional": false,
                "notes": "preparation tips or substitutions",
                "estimatedCost": <realistic dollar amount>,
                "category": "produce|pantry|dairy|protein|seafood|meat|bakery|spices|beverages|frozen|other",
                "isPantryItem": true|false
            }
            ],
            
            "instructions": [
            "Step 1: Detailed action with timing and temperature",
            "Step 2: Next action with visual cues",
            "Step 3: Continue with precision..."
            ],
            
            "costAnalysis": {
            "totalCost": <sum of all ingredient costs>,
            "costPerServing": <totalCost / servings>,
            "budgetEfficiency": <0.0-1.0 scale>,
            "pantryItemsSavings": <optional: money saved using pantry>
            },
            
            "nutrition": {
            "calories": <realistic number per serving>,
            "protein_g": <grams per serving>,
            "carbs_g": <grams per serving>,
            "fat_g": <grams per serving>,
            "fiber_g": <grams per serving>,
            "sugar_g": <grams per serving>,
            "sodium_mg": <milligrams per serving>,
            "cholesterol_mg": <milligrams per serving>
            },
            
            "nutritionalHighlights": [
            "Key health benefit 1",
            "Key health benefit 2",
            "Macro balance note"
            ],
            
            "healthScore": <0-100, higher = healthier>,
            
            "pantryOptimization": [
            "How this uses pantry items efficiently",
            "Storage and meal prep tips"
            ],
            
            "cookingTips": [
            "Pro tip for best results",
            "Common mistake to avoid",
            "Technique advice"
            ],
            
            "variations": [
            "Dietary modification (vegan/gluten-free)",
            "Ingredient substitution option",
            "Serving suggestion"
            ],
            
            "webSourceInspirations": [
            "Traditional recipe origin or popular style",
            "Modern adaptation reference"
            ],
            
            "healthConsiderations": [
            "Medical condition-specific notes if applicable"
            ],
            
            "aiReasoningNotes": "Brief explanation of why this recipe was chosen based on user's history and preferences"
        }
        ]
        \`\`\`

        **FINAL CHECKLIST:**
        ✅ Exactly ${recipeCount} recipe${recipeCount > 1 ? "s" : ""}
        ✅ Each recipe for ${servings} servings
        ✅ All ingredients have valid categories
        ✅ Complete nutrition data with realistic values
        ✅ Budget constraints met
        ✅ Allergens completely avoided
        ✅ Pantry rules followed${
          request.pantryOnly || request.usePantryItems
            ? `
        ✅ Recipe feasibility tracked (canGenerateRecipe field included)
        ✅ Pantry items usage count included`
            : ""
        }
        ✅ Learning from user history applied
        ✅ Valid JSON format (no markdown, no extra text)`;
  }

  // Helper methods
  private async fetchPantryData(accountId: string): Promise<any[]> {
    try {
      return await this.pantryStorage.getAllPantryItems(accountId);
    } catch (error) {
      console.error("Error fetching pantry:", error);
      return [];
    }
  }

  private normalizePantryForPrompt(pantryData: any[]): any[] {
    return pantryData.map((item) => ({
      name: item?.ingredient?.name,
      quantity: item.quantity,
      unit: item.unit,
      category: item.category,
      costPaid: item?.costPaid,
      expiryDate: item.expiryDate,
      location: item.location,
      isPerishable: item.ingredient.isPerishable,
    }));
  }

  private buildHealthInfo(request: AIRecipeRequest): string[] {
    const healthInfo: string[] = [];

    if (request.healthConditions?.length) {
      healthInfo.push(
        `🩺 Health Conditions: ${request.healthConditions.join(", ")} - Adapt recipe accordingly`,
      );
    }
    if (request.dietaryRestrictions?.length) {
      healthInfo.push(
        `🥗 Dietary Restrictions: ${request.dietaryRestrictions.join(", ")} - MUST comply`,
      );
    }
    if (request.allergies?.length) {
      healthInfo.push(
        `⚠️ ALLERGIES (ZERO TOLERANCE): ${request.allergies.join(", ")} - Completely avoid`,
      );
    }
    if (request.healthGoals?.length) {
      healthInfo.push(
        `🎯 Health Goals: ${request.healthGoals.join(", ")} - Optimize for these`,
      );
    }

    return healthInfo;
  }

  private buildFoodPreferences(request: AIRecipeRequest): string[] {
    const prefs: string[] = [];

    if (request.excludedFoods?.length) {
      prefs.push(
        `❌ EXCLUDE (Must Avoid): ${request.excludedFoods.join(", ")}`,
      );
    }
    if (request.customExclusions?.length) {
      prefs.push(
        `❌ Custom Exclusions: ${request.customExclusions.join(", ")}`,
      );
    }
    if (request.includedFoods?.length) {
      prefs.push(`✅ INCLUDE (Preferred): ${request.includedFoods.join(", ")}`);
    }
    if (request.customInclusions?.length) {
      prefs.push(
        `✅ Custom Inclusions: ${request.customInclusions.join(", ")}`,
      );
    }

    return prefs;
  }

  private analyzeCuisinePreferences(
    history: RecipeScore[],
  ): Array<{ cuisine: string; percentage: number; avgScore: number }> {
    const cuisineStats = new Map<
      string,
      { count: number; totalScore: number }
    >();

    history.forEach((recipe) => {
      const stats = cuisineStats.get(recipe.cuisineType) || {
        count: 0,
        totalScore: 0,
      };
      stats.count++;
      stats.totalScore += recipe.score;
      cuisineStats.set(recipe.cuisineType, stats);
    });

    const total = history.length;
    return Array.from(cuisineStats.entries())
      .map(([cuisine, stats]) => ({
        cuisine,
        percentage: Math.round((stats.count / total) * 100),
        avgScore: Math.round((stats.totalScore / stats.count) * 10) / 10,
      }))
      .sort((a, b) => b.percentage - a.percentage)
      .slice(0, 5);
  }

  private analyzeIngredientPatterns(history: RecipeScore[]): string[] {
    const ingredientCounts = new Map<string, number>();

    history
      .filter((r) => r.score >= 2) // Only from liked/cooked recipes
      .forEach((recipe) => {
        recipe.ingredients?.forEach((ingredient) => {
          ingredientCounts.set(
            ingredient,
            (ingredientCounts.get(ingredient) || 0) + 1,
          );
        });
      });

    return Array.from(ingredientCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([ingredient]) => ingredient);
  }

  async buildRecipeSearchPrompt(
    recipeName: string,
    mealType: string,
    servings: number,
    dietaryRestrictions?: string[],
  ): Promise<string> {
    const dietarySection = dietaryRestrictions?.length
      ? dietaryRestrictions
          .map((r: any, index) => {
            return `
Member ${index + 1}:
  - Dietary: ${r.dietary?.join(", ") || "None"}
  - Allergies: ${r.allergies?.join(", ") || "None"}
  - Goals: ${r.goals?.join(", ") || "None"}`;
          })
          .join("\n")
      : "None";

    return `Create a detailed, authentic recipe for "${recipeName}" as a ${mealType} dish for ${servings} servings.

        ${dietarySection}

        **CRITICAL REQUIREMENTS:**

        1. **Authenticity & Research:**
        - Research traditional preparation methods for "${recipeName}"
        - Use authentic ingredient names and techniques
        - Include cultural context and origins
        - Maintain recipe integrity while adapting for ${servings} servings
        - If dietary restrictions apply, adapt authentically within that constraint

        2. **Detailed Instructions:**
        - Write clear, sequential steps (minimum 5 steps)
        - Include specific temperatures (°F) and timings
        - Mention visual cues for doneness
        - List required equipment
        - Explain techniques for beginners
        - Add professional cooking tips

        3. **Accurate Nutrition Calculation:**
        - Calculate realistic macronutrients based on ACTUAL ingredients used
        - Ensure calorie math is correct: (protein_g × 4) + (carbs_g × 4) + (fat_g × 9) ≈ calories
        - Consider cooking methods that affect nutrition (frying adds fat, boiling removes nutrients)
        - All values must be PER SERVING
        - Include sodium and cholesterol for health-conscious users

        4. **Realistic Cost Analysis:**
        - Use 2025 USA grocery prices
        - Calculate based on actual quantities needed (not full package prices)
        - Consider seasonal availability
        - Account for regional price variations
        - Show cost per serving clearly

        5. **Ingredient Details:**
        - List ALL ingredients with precise measurements
        - Include preparation notes (diced, minced, room temperature)
        - Suggest substitutions for hard-to-find items
        - Mark optional ingredients clearly
        - Assign proper categories: "produce", "pantry", "dairy", "protein", "seafood", "meat", "bakery", "spices", "beverages", "frozen", "other"

        **OUTPUT FORMAT - Return ONLY valid JSON (no markdown, no code blocks):**

        \`\`\`json
        {
        "name": "${recipeName}",
        "description": "2-3 sentence appetizing description highlighting flavors, texture, and appeal",
        "cuisineType": "specific cuisine origin",
        "mealType": "${mealType}",
        "servings": ${servings},
        "imageUrl": "MUST be a valid, real, publicly accessible HTTP image URL for this dish (e.g. from Wikimedia, Unsplash, etc). Do NOT return a description string. Return null ONLY if absolutely no image can be found.",
        "totalTimeMinutes": <number>,
        "difficultyLevel": "easy|medium|hard",
        
        "ingredients": [
            {
            "name": "ingredient name",
            "quantity": "precise amount",
            "unit": "standard measurement",
            "isOptional": boolean,
            "notes": "prep notes or substitutions",
            "estimatedCost": <realistic USD>,
            "category": "produce|pantry|dairy|protein|seafood|meat|bakery|spices|beverages|frozen|other",
            "isPantryItem": boolean
            }
        ],
        
        "instructions": [
            "Detailed step 1 with timing and technique",
            "Detailed step 2 with temperature and visual cues",
            "Continue with precision..."
        ],
        
        "costAnalysis": {
            "totalCost": <sum of all ingredients>,
            "costPerServing": <totalCost / ${servings}>,
            "budgetEfficiency": <0.0-1.0 scale>
        },
        
        "nutrition": {
            "calories": <per serving>,
            "protein_g": <per serving>,
            "carbs_g": <per serving>,
            "fat_g": <per serving>,
            "fiber_g": <per serving>,
            "sugar_g": <per serving>,
            "sodium_mg": <per serving>,
            "cholesterol_mg": <per serving>
        },
        
        "nutritionalHighlights": [
            "Key health benefit",
            "Macro balance note",
            "Nutritional advantage"
        ],
        
        "healthScore": <0-100>,
        
        "cookingTips": [
            "Professional tip for best results",
            "Common mistake to avoid",
            "Timing or technique advice"
        ],
        
        "variations": [
            "Dietary modification option",
            "Ingredient substitution",
            "Serving suggestion"
        ],
        
        "pantryOptimization": [
            "Make-ahead instructions",
            "Storage tips (fridge/freezer)",
            "Leftover usage ideas"
        ],
        
        "webSourceInspirations": [
            "Traditional origin or cultural context",
            "Popular recipe influences"
        ],
        
        "healthConsiderations": [
            "Medical condition adaptations if relevant",
            "Allergen warnings",
            "Dietary compliance notes"
        ],
        
        "aiReasoningNotes": "Brief explanation of recipe authenticity and any adaptations made"
        }
        \`\`\`

        **VALIDATION CHECKLIST:**
        ✅ Recipe name matches "${recipeName}"
        ✅ Servings set to ${servings}
        ✅ All ingredients have valid categories
        ✅ Nutrition values are realistic and mathematically correct
        ✅ Cost analysis uses 2025 prices
        ✅ Instructions are detailed with temps/times
        ✅ Tips and variations included
        ✅ Valid JSON format (no extra text)
        ${dietaryRestrictions?.length ? "✅ Dietary restrictions fully respected" : ""}`;
  }
}
