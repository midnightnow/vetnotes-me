import type { VetSorceryModule } from '$lib/types/module';
import dermatology from '$lib/modules/dermatology';
import cpd from '$lib/modules/cpd';

const registry = new Map<string, VetSorceryModule>([
  ['dermatology', dermatology],
  ['cpd', cpd]
]);

export async function loadModule(moduleId: string): Promise<VetSorceryModule> {
  const existing = registry.get(moduleId);
  if (existing) return existing;

  throw new Error(`Unknown module: ${moduleId}`);
}

export function getRegisteredModuleIds(): string[] {
  return Array.from(registry.keys());
}
