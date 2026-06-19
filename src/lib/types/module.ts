export interface VetSorceryModule {
  id: string;
  name: string;
  version: string;
  specialty: string;
  tier: 'free' | 'pro' | 'enterprise';

  systemPrompt: string;
  extractMetadata(text: string): unknown;
  validate(data: unknown): { valid: boolean; errors?: any[] };
  computeQuality(data: any): { missing: string[]; completeness: number };
  generateTriggers(data: any): Record<string, boolean | string>;
  toFirestore(data: any): object;
  researchFields?: string[];
  uiComponent?: string;
}

export interface ModuleManifest {
  id: string;
  name: string;
  version: string;
  tier: 'free' | 'pro' | 'enterprise';
  enabled: boolean;
  schemaRef?: string;
  promptRef?: string;
  researchFields?: string[];
}
