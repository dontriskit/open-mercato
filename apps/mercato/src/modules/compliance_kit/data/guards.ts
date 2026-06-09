import type { EntityManager } from '@mikro-orm/postgresql'
import type { MutationGuard } from '@open-mercato/shared/lib/crud/mutation-guard-registry'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import type { ComplianceKitService } from '../lib/compliance-kit-service'
import { enforceMergedRules, normalizeEntityId } from '../lib/enforce'

// ONE shared compliance guard for the whole opencare domain — OPENCARE_PLAN.md
// §3.6 #1. Jurisdiction packs contribute DATA (rules); this single guard
// enforces them. No per-jurisdiction guard wiring/ordering.
//
// Discovered via the `data/guards.ts` convention (packages/cli generators/
// extensions/guards.ts) and registered into the mutation-guard store at
// bootstrap. The CRUD factory runs it on create/update for any `opencare.*`
// resource.

function localeFromHeaders(headers: Headers): string {
  const raw = headers.get('accept-language')
  if (!raw) return 'en'
  const first = raw.split(',')[0]?.trim().slice(0, 2).toLowerCase()
  return first || 'en'
}

const complianceGuard: MutationGuard = {
  id: 'compliance_kit.opencare-rules',
  targetEntity: 'opencare.*',
  operations: ['create', 'update'],
  priority: 40,

  async validate(input) {
    const payload = input.mutationPayload
    if (!payload || typeof payload !== 'object') return { ok: true }
    if (!input.tenantId) return { ok: true }

    const container = await createRequestContainer()
    let service: ComplianceKitService
    try {
      service = container.resolve('complianceKitService') as ComplianceKitService
    } catch {
      // Service unavailable → cannot evaluate rules; fail open (do not block
      // unrelated mutations on a wiring issue). This mirrors the optimistic-lock
      // guard's tolerance for an unresolved EM.
      return { ok: true }
    }

    let rules
    try {
      rules = await service.getMergedRules(input.tenantId)
    } catch {
      return { ok: true }
    }

    const locale = localeFromHeaders(input.requestHeaders)
    const setting = typeof (payload as Record<string, unknown>).setting === 'string'
      ? ((payload as Record<string, unknown>).setting as string)
      : null

    // Required fields + validations (pure payload checks).
    const result = enforceMergedRules(
      input.resourceKind,
      setting,
      payload as Record<string, unknown>,
      rules,
      locale,
      { operation: input.operation === 'update' ? 'update' : 'create' },
    )
    if (!result.ok) {
      return { ok: false, status: result.failure.status, message: result.failure.message }
    }

    // Consent enforcement: block create/update on an entity that a
    // required:true, lawfulBasis:'consent' consent appliesTo when no active
    // consent exists for the recipient.
    const target = normalizeEntityId(input.resourceKind)
    const requiredConsents = rules.consentTypes.filter(
      (c) => c.required && c.lawfulBasis === 'consent' && c.appliesTo.some((e) => normalizeEntityId(e) === target),
    )
    if (requiredConsents.length > 0) {
      const recipientId = resolveRecipientId(payload as Record<string, unknown>, target)
      if (recipientId) {
        let em: EntityManager | null = null
        try {
          em = container.resolve('em') as EntityManager
        } catch {
          em = null
        }
        if (em) {
          try {
            const active = await service.getActiveConsents(
              em,
              recipientId,
              input.tenantId,
              input.organizationId ?? '',
            )
            const activeCodes = new Set(active.map((a) => a.consentType))
            for (const consent of requiredConsents) {
              if (!activeCodes.has(consent.code)) {
                return {
                  ok: false,
                  status: 422,
                  message:
                    consent.label[locale] ??
                    consent.label.en ??
                    `Active consent "${consent.code}" is required`,
                }
              }
            }
          } catch {
            // Consent lookup failed — do not block on infra error.
          }
        }
      }
      // No recipient id available on payload (e.g. creating the recipient
      // itself): consent records cannot exist yet, so consent is enforced on
      // dependent entities (episodes/notes) that carry care_recipient_id.
    }

    return { ok: true }
  },
}

function resolveRecipientId(payload: Record<string, unknown>, target: string): string | null {
  // For the recipient entity, the recipient is the record itself (its id, on
  // update). For dependent entities, the FK column points at the recipient.
  const candidates =
    target === 'opencare:care_recipient'
      ? ['id']
      : ['care_recipient_id', 'careRecipientId']
  for (const key of candidates) {
    const v = payload[key]
    if (typeof v === 'string' && v.length > 0) return v
  }
  return null
}

export const guards: MutationGuard[] = [complianceGuard]

export default guards
