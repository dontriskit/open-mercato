/**
 * Retention sweep worker — OPENCARE_PLAN.md §3.6 #3, Phase 7.
 *
 * Queue worker (queue `compliance-retention-sweep`) that, per tenant with active
 * jurisdiction packs, loads the merged `RetentionRule[]` and, for each rule,
 * computes the cutoff (now - retentionDays at the rule's anchor) and finds
 * non-deleted rows whose anchor is at/older than the cutoff.
 *
 * The worker is SELF-CONTAINED: it reads retention rules directly from
 * `complianceKitService.getMergedRules(tenantId)` rather than from the
 * business_rules engine. Seeding retention rules into business_rules via
 * `setup.ts seedDefaults` is DEFERRED (see report) — the self-contained path is
 * the safer choice and needs no business_rules execution semantics.
 *
 * MANDATORY SAFEGUARDS (see also lib/retention-sweep.ts):
 *  - DEFAULT DRY-RUN. Live mode requires BOTH the env flag
 *    `OM_RETENTION_SWEEP_LIVE=1` AND an explicit `live: true` in the job payload.
 *    In dry-run the worker only LOGS what it WOULD affect (counts + ids); it
 *    performs NO writes.
 *  - Only `soft_delete` / `anonymize` actions — NEVER a hard delete.
 *  - Erasure guard: never act before the cutoff, and respect the LONGEST
 *    applicable retention across merged rules (Polish lex specialis — a longer
 *    statutory retention such as RODO 20y overrides GDPR erasure). The longest
 *    period yields the latest cutoff and is enforced in `selectExpiredRows`.
 *
 * Scheduling: the worker contract here is `{ queue }` (packages/queue) — there is
 * no cron field on the worker itself. A nightly run is wired by the scheduler
 * module (a DB-backed ScheduledJob that enqueues this queue), or it can be
 * triggered manually. Run via:
 *   yarn mercato compliance_kit worker compliance-retention-sweep
 */

import type { EntityManager } from '@mikro-orm/postgresql'
import type { ComplianceKitService } from '../lib/compliance-kit-service'
import type { RetentionRule } from '../lib/contract'
import { normalizeEntityId } from '../lib/enforce'
import { selectExpiredRows, type SweepRow } from '../lib/retention-sweep'
import {
  CareEpisode,
  CareNote,
  CareRecipient,
  CareSetting,
  CareDocument,
  ConsentRecord,
} from '../../opencare/data/entities'

export const metadata = {
  queue: 'compliance-retention-sweep',
  id: 'compliance_kit:retention-sweep',
  // Database-heavy but read-mostly; keep low to bound connection use.
  concurrency: 1,
}

type RetentionSweepPayload = {
  tenantId: string
  organizationId?: string | null
  /** Opt into live mode; ALSO requires OM_RETENTION_SWEEP_LIVE=1. */
  live?: boolean
}

type QueuedJob<T> = { payload: T }
type HandlerContext = { resolve: <T = unknown>(name: string) => T }

// Map a contract entityId to its ORM entity class. Unknown entities are skipped.
const ENTITY_BY_ID: Record<string, unknown> = {
  'opencare:care_recipient': CareRecipient,
  'opencare:care_setting': CareSetting,
  'opencare:care_episode': CareEpisode,
  'opencare:care_note': CareNote,
  'opencare:care_document': CareDocument,
  'opencare:consent_record': ConsentRecord,
}

function isLiveEnabled(payload: RetentionSweepPayload): boolean {
  return payload.live === true && process.env.OM_RETENTION_SWEEP_LIVE === '1'
}

/**
 * Load candidate rows for a rule's entity, resolving the anchor timestamp per row.
 * - created_at / granted_at: read directly off the row.
 * - episode_ended_at: the anchor is the related care_episode's ended_at. For
 *   care_episode itself it's the row's own ended_at; for care_note we resolve via
 *   care_episode_id. A null anchor (e.g. an open episode) means the row is NEVER
 *   selected — selectExpiredRows skips null anchors.
 */
async function loadRows(
  em: EntityManager,
  rule: RetentionRule,
  tenantId: string,
  organizationId: string | null,
): Promise<SweepRow[]> {
  const entityId = normalizeEntityId(rule.entityId)
  const EntityClass = ENTITY_BY_ID[entityId]
  if (!EntityClass) return []

  const scope: Record<string, unknown> = { tenantId }
  if (organizationId) scope.organizationId = organizationId

  const rows = (await em.find(EntityClass as never, scope as never)) as Array<Record<string, unknown>>

  if (rule.anchor === 'episode_ended_at') {
    if (entityId === 'opencare:care_episode') {
      return rows.map((r) => ({
        id: String(r.id),
        anchorAt: (r.endedAt as Date | null) ?? null,
        deletedAt: (r.deletedAt as Date | null) ?? null,
      }))
    }
    // care_note (and any other episode-anchored entity): resolve via episode.
    const episodeIds = Array.from(
      new Set(rows.map((r) => (typeof r.careEpisodeId === 'string' ? r.careEpisodeId : null)).filter(Boolean)),
    ) as string[]
    const endedByEpisode = new Map<string, Date | null>()
    if (episodeIds.length > 0) {
      const episodes = (await em.find(CareEpisode as never, { id: { $in: episodeIds }, tenantId } as never)) as Array<
        Record<string, unknown>
      >
      for (const ep of episodes) endedByEpisode.set(String(ep.id), (ep.endedAt as Date | null) ?? null)
    }
    return rows.map((r) => ({
      id: String(r.id),
      anchorAt: typeof r.careEpisodeId === 'string' ? endedByEpisode.get(r.careEpisodeId) ?? null : null,
      deletedAt: (r.deletedAt as Date | null) ?? null,
    }))
  }

  const anchorProp = rule.anchor === 'granted_at' ? 'grantedAt' : 'createdAt'
  return rows.map((r) => ({
    id: String(r.id),
    anchorAt: (r[anchorProp] as Date | null) ?? null,
    deletedAt: (r.deletedAt as Date | null) ?? null,
  }))
}

/**
 * Apply the retention action to the selected ids. soft_delete sets deletedAt;
 * anonymize blanks the entity's sensitive fields (best-effort per entity) and
 * stamps an anonymized marker. NEVER hard-deletes.
 */
async function applyAction(
  em: EntityManager,
  rule: RetentionRule,
  ids: string[],
  tenantId: string,
): Promise<void> {
  if (ids.length === 0) return
  const entityId = normalizeEntityId(rule.entityId)
  const EntityClass = ENTITY_BY_ID[entityId]
  if (!EntityClass) return
  const where = { id: { $in: ids }, tenantId } as never

  if (rule.action === 'soft_delete') {
    await em.nativeUpdate(EntityClass as never, where, { deletedAt: new Date() } as never)
    return
  }

  // anonymize — blank the highest-sensitivity fields per entity; keep the row.
  const updates: Record<string, Record<string, unknown>> = {
    'opencare:care_note': { body: '[anonymized]' },
    'opencare:care_episode': { diagnosisSummary: null },
    'opencare:care_recipient': {
      nationalId: null,
      nationalIdHash: null,
      primaryEmail: null,
      primaryEmailHash: null,
      phone: null,
      phoneHash: null,
      dateOfBirth: null,
    },
  }
  const patch = updates[entityId]
  if (patch) {
    await em.nativeUpdate(EntityClass as never, where, { ...patch, updatedAt: new Date() } as never)
  }
}

export default async function handler(
  job: QueuedJob<RetentionSweepPayload>,
  ctx: HandlerContext,
): Promise<void> {
  const payload = job.payload
  const tenantId = payload?.tenantId
  if (!tenantId) {
    console.error('[compliance_kit:retention-sweep] missing tenantId in payload')
    return
  }
  const organizationId = payload.organizationId ?? null
  const live = isLiveEnabled(payload)
  const mode = live ? 'LIVE' : 'DRY-RUN'

  let service: ComplianceKitService
  let em: EntityManager
  try {
    service = ctx.resolve<ComplianceKitService>('complianceKitService')
    em = ctx.resolve<EntityManager>('em')
  } catch (err) {
    console.error('[compliance_kit:retention-sweep] required services unavailable', err)
    return
  }

  const rules = await service.getMergedRules(tenantId)
  const retention = rules.retention
  if (retention.length === 0) {
    console.log(`[compliance_kit:retention-sweep] (${mode}) tenant=${tenantId}: no active retention rules`)
    return
  }

  const now = new Date()
  for (const rule of retention) {
    if (rule.action !== 'soft_delete' && rule.action !== 'anonymize') {
      // Defensive: the contract type forbids hard_delete, but never act on an
      // unexpected action.
      console.warn(`[compliance_kit:retention-sweep] skipping unsupported action "${rule.action}" for ${rule.entityId}`)
      continue
    }
    let rows: SweepRow[]
    try {
      rows = await loadRows(em.fork(), rule, tenantId, organizationId)
    } catch (err) {
      console.error(`[compliance_kit:retention-sweep] failed to load rows for ${rule.entityId}`, err)
      continue
    }
    const { cutoff, selectedIds } = selectExpiredRows(rule, rows, retention, now)

    console.log(
      `[compliance_kit:retention-sweep] (${mode}) tenant=${tenantId} entity=${rule.entityId} ` +
        `action=${rule.action} anchor=${rule.anchor} retentionDays=${rule.retentionDays} ` +
        `cutoff=${cutoff.toISOString()} candidates=${rows.length} wouldAffect=${selectedIds.length}` +
        (selectedIds.length > 0 ? ` ids=${selectedIds.slice(0, 50).join(',')}` : '') +
        (rule.legalRef ? ` legalRef="${rule.legalRef}"` : ''),
    )

    if (!live) continue // DRY-RUN: no writes.
    try {
      await applyAction(em.fork(), rule, selectedIds, tenantId)
    } catch (err) {
      console.error(`[compliance_kit:retention-sweep] failed to apply ${rule.action} for ${rule.entityId}`, err)
    }
  }
}
