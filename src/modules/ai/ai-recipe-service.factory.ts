import { db } from "../db";
import { PantryItemsStorage } from "../storage/pantry-items.storage";
import { RecipeStorage } from "../storage/recipe.storage";
import { AdvancedRecipePromptBuilder } from "./builder/recipe-prompt.builder";
import { AIProvider } from "./interfaces/ai.interfaces";
import { JSONRecipeParser } from "./parser/json-recipe.parser";
import { AnthropicProvider } from "./providers/anthropic.provider";
import { OpenAIProvider } from "./providers/openai.provider";
import { AIRecipeService } from "./services/ai-recipe.service";

export class AIRecipeServiceFactory {
    static create(
        provider: 'openai' | 'anthropic',
        dependencies: { pantryStorage: PantryItemsStorage, recipeStorage: RecipeStorage }
    ): AIRecipeService {
        // Initialize AI Provider
        const apiKey = provider === 'openai' ? process.env.OPENAI_API_KEY : process.env.ANTHROPIC_API_KEY;

        if (!apiKey) {
            throw new Error(`Missing API key for ${provider}. Set ${provider.toUpperCase()}_API_KEY environment variable.`);
        }

        const aiProvider = provider === 'openai' ? new OpenAIProvider(apiKey) : new AnthropicProvider(apiKey);

        // Initialize Prompt Builder
        const promptBuilder = new AdvancedRecipePromptBuilder(dependencies.pantryStorage);

        // Initialize Recipe Parser
        const recipeParser = new JSONRecipeParser();
        const recipeStorage = new RecipeStorage(db);

        // Create and return service
        return new AIRecipeService(aiProvider, promptBuilder, recipeParser, recipeStorage);
    }

    static createWithCustomProvider(
        customProvider: AIProvider,
        dependencies: {
            pantryService: any;
            storage: any;
            db: any;
        }
    ): AIRecipeService {
        const promptBuilder = new AdvancedRecipePromptBuilder(dependencies.storage);
        const recipeParser = new JSONRecipeParser();
        const recipeStorage = new RecipeStorage(db);
        return new AIRecipeService(
            customProvider,
            promptBuilder,
            recipeParser,
            recipeStorage
        );
    }
}