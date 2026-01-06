import Anthropic from "@anthropic-ai/sdk";
import {
  AICompletionParams,
  AICompletionResponse,
  AIImageGenerationParams,
  AIProvider,
} from "../interfaces/ai.interfaces.js";

export class AnthropicProvider implements AIProvider {
  private client: Anthropic;

  constructor(apiKey: string) {
    this.client = new Anthropic({
      apiKey,
      timeout: 60000,
    });
  }

  async createCompletion(
    params: AICompletionParams,
  ): Promise<AICompletionResponse> {
    const response = await this.client.messages.create({
      model: process.env.ANTHROPIC_MODEL_NAME || "claude-sonnet-4-20250514",
      max_tokens: params.maxTokens,
      system: params.systemPrompt || "",
      messages: [{ role: "user", content: params.prompt }],
    });

    const content = response.content[0];
    if (content.type !== "text") {
      throw new Error("Expected text content from Anthropic API");
    }

    return {
      content: content.text,
      usage: {
        promptTokens: response.usage.input_tokens,
        completionTokens: response.usage.output_tokens,
        totalTokens: response.usage.input_tokens + response.usage.output_tokens,
      },
    };
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async generateImage(params: AIImageGenerationParams): Promise<string> {
    throw new Error("Image generation is not supported by Anthropic provider.");
  }

  getProviderName(): string {
    return "Anthropic";
  }
}
