import OpenAI from "openai";
import {
  AICompletionParams,
  AICompletionResponse,
  AIImageGenerationParams,
  AIProvider,
} from "../interfaces/ai.interfaces.js";

// ... existing code ...

export class OpenAIProvider implements AIProvider {
  private client: OpenAI;

  constructor(apiKey: string) {
    this.client = new OpenAI({ apiKey });
  }

  async createCompletion(
    params: AICompletionParams,
  ): Promise<AICompletionResponse> {
    try {
      const response = await this.client.chat.completions.create({
        model: process.env.OPENAI_MODEL_NAME || "gpt-4o",
        messages: [
          {
            role: "system",
            content: params.systemPrompt || "You are a helpful assistant.",
          },
          { role: "user", content: params.prompt },
        ],
        max_tokens: params.maxTokens,
        temperature: params.temperature || 0.7,
      });

      return {
        content: response.choices[0]?.message?.content || "",
        usage: {
          promptTokens: response.usage?.prompt_tokens || 0,
          completionTokens: response.usage?.completion_tokens || 0,
          totalTokens: response.usage?.total_tokens || 0,
        },
      };
    } catch (error: any) {
      console.error("OpenAI API Error:", error);
      throw new Error(`OpenAI API failed: ${error.message}`);
    }
  }

  async generateImage(params: AIImageGenerationParams): Promise<string> {
    try {
      const response = await this.client.images.generate({
        model: "dall-e-3",
        prompt: params.prompt,
        n: 1,
        size: params.size || "1024x1024",
        quality: params.quality || "standard",
      });

      return response.data?.[0]?.url || "";
    } catch (error: any) {
      console.error("OpenAI Image Generation Error:", error);
      throw new Error(`DALL-E Generation failed: ${error.message}`);
    }
  }

  getProviderName(): string {
    return "OpenAI";
  }
}
