import { PantryItemsStorage } from "../pantry/pantry.repository.js";
import { RecipeStorage } from "../recipe/recipe.repository.js";
import { AdvancedRecipePromptBuilder } from "./builder/recipe-prompt.builder.js";
import { AIProvider } from "./interfaces/ai.interfaces.js";
import { JSONRecipeParser } from "./parser/json-recipe.parser.js";
import { AnthropicProvider } from "./providers/anthropic.provider.js";
import { OpenAIProvider } from "./providers/openai.provider.js";
import { AIRecipeService } from "./services/ai-recipe.service.js";

export class AIRecipeServiceFactory {
  static create(
    provider: "openai" | "anthropic",
    dependencies: {
      pantryStorage: PantryItemsStorage;
      recipeStorage: RecipeStorage;
    },
  ): AIRecipeService {
    // Initialize AI Provider
    const apiKey =
      provider === "openai"
        ? process.env.OPENAI_API_KEY
        : process.env.ANTHROPIC_API_KEY;

    if (!apiKey) {
      throw new Error(
        `Missing API key for ${provider}. Set ${provider.toUpperCase()}_API_KEY environment variable.`,
      );
    }

    const aiProvider =
      provider === "openai"
        ? new OpenAIProvider(apiKey)
        : new AnthropicProvider(apiKey);

    // Initialize Prompt Builder
    const promptBuilder = new AdvancedRecipePromptBuilder(
      dependencies.pantryStorage,
    );

    // Initialize Recipe Parser
    const recipeParser = new JSONRecipeParser();

    // Create and return service
    return new AIRecipeService(
      aiProvider,
      promptBuilder,
      recipeParser,
      dependencies.recipeStorage,
    );
  }

  static createWithCustomProvider(
    customProvider: AIProvider,
    dependencies: {
      pantryStorage: PantryItemsStorage;
      recipeStorage: RecipeStorage;
    },
  ): AIRecipeService {
    const promptBuilder = new AdvancedRecipePromptBuilder(
      dependencies.pantryStorage,
    );
    const recipeParser = new JSONRecipeParser();
    return new AIRecipeService(
      customProvider,
      promptBuilder,
      recipeParser,
      dependencies.recipeStorage,
    );
  }
}
