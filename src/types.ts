export type ProviderType = 'openrouter' | 'meta' | 'meta-llama' | 'gemini' | 'openai';

export interface ModelInfo {
  id: string;
  name: string;
  /** true = accepts images, false = text only, undefined = unknown */
  vision?: boolean;
  context?: number;
}

export interface ProviderConfig {
  id: string;
  type: ProviderType;
  name: string;
  apiKey: string;
  baseUrl: string;
  useProxy: boolean;
  /** Hosted demo provider: no local key; the deployment proxy injects a server-side key. */
  demo?: boolean;
  models: ModelInfo[];
}

export interface AppSettings {
  providers: ProviderConfig[];
  activeProviderId: string | null;
  activeModelId: string | null;
  autoSync: boolean;
  autoImages: boolean;
  autoSegment: boolean;
  debounceMs: number;
  temperature: number;
}
