/**
 * Compliance read-access enrichers — OPENCARE_PLAN.md §3.6 #5.
 *
 * ResponseEnrichers on `opencare:care_recipient` and `opencare:care_note` that,
 * when an active jurisdiction pack's `AuditObligation` includes `logAccess`
 * containing `'read'`, record an access-log entry (accessType `'read'`) for the
 * served records. Packs contribute the obligation as DATA; this single pair of
 * enrichers enforces it.
 *
 * The enricher is ADDITIVE-ONLY and side-effect tolerant: access logging is a
 * fire-and-forget side effect (AccessLogService.log tracks its own pending
 * writes), the records are returned UNCHANGED, and any failure is swallowed so a
 * logging hiccup never breaks a read. `fallback` returns the records as-is.
 *
 * `cacheableOnListHit` stays at the fail-closed default (false): the access log
 * MUST be written on every read, so this enricher must re-run on each list cache
 * hit rather than being served from the cache.
 *
 * NOTE on `'export'`: the CSV/Excel export path strips `_`-prefixed + `_meta`
 * fields and does not run enrichers the same way; read logging here covers the
 * list/detail read obligation. Export-specific access logging would hook the
 * export path and is out of scope for this enricher.
 */

import type { ResponseEnricher, EnricherContext } from '@open-mercato/shared/lib/crud/response-enricher'
import type { ComplianceKitService } from '../lib/compliance-kit-service'
import { normalizeEntityId } from '../lib/enforce'

type AccessLogServiceLike = {
  logMany(inputs: Record<string, unknown>[]): Promise<number>
}

type CareRecord = Record<string, unknown> & { id: string }

/**
 * Best-effort: does an active pack require read-access logging for this entity?
 * Resolves the compliance service from the enricher container. Returns false on
 * any failure (fail-open for the read; logging is the side effect that is
 * skipped, never the data).
 */
async function shouldLogRead(entityId: string, ctx: EnricherContext): Promise<boolean> {
  if (!ctx.tenantId) return false
  const container = ctx.container as { resolve: <T>(name: string) => T } | undefined
  if (!container || typeof container.resolve !== 'function') return false
  let service: ComplianceKitService
  try {
    service = container.resolve<ComplianceKitService>('complianceKitService')
  } catch {
    return false
  }
  try {
    const rules = await service.getMergedRules(ctx.tenantId)
    const target = normalizeEntityId(entityId)
    return rules.audit.some(
      (a) => normalizeEntityId(a.entityId) === target && Array.isArray(a.logAccess) && a.logAccess.includes('read'),
    )
  } catch {
    return false
  }
}

function recordAccess(entityId: string, records: CareRecord[], ctx: EnricherContext): void {
  if (records.length === 0) return
  const container = ctx.container as { resolve: <T>(name: string) => T } | undefined
  if (!container || typeof container.resolve !== 'function') return
  let accessLogService: AccessLogServiceLike
  try {
    accessLogService = container.resolve<AccessLogServiceLike>('accessLogService')
  } catch {
    return
  }
  const resourceKind = entityId.replace(':', '.')
  const inputs = records
    .filter((r) => typeof r.id === 'string' && r.id.length > 0)
    .map((r) => ({
      tenantId: ctx.tenantId,
      organizationId: ctx.organizationId,
      actorUserId: ctx.userId,
      resourceKind,
      resourceId: String(r.id),
      accessType: 'read',
    }))
  if (inputs.length === 0) return
  // Fire-and-forget; AccessLogService tracks pending writes internally.
  void accessLogService.logMany(inputs).catch((err) => {
    console.error('[compliance_kit:read-access] failed to write access log', err)
  })
}

function makeReadAccessEnricher(entityId: string): ResponseEnricher<CareRecord> {
  return {
    id: `compliance_kit.read-access.${entityId}`,
    targetEntity: entityId,
    priority: 0,
    timeout: 2000,
    cacheableOnListHit: false,
    fallback: {},

    async enrichOne(record, context) {
      try {
        if (await shouldLogRead(entityId, context)) {
          recordAccess(entityId, [record], context)
        }
      } catch {
        // never break a read on a logging failure
      }
      return record
    },

    async enrichMany(records, context) {
      try {
        if (await shouldLogRead(entityId, context)) {
          recordAccess(entityId, records, context)
        }
      } catch {
        // never break a read on a logging failure
      }
      return records
    },
  }
}

export const enrichers: ResponseEnricher[] = [
  makeReadAccessEnricher('opencare:care_recipient'),
  makeReadAccessEnricher('opencare:care_note'),
]

export default enrichers
