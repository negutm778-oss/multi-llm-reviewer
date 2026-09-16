import { AIProvider, LLMRequest } from './types';

class GenericFetchProvider implements AIProvider {
  constructor(
    private apiKey: string,
    private endpoint: string,
    private model: string
  ) {}

  async complete(request: LLMRequest): Promise<string> {
    const response = await fetch(this.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {})
      },
      body: JSON.stringify({
        model: this.model,
        messages: [
          { role: 'system', content: request.systemPrompt },
          { role: 'user', content: request.userPrompt }
        ],
        temperature: 0.2
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Eroare API (${response.status}): ${errorText}`);
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };

    return data.choices?.[0]?.message?.content || '';
  }
}

export function createProvider(providerName: string, apiKey: string, model?: string, baseUrl?: string): AIProvider {
  const p = providerName.toLowerCase();

  switch (p) {
    case 'openai':
      return new GenericFetchProvider(
        apiKey,
        `${baseUrl || 'https://api.openai.com/v1'}/chat/completions`,
        model || 'gpt-4o'
      );

    case 'groq':
      return new GenericFetchProvider(
        apiKey,
        'https://api.groq.com/openai/v1/chat/completions',
        model || 'llama-3.3-70b-versatile'
      );

    case 'deepseek':
      return new GenericFetchProvider(
        apiKey,
        'https://api.deepseek.com/chat/completions',
        model || 'deepseek-chat'
      );

    case 'ollama':
      return new GenericFetchProvider(
        '',
        `${baseUrl || 'http://localhost:11434'}/v1/chat/completions`,
        model || 'llama3'
      );

    default:
      throw new Error(`Providerul ${providerName} nu este configurat.`);
  }
}