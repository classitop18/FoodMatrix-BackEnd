
import OpenAI from "openai";
import { AICompletionParams, AICompletionResponse, AIProvider } from "../interfaces/ai.interfaces";


export class OpenAIProvider implements AIProvider {
  private client: OpenAI;

  constructor(apiKey: string) {
    this.client = new OpenAI({ apiKey });
  }

  async createCompletion(params: AICompletionParams): Promise<AICompletionResponse> {
    const response = await this.client.responses.create({
      model: process.env.OPENAI_MODEL_NAME || 'gpt-4o',
      max_output_tokens: params.maxTokens,
      instructions: params.systemPrompt || '',
      input: params.prompt,
    });

    return {
      content: response.output_text ?? '',
      usage: {
        promptTokens: 0, // OpenAI responses don't provide this directly
        completionTokens: 0,
        totalTokens: 0
      }
    };
  }

  getProviderName(): string {
    return 'OpenAI';
  }
}