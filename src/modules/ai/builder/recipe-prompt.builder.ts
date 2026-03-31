import { PantryItemsStorage } from "@/modules/pantry/pantry.repository.js";
import {
  AIRecipeRequest,
  RecipePromptBuilder,
  RecipeScore,
  ShoppingListItem,
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
                    **🚫 DO NOT SUGGEST (Already generated/cooked in last 2 weeks):**
                    The following recipes have been generated or cooked in the current or previous week. Do NOT suggest them again:
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
                - Use realistic 2025 grocery prices (USA market for USD)
                - **CRITICAL:** The 'totalCost' field MUST be the exact sum of all 'estimatedCost' fields in the 'ingredients' array.
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
                "name": "ingredient name (singular, standard name, e.g., 'Tomato' not 'Fresh Diced Tomatoes')",
                "quantity": "precise amount (number or fraction)",
                "unit": "measurement (["cup","tbsp","tsp","oz","lb","gram","kg","ml","liter","piece","clove","slice","dozen","can","bunch","jar"])",
                "isOptional": false,
                "notes": "preparation tips (e.g. 'diced', 'peeled') or substitutions",
                "estimatedCost": <realistic USD amount based on USA 2025 prices>,
                "category": "produce|pantry|dairy|protein|seafood|meat|bakery|spices|beverages|frozen|other",
                "isPantryItem": true|false
            }
            ],

           "shoppingList": [
  {
    "ingredientName": "Canonical, singular, standardized ingredient name. Must be lowercase, no plural forms, no brand names, and no unnecessary adjectives. Examples: 'tomato', 'onion', 'milk', 'egg', 'bread'. All variations must map to a single common name.",
    
    "quantity": "Numeric value only. Aggregate total required quantity. Use decimal format if needed (e.g., 0.5, 1.25). Do not include units in this field.",
    
    "unit": "Use standardized units based on item type:
    
    - For measurable solids (vegetables, fruits, grains, etc.): use ONLY 'kg', 'g', or 'lb'
      (e.g., tomato → kg, onion → kg, rice → kg)
    
    - For liquids: use ONLY 'l' or 'ml'
      (e.g., milk → l, oil → ml)
    
    - Use 'piece' ONLY for items that are naturally counted and cannot be meaningfully expressed in weight/volume
      (e.g., egg, bread loaf, banana, lemon)
    
    - Use 'pack' ONLY for packaged goods where weight/volume is unknown or irrelevant
      (e.g., bread pack, biscuit pack)
    
    Strict Rules:
    - DO NOT use 'piece' for items that are typically bought by weight (e.g., tomato, onion, potato)
    - DO NOT use 'pack' if weight/volume can be reasonably estimated
    - Prefer weight/volume units whenever possible"
  }
]
            
            "instructions": [
            "Step 1: Detailed action with timing and temperature",
            "Step 2: Next action with visual cues",
            "Step 3: Continue with precision..."
            ],
            
            "costAnalysis": {
            "totalCost": <sum of all 'estimatedCost' fields in ingredients>,
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

    // Global constraints
    if (request.allergies?.length) {
      healthInfo.push(
        `⚠️ ALLERGIES (ZERO TOLERANCE - GLOBAL): ${request.allergies.join(", ")} - Completely avoid`,
      );
    }
    if (request.dietaryRestrictions?.length) {
      healthInfo.push(
        `🥗 Dietary Restrictions (Global): ${request.dietaryRestrictions.join(", ")} - MUST comply`,
      );
    }

    // Detailed Member Profiles
    if (request.healthProfiles?.length) {
      healthInfo.push("**👤 Specific Member Health Needs:**");
      request.healthProfiles.forEach((profile) => {
        const details = [];
        if (profile.dietaryRestrictions?.length)
          details.push(`Diet: ${profile.dietaryRestrictions.join(", ")}`);
        if (profile.allergies?.length)
          details.push(`Allergies: ${profile.allergies.join(", ")}`);
        if (profile.healthConditions?.length)
          details.push(`Conditions: ${profile.healthConditions.join(", ")}`);
        if (profile.healthGoals?.length)
          details.push(`Goals: ${profile.healthGoals.join(", ")}`);

        if (details.length > 0) {
          healthInfo.push(
            `- Member ${profile.name || profile.id}: ${details.join(" | ")}`,
          );
        }
      });
      healthInfo.push(
        "👉 **INSTRUCTION:** Generate recipes that satisfy specific member needs where possible, without violating global safety constraints (allergies/restrictions).",
        "👉 **TAGGING:** In the recipe `healthConsiderations` field, explicitly mention which condition/goal this recipe helps with (e.g., 'Low Sugar for [Member Name]').",
      );
    } else {
      // Fallback to global if no profiles
      if (request.healthConditions?.length) {
        healthInfo.push(
          `🩺 Health Conditions: ${request.healthConditions.join(", ")} - Adapt recipe accordingly`,
        );
      }
      if (request.healthGoals?.length) {
        healthInfo.push(
          `🎯 Health Goals: ${request.healthGoals.join(", ")} - Optimize for these`,
        );
      }
    }

    return healthInfo;
  }

  /**
   * Builds a prompt to estimate costs for a list of ingredients
   */
  async buildIngredientCostPrompt(
    ingredients: { name: string; quantity: number; unit: string }[],
  ): Promise<string> {
    const itemsList = ingredients
      .map((i) => `- ${i.name} (${i.quantity} ${i.unit})`)
      .join("\n");

    return `Estimate the cost for the following ingredients based on 2025/2026 USA grocery prices, assuming a **budget-conscious but realistic shopper**:

${itemsList}

**Pricing Strategy:**
- Use **"Store Brand"** or **"Value"** pricing for generic items (e.g., flour, sugar, canned goods, spices).
- Assume standard non-organic produce unless specified otherwise.
- Look for family-pack pricing for meats if the quantity is large.
- Avoid premium or specialty store pricing (e.g., Whole Foods) on basic items; use mainstream grocery store averages (e.g., Kroger, Walmart, Aldi).

**OUTPUT FORMAT (JSON ONLY):**
Return a JSON array of objects, one for each ingredient, with the following structure:
\`\`\`json
[
  {
    "name": "ingredient name",
    "estimatedCost": <number in USD>,
    "unit": "unit used for estimation"
  }
]
\`\`\`

**RULES:**
1. Provide realistic **budget-friendly** estimates for the EXACT quantity specified.
2. If the quantity is small (e.g., "pinch"), estimate a proportional cost from a standard package.
3. Return ONLY valid JSON.
`;
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
        
        0. **VALIDATION (MOST IMPORTANT):**
        - First, verify if "${recipeName}" is a real, edible food item known in culinary traditions.
        - If the name is gibberish, random characters, a non-food item, or completely made up (e.g., "skibidi toilet stew", "sdklfjsdklfjsd"), you MUST return:
          \`{ "isValid": false, "invalidReason": "The recipe name '${recipeName}' does not appear to be a real food item." }\`
        - Do NOT hallucinate a recipe for nonsense names.
        - If valid, proceed with the rest of the steps.

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
        - Use 2025/2026 USA grocery prices
        - **Pricing Strategy:** Act as a budget-conscious shopper (Store Brand/Value pricing for generics).
        - Calculate based on actual quantities needed (not full package prices)
        - **CRITICAL:** The total cost MUST be the exact sum of all ingredient costs. Do not estimate it separately.
        - Show cost per serving clearly (Total Cost / Servings)

        5. **Ingredient Details:**
        - List ALL ingredients with precise measurements
        - Include preparation notes (diced, minced, room temperature)
        - Suggest substitutions for hard-to-find items
        - Mark optional ingredients clearly
        - Assign proper categories: "produce", "pantry", "dairy", "protein", "seafood", "meat", "bakery", "spices", "beverages", "frozen", "other"

        **OUTPUT FORMAT - Return ONLY valid JSON (no markdown, no code blocks):**

        \`\`\`json
        {
        "isValid": true,
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
            "name": "ingredient name (singular, standard name)",
            "quantity": "precise amount",
            "unit": "standard measurement",
            "isOptional": boolean,
            "notes": "prep notes or substitutions",
            "estimatedCost": <realistic USD, budget-conscious>,
            "category": "produce|pantry|dairy|protein|seafood|meat|bakery|spices|beverages|frozen|other",
            "isPantryItem": boolean
            }
        ],

        "shoppingList": [
            {
            "ingredientName": "name of ingredient to buy (standardized)",
            "quantity": "amount to buy (converted as weight/volume)",
            "unit": "sstandard purchasing unit (MUST use 'kg', 'g', 'lb' for solid produce, 'l', 'ml' for liquids. Do NOT use 'piece' or counts.)"
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

  async buildShoppingListMergePrompt(
    items: ShoppingListItem[],
  ): Promise<string> {
    const itemsList = items
      .map(
        (i, idx) =>
          `${idx + 1}. ${i.ingredientName}: ${i.quantity} ${i.unit} (Category: ${i.category || "unknown"})`,
      )
      .join("\n");

    return `You are an expert grocery logistics assistant. Your mission is to take multiple fragments of shopping lists from different recipes and synthesize them into a single, high-efficiency consolidated shopping session.

**INCOMING LIST FRAGMENTS:**
${itemsList}

**LOGISTICS RULES:**

1. **Canonical Normalization**:
- Standardize all ingredient names to their singular, lowercase, base form
(e.g., "Organic Red Onions" → "onion", "Large Brown Eggs" → "egg")

---

2. **Unit Harmonization & Mathematical Conversion**:
- Convert all units into a single consistent base before merging

**Conversion Weights (Approximate):**
- 1 tbsp Salt = 18g
- 1 tsp Salt = 6g
- 1 tbsp Oil = 14g
- 1 cup Water/Milk = 240ml
- 1 cup Rice = 185g
- 1 tbsp Butter = 14g

---

3. **🚨 FINAL OUTPUT MUST BE PURCHASABLE UNITS (VERY IMPORTANT)**:

Spices (salt, turmeric, chili powder, cumin, pepper, garam masala, etc.) → **"pack"**
- Any amount (1 tsp or 100g) → 1 pack
- Even if multiple recipes use the same spice → still 1 pack

Oil, liquid condiments → **"bottle"**
- Any amount ≤ 1 litre → 1 bottle

Milk → **"litre"**

Grains (rice, flour, lentils, oats) → **"kg"** if ≥500g, else **"pack"**

Canned goods (chickpeas, kidney beans, tomato sauce) → **"can"**

---

4. **🚨 UNIT PRESERVATION RULE (CRITICAL — DO NOT VIOLATE)**:

**If an ingredient's input unit is already a COUNT/PIECE unit (piece, pieces, pcs, whole, unit, clove, bunch, head), you MUST output it as "piece" — NEVER convert it to kg or g.**

Examples:
- Input: "1 piece onion" → Output: "piece" unit ✅ (NEVER "kg")
- Input: "2 pieces tomato" → Output: "piece" unit ✅ (NEVER "kg")
- Input: "3 cloves garlic" → Output: "piece" unit ✅ (NEVER "kg")
- Input: "1 whole lemon" → Output: "piece" unit ✅

---

5. **Vegetable & Fruit Unit Rules (STRICT)**:

**These vegetables are ALWAYS sold/counted by PIECE — output unit MUST be "piece":**
onion, tomato, potato, carrot, lemon, lime, apple, banana, orange, garlic, cucumber, bell pepper, capsicum, avocado, corn, eggplant, zucchini, egg, beetroot, sweet potato, turnip, chili, ginger (small piece), broccoli head, cauliflower head, lettuce head

For these, convert weight to approximate piece count IF input is in grams:
- 1 onion ≈ 150g → 200g input = 1-2 pieces
- 1 tomato ≈ 100g → 300g input = 3 pieces
- 1 potato ≈ 200g → 400g input = 2 pieces

**These vegetables may be sold by WEIGHT — output unit is "kg":**
spinach, cabbage, mushrooms, green beans, peas, herbs (large quantity), nuts

---

6. **Smart Aggregation (CRITICAL)**:
- Merge duplicate items across recipes
- DO NOT increase pack count unnecessarily
- Example: 1 tsp salt + 2 tsp salt → 1 pack salt (NOT 2 packs)
- Example: 1 piece onion + 1 piece onion → 2 piece onion (SUM the pieces, keep unit "piece")

---

7. **Smart Categorization**:
Must assign exactly one category:
"Produce", "Dairy", "Meat/Seafood", "Pantry", "Spices", "Bakery", "Frozen", "Beverages", "Other"

---

**OUTPUT FORMAT (STRICT JSON ONLY):**

[
  {
    "ingredientName": "salt",
    "quantity": "1",
    "unit": "pack",
    "displayQuantity": "1",
    "displayUnit": "packet",
    "category": "Spices",
    "isCommonPantryItem": true
  },
  {
    "ingredientName": "onion",
    "quantity": "3",
    "unit": "piece",
    "displayQuantity": "3",
    "displayUnit": "piece",
    "category": "Produce",
    "isCommonPantryItem": false
  }
]

---

**CONSTRAINTS:**
- NO cooking units in final output (no tsp, tbsp, ml, pinch, dash)
- ONLY purchasable units: pack, bottle, kg, litre, piece, can
- NEVER convert piece/count units to kg
- NO duplicate items
- JSON only — no explanation text, no markdown
- Mathematically correct merging before conversion
- Optimize for minimum purchase quantity
`;
  }
}
