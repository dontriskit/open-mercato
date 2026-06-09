import type { JurisdictionPack } from './contract'

// Import-time jurisdiction-pack registry, mirroring the core command registry
// (packages/shared/src/lib/commands/registry.ts). The Map is pinned to
// globalThis so registrations survive HMR / multiple module evaluations in dev.

const GLOBAL_KEY = '__opencare_compliance_packs__'

function getStore(): Map<string, JurisdictionPack> {
  const g = globalThis as unknown as Record<string, unknown>
  let store = g[GLOBAL_KEY] as Map<string, JurisdictionPack> | undefined
  if (!store) {
    store = new Map<string, JurisdictionPack>()
    g[GLOBAL_KEY] = store
  }
  return store
}

export function registerJurisdictionPack(pack: JurisdictionPack): void {
  if (!pack?.id) throw new Error('[internal] JurisdictionPack must define an id')
  getStore().set(pack.id, pack)
}

export function registerJurisdictionPacks(packs: JurisdictionPack[]): void {
  for (const pack of packs) registerJurisdictionPack(pack)
}

export function unregisterJurisdictionPack(id: string): void {
  getStore().delete(id)
}

export function getPack(id: string): JurisdictionPack | undefined {
  return getStore().get(id)
}

export function getAllPacks(): JurisdictionPack[] {
  return [...getStore().values()]
}

export function clearJurisdictionPacks(): void {
  getStore().clear()
}

/**
 * Resolve a pack's full `extends` chain, flattened with the requested pack
 * LAST (leaf-last). Parents come first so that later (child) entries win when
 * the merge applies last-write precedence. Cycles are guarded.
 */
export function resolvePackChain(id: string): JurisdictionPack[] {
  const store = getStore()
  const chain: JurisdictionPack[] = []
  const seen = new Set<string>()
  let current = store.get(id)
  while (current) {
    if (seen.has(current.id)) break // cycle guard
    seen.add(current.id)
    chain.unshift(current) // prepend → parent ends up before child
    current = current.extends ? store.get(current.extends) : undefined
  }
  return chain
}
