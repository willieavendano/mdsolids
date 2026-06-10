import type { ModuleDef } from "./types";

// The module registry. Each analysis module registers itself here.
// Order within a category is preserved for the sidebar.
const modules: ModuleDef[] = [];

export function register(...defs: ModuleDef[]): void {
  for (const def of defs) {
    if (modules.some((m) => m.id === def.id)) {
      throw new Error(`Duplicate module id: ${def.id}`);
    }
    modules.push(def);
  }
}

export function allModules(): ModuleDef[] {
  return modules.slice();
}

export function moduleById(id: string): ModuleDef | undefined {
  return modules.find((m) => m.id === id);
}
