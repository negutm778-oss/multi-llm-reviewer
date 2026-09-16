import { LLMRequest } from './types';

export interface AIProvider {
  complete(request: LLMRequest): Promise<string>;
}
