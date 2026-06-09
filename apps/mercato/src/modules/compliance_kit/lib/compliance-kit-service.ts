import type { EntityManager } from '@mikro-orm/core'
import type { JurisdictionPack, MergedRules } from './contract'
import { getAllPacks } from './registry'
import { getMergedRules } from './merge'

// Minimal structural view of the core FeatureTogglesService.getBoolConfig
// result. The real service lives in
// packages/core/src/modules/feature_toggles/lib/feature-flag-check.ts and
// returns `{ ok: true, value } | { ok: false, error }`.
type BoolConfigResult = { ok: true; value: boolean } | { ok: false; error?: unknown }

export interface FeatureTogglesServiceLike {
  getBoolConfig(identifier: string, tenantId: string): Promise<BoolConfigResult>
}

const CACHE_TTL_MS = 5 * 60 * 1000 // ~5-min in-service cache

type ActiveConsentRow = {
  consentType: string
  jurisdiction: string
}

/**
 * ComplianceKitService — OPENCARE_PLAN.md §3.4. Scoped DI service.
 *
 * Phase 3 is INERT: nothing calls this yet (no guards/subscribers/workers).
 * It only exposes pure read helpers that resolve active packs from feature
 * toggles and merge their contributed rules.
 */
export class ComplianceKitService {
  private readonly featureTogglesService: FeatureTogglesServiceLike
  private readonly activePacksCache = new Map<string, { at: number; packs: JurisdictionPack[] }>()

  constructor({ featureTogglesService }: { featureTogglesService: FeatureTogglesServiceLike }) {
    this.featureTogglesService = featureTogglesService
  }

  /**
   * Resolve the jurisdiction packs enabled for a tenant by consulting the
   * feature toggle declared on each registered pack. ~5-min in-service cache.
   */
  async getActivePacks(tenantId: string): Promise<JurisdictionPack[]> {
    const cached = this.activePacksCache.get(tenantId)
    if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.packs

    const active: JurisdictionPack[] = []
    for (const pack of getAllPacks()) {
      try {
        const res = await this.featureTogglesService.getBoolConfig(pack.featureToggleId, tenantId)
        if (res.ok && res.value) active.push(pack)
      } catch {
        // Fail closed: an unreadable toggle leaves the pack inactive.
      }
    }
    this.activePacksCache.set(tenantId, { at: Date.now(), packs: active })
    return active
  }

  /** Merged contract for a tenant's active packs (incl. their `extends` parents). */
  async getMergedRules(tenantId: string): Promise<MergedRules> {
    const active = await this.getActivePacks(tenantId)
    return getMergedRules(active)
  }

  /** Clear the active-packs cache (e.g. after a tenant toggles a pack). */
  invalidate(tenantId?: string): void {
    if (tenantId) this.activePacksCache.delete(tenantId)
    else this.activePacksCache.clear()
  }

  /**
   * Active-consent lookup against `consent_records` for a recipient — the
   * query the shared guard will use in a later phase. Returns the active
   * `(consentType, jurisdiction)` pairs:
   *   granted AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at > now())
   */
  async getActiveConsents(
    em: EntityManager,
    recipientId: string,
    tenantId: string,
    orgId: string,
  ): Promise<ActiveConsentRow[]> {
    const now = new Date()
    const rows = await em.find(
      'ConsentRecord' as never,
      {
        tenantId,
        organizationId: orgId,
        careRecipientId: recipientId,
        granted: true,
        revokedAt: null,
        deletedAt: null,
        $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }],
      } as never,
      { fields: ['consentType', 'jurisdiction'] as never },
    )
    return (rows as unknown as ActiveConsentRow[]).map((r) => ({
      consentType: r.consentType,
      jurisdiction: r.jurisdiction,
    }))
  }
}

export default ComplianceKitService
