export interface ReviewSuggestion {
  file: string;
  line?: number;
  severity: 'critical' | 'warning' | 'info';
  comment: string;
}

export interface ReviewResponse {
  summary: string;
  suggestions: ReviewSuggestion[];
}

export interface LLMRequest {
  systemPrompt: string;
  userPrompt: string;
}

export interface AIProvider {
  complete(request: LLMRequest): Promise<string>;
}