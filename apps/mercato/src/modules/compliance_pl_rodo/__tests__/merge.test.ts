import { getMergedRules } from '@/modules/compliance_kit/lib/merge'
import {
  clearJurisdictionPacks,
  registerJurisdictionPacks,
} from '@/modules/compliance_kit/lib/registry'
import euGdpr from '@/modules/compliance_eu_gdpr/compliance.pack'
import plRodo from '../compliance.pack'

// Phase 8 behavioral verification: feed BOTH real packs through the real
// resolvePackChain / getMergedRules and assert the documented merge + overrides.
describe('compliance_pl_rodo merged with compliance_eu_gdpr', () => {
  beforeEach(() => {
    clearJurisdictionPacks()
    registerJurisdictionPacks([euGdpr, plRodo])
  })
  afterEach(() => clearJurisdictionPacks())

  it('merges requiredFields from both packs for care_recipient', () => {
    const merged = getMergedRules([plRodo])
    const fields = merged.requiredFields
      .filter((r) => r.entityId === 'opencare:care_recipient')
      .map((r) => r.field)
    expect(fields).toContain('national_id') // from pl-rodo
    expect(fields).toContain('gdpr_legal_basis') // from eu-gdpr baseline
  })

  it('pl-rodo (priority 200) overrides eu-gdpr care_note retention 2555 -> 7305', () => {
    const merged = getMergedRules([plRodo])
    const careNote = merged.retention.find(
      (r) => r.entityId === 'opencare:care_note' && !r.setting,
    )
    expect(careNote?.retentionDays).toBe(7305)
    expect(careNote?.legalRef).toContain('art. 29')
    const careEpisode = merged.retention.find(
      (r) => r.entityId === 'opencare:care_episode' && !r.setting,
    )
    expect(careEpisode?.retentionDays).toBe(7305)
  })

  it('merged PESEL validation passes valid and fails invalid national_id', () => {
    const merged = getMergedRules([plRodo])
    const rule = merged.validations.find((v) => v.id === 'pl.pesel.valid')
    expect(rule).toBeDefined()
    expect(rule!.validate('44051401359', { national_id: '44051401359' })).toBe(true)
    expect(rule!.validate('44051401358', { national_id: '44051401358' })).toBe(false)
    expect(rule!.validate('', {})).toBe(false)
  })
})
