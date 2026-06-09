/**
 * Compliance audit subscriber — OPENCARE_PLAN.md §3.6 #5.
 *
 * Persistent subscriber that records an action-log entry for opencare domain
 * mutations when an active jurisdiction pack sets `auditMutations: true` for the
 * mutated entity. Packs contribute the DATA (audit obligations); this single
 * subscriber enforces them — no per-jurisdiction subscriber wiring.
 *
 * WILDCARD CHOICE: the event bus matches `module.*` with single-segment
 * semantics (the `*` cannot cross a `.`), so `opencare.*` would NOT match
 * `opencare.care_note.created`. We therefore subscribe to `'*'` and filter to
 * the `opencare.<entity>.<created|updated|deleted>` shape internally — the exact
 * pattern proven by `business_rules/subscribers/crud-rule-trigger.ts`.
 *
 * HOT-PATH: kept minimal. The opencare CRUD events carry only IDs + scope
 * ({ id, tenantId, organizationId, careRecipientId? }) — NOT the record body —
 * so this handler logs identifiers only and never snapshots plaintext PII (the
 * encrypted note body / diagnosis never reaches the action log). One cheap
 * merged-rules read (5-min cached in the service) + one insert per qualifying
 * event.
 */

import type { ComplianceKitService } from '../lib/compliance-kit-service'
import { normalizeEntityId } from '../lib/enforce'

export const metadata = {
  event: '*',
  persistent: true,
  id: 'compliance_kit:audit-care-mutations',
}

type SubscriberContext = {
  resolve: <T = unknown>(name: string) => T
  eventName?: string
  tenantId?: string | null
  organizationId?: string | null
}

type ActionLogServiceLike = {
  log(input: Record<string, unknown>): Promise<unknown>
}

const OPERATION_BY_SUFFIX: Record<string, 'create' | 'update' | 'delete'> = {
  created: 'create',
  updated: 'update',
  deleted: 'delete',
}

/**
 * Parse `opencare.care_note.created` into its parts. Returns null for any event
 * that is not an opencare CRUD mutation, so the wildcard handler exits cheaply.
 */
function parseOpencareEvent(
  eventName: string,
): { entityId: string; operation: 'create' | 'update' | 'delete' } | null {
  if (!eventName.startsWith('opencare.')) return null
  const parts = eventName.split('.')
  if (parts.length !== 3) return null
  const [, entity, suffix] = parts
  const operation = OPERATION_BY_SUFFIX[suffix]
  if (!operation) return null
  return { entityId: `opencare:${entity}`, operation }
}

export default async function handler(payload: unknown, ctx: SubscriberContext): Promise<void> {
  const eventName = ctx.eventName
  if (!eventName) return

  const parsed = parseOpencareEvent(eventName)
  if (!parsed) return

  const data = (payload && typeof payload === 'object' ? payload : {}) as Record<string, unknown>
  // Prefer trusted scope from the bus context; fall back to the payload's own
  // ids (CRUD events embed tenant/org + record id).
  const tenantId =
    (typeof ctx.tenantId === 'string' && ctx.tenantId) ||
    (typeof data.tenantId === 'string' ? data.tenantId : null)
  if (!tenantId) return
  const organizationId =
    (typeof ctx.organizationId === 'string' && ctx.organizationId) ||
    (typeof data.organizationId === 'string' ? data.organizationId : null)
  const resourceId = typeof data.id === 'string' ? data.id : null
  if (!resourceId) return

  let service: ComplianceKitService
  try {
    service = ctx.resolve<ComplianceKitService>('complianceKitService')
  } catch {
    // Service unavailable — do not block on a wiring issue.
    return
  }

  let rules
  try {
    rules = await service.getMergedRules(tenantId)
  } catch {
    return
  }

  const obligation = rules.audit.find(
    (a) => normalizeEntityId(a.entityId) === parsed.entityId && a.auditMutations === true,
  )
  if (!obligation) return

  let actionLogService: ActionLogServiceLike
  try {
    actionLogService = ctx.resolve<ActionLogServiceLike>('actionLogService')
  } catch {
    return
  }

  try {
    await actionLogService.log({
      tenantId,
      organizationId,
      commandId: `compliance.audit.${parsed.entityId}.${parsed.operation}`,
      actionLabel: `Compliance audit: ${parsed.operation} ${parsed.entityId}`,
      resourceKind: parsed.entityId.replace(':', '.'),
      resourceId,
      // IDs + scope only — never the record body, so no plaintext PII is
      // snapshotted into the action log. `context` carries non-PII metadata.
      context: {
        complianceAudit: true,
        operation: parsed.operation,
        entityId: parsed.entityId,
        ...(typeof data.careRecipientId === 'string' ? { careRecipientId: data.careRecipientId } : {}),
      },
    })
  } catch (err) {
    // After-the-fact audit log; never throw into the event pipeline.
    console.error('[compliance_kit:audit-care-mutations] failed to write action log', err)
  }
}
