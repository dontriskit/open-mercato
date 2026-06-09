import type { MergedRules } from './contract'

// Shared compliance enforcement helper — used by BOTH the mutation guard
// (CRUD route path) and the opencare write commands (direct/bulk path) so the
// same required-field + validation rules apply no matter how a record is
// mutated (anti-bypass — OPENCARE_PLAN.md §3.6 #1).

export type EnforceFailure = {
  status: number
  message: string
  field: string
  ruleId?: string
}

export type EnforceResult = { ok: true } | { ok: false; failure: EnforceFailure }

/**
 * Normalize an entity identifier to the contract's colon form.
 * The mutation-guard registry uses dot notation (`opencare.care_recipient`)
 * while pack rules use colon notation (`opencare:care_recipient`).
 */
export function normalizeEntityId(entityId: string): string {
  return entityId.replace('.', ':')
}

function pickMessage(message: Record<string, string> | undefined, locale: string, fallback: string): string {
  if (!message) return fallback
  return message[locale] ?? message.en ?? fallback
}

/**
 * Read a field from a mutation payload tolerant to camelCase / snake_case key
 * spelling (CRUD route payloads vary by entry point).
 */
function readField(record: Record<string, unknown>, field: string): unknown {
  if (field in record) return record[field]
  const camel = field.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase())
  if (camel in record) return record[camel]
  return undefined
}

function hasKey(record: Record<string, unknown>, field: string): boolean {
  if (field in record) return true
  const camel = field.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase())
  return camel in record
}

function isEmpty(value: unknown): boolean {
  if (value === undefined || value === null) return true
  if (typeof value === 'string') return value.trim().length === 0
  return false
}

/**
 * Run required-field + validation rules for a single entity mutation.
 * Consent enforcement is handled separately by the guard (needs an EM); this
 * helper covers the parts that are pure functions of the payload + merged rules
 * so they can run safely inside commands without a request container.
 */
export function enforceMergedRules(
  entityId: string,
  setting: string | null,
  record: Record<string, unknown>,
  rules: MergedRules,
  locale = 'en',
  options: { operation?: 'create' | 'update' } = {},
): EnforceResult {
  const target = normalizeEntityId(entityId)
  const operation = options.operation ?? 'create'

  for (const rule of rules.requiredFields) {
    if (normalizeEntityId(rule.entityId) !== target) continue
    if (rule.setting && setting && rule.setting !== setting) continue
    if (rule.setting && !setting) {
      // Setting-scoped rule but no setting known on this payload: skip rather
      // than over-enforce.
      continue
    }
    // On partial updates, only enforce required fields that the payload is
    // actually touching — never reject a field the caller did not send.
    if (operation === 'update' && !hasKey(record, rule.field)) continue
    if (isEmpty(readField(record, rule.field))) {
      return {
        ok: false,
        failure: {
          status: 422,
          field: rule.field,
          message: pickMessage(rule.message, locale, `Field "${rule.field}" is required`),
        },
      }
    }
  }

  for (const rule of rules.validations) {
    if (normalizeEntityId(rule.entityId) !== target) continue
    const value = readField(record, rule.field)
    // Only validate when a value is present; emptiness is the required-field
    // rule's concern.
    if (isEmpty(value)) continue
    let passed = true
    try {
      passed = rule.validate(value, record)
    } catch {
      passed = false
    }
    if (!passed) {
      return {
        ok: false,
        failure: {
          status: 422,
          field: rule.field,
          ruleId: rule.id,
          message: pickMessage(rule.message, locale, `Field "${rule.field}" is invalid`),
        },
      }
    }
  }

  return { ok: true }
}
