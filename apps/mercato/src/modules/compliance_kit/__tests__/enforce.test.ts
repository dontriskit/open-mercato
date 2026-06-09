import { describe, it, expect } from '@jest/globals'
import { enforceMergedRules } from '../lib/enforce'
import { getMergedRules } from '../lib/merge'
import euGdprPack from '@/modules/compliance_eu_gdpr/compliance.pack'
import type { MergedRules } from '../lib/contract'

// Behavioral verification for Phase 5: with the eu-gdpr pack active, creating a
// care_recipient WITHOUT gdpr_legal_basis must be rejected (422); WITH it the
// rules pass. We exercise the exact helper the guard + commands share, fed by
// the same merge function the service uses.

function activeRules(): MergedRules {
  // Simulate "eu-gdpr enabled" by merging the pack directly (the service path is
  // getActivePacks → getMergedRules; here we feed the pack to getMergedRules).
  return getMergedRules([euGdprPack])
}

describe('compliance_kit enforce — required-field rejection', () => {
  it('rejects a care_recipient created without gdpr_legal_basis', () => {
    const rules = activeRules()
    const res = enforceMergedRules(
      'opencare:care_recipient',
      null,
      { display_name: 'Jane Doe' },
      rules,
      'en',
      { operation: 'create' },
    )
    expect(res.ok).toBe(false)
    if (!res.ok) {
      expect(res.failure.status).toBe(422)
      expect(res.failure.field).toBe('gdpr_legal_basis')
      expect(res.failure.message).toBe('Legal basis for processing is required')
    }
  })

  it('accepts a care_recipient with gdpr_legal_basis present', () => {
    const rules = activeRules()
    const res = enforceMergedRules(
      'opencare:care_recipient',
      null,
      { display_name: 'Jane Doe', gdpr_legal_basis: 'consent' },
      rules,
      'en',
      { operation: 'create' },
    )
    expect(res.ok).toBe(true)
  })

  it('uses the request locale for the rejection message', () => {
    const rules = activeRules()
    const res = enforceMergedRules('opencare:care_recipient', null, {}, rules, 'pl', {
      operation: 'create',
    })
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.failure.message).toBe('Wymagana podstawa prawna przetwarzania')
  })

  it('matches dot-notation entity ids (guard resourceKind form)', () => {
    const rules = activeRules()
    const res = enforceMergedRules('opencare.care_recipient', null, {}, rules, 'en', {
      operation: 'create',
    })
    expect(res.ok).toBe(false)
  })

  it('does not enforce an untouched required field on partial update', () => {
    const rules = activeRules()
    const res = enforceMergedRules(
      'opencare:care_recipient',
      null,
      { display_name: 'New name' },
      rules,
      'en',
      { operation: 'update' },
    )
    expect(res.ok).toBe(true)
  })
})
