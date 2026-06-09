import { getMergedRules } from '../lib/merge'
import {
  clearJurisdictionPacks,
  registerJurisdictionPacks,
} from '../lib/registry'
import type { JurisdictionPack } from '../lib/contract'

const parent: JurisdictionPack = {
  id: 'eu-gdpr',
  priority: 100,
  featureToggleId: 'compliance.eu-gdpr.enabled',
  requiredFields: [
    { entityId: 'opencare:care_recipient', field: 'gdpr_legal_basis', message: { en: 'parent' } },
  ],
  consentTypes: [
    {
      code: 'data_processing',
      label: { en: 'parent label' },
      lawfulBasis: 'consent',
      required: true,
      appliesTo: ['opencare:care_recipient'],
    },
  ],
  retention: [
    { entityId: 'opencare:care_note', retentionDays: 2555, anchor: 'episode_ended_at', action: 'soft_delete' },
  ],
  encryption: [
    { entityId: 'opencare:care_recipient', field: 'national_id', hashContext: 'parent.ctx' },
  ],
  validations: [],
  audit: [{ entityId: 'opencare:care_note', auditMutations: true }],
}

const child: JurisdictionPack = {
  id: 'pl-rodo',
  extends: 'eu-gdpr',
  priority: 200,
  featureToggleId: 'compliance.pl-rodo.enabled',
  requiredFields: [
    // overrides parent's gdpr_legal_basis? no — different field. Add national_id.
    { entityId: 'opencare:care_recipient', field: 'national_id', message: { en: 'PESEL required' } },
  ],
  consentTypes: [
    // overrides parent's data_processing by code
    {
      code: 'data_processing',
      label: { en: 'child label' },
      lawfulBasis: 'legal_obligation',
      required: true,
      appliesTo: ['opencare:care_recipient'],
    },
  ],
  retention: [
    // overrides parent's care_note retention (same entityId + no setting)
    { entityId: 'opencare:care_note', retentionDays: 7305, anchor: 'episode_ended_at', action: 'soft_delete' },
    // a setting-scoped variant must NOT collide with the unscoped one
    { entityId: 'opencare:care_note', setting: 'residential', retentionDays: 10957, anchor: 'episode_ended_at', action: 'soft_delete' },
  ],
  encryption: [],
  validations: [
    { entityId: 'opencare:care_recipient', field: 'national_id', id: 'pl.pesel.valid', validate: () => true, message: { en: 'bad' } },
  ],
  audit: [],
}

describe('getMergedRules', () => {
  beforeEach(() => clearJurisdictionPacks())
  afterAll(() => clearJurisdictionPacks())

  it('child pack overrides parent by key (consent code)', () => {
    registerJurisdictionPacks([parent, child])
    const merged = getMergedRules([child])
    const dp = merged.consentTypes.filter((c) => c.code === 'data_processing')
    expect(dp).toHaveLength(1)
    expect(dp[0].label.en).toBe('child label')
    expect(dp[0].lawfulBasis).toBe('legal_obligation')
  })

  it('higher-priority pack wins on requiredFields conflict (entityId+field)', () => {
    const lowParent: JurisdictionPack = {
      ...parent,
      requiredFields: [{ entityId: 'opencare:care_recipient', field: 'national_id', message: { en: 'low' } }],
    }
    registerJurisdictionPacks([lowParent, child])
    const merged = getMergedRules([child])
    const nid = merged.requiredFields.filter(
      (r) => r.entityId === 'opencare:care_recipient' && r.field === 'national_id',
    )
    expect(nid).toHaveLength(1)
    expect(nid[0].message?.en).toBe('PESEL required') // child (priority 200) wins
  })

  it('dedupes consent types by code, keeps distinct codes', () => {
    registerJurisdictionPacks([parent, child])
    const extra: JurisdictionPack = {
      ...child,
      consentTypes: [
        ...child.consentTypes,
        { code: 'marketing', label: { en: 'm' }, lawfulBasis: 'consent', required: false, appliesTo: [] },
      ],
    }
    registerJurisdictionPacks([extra])
    const merged = getMergedRules([extra])
    const codes = merged.consentTypes.map((c) => c.code).sort()
    expect(codes).toEqual(['data_processing', 'marketing'])
  })

  it('retention keyed by entityId + setting (unscoped vs scoped do not collide)', () => {
    registerJurisdictionPacks([parent, child])
    const merged = getMergedRules([child])
    const notes = merged.retention.filter((r) => r.entityId === 'opencare:care_note')
    // unscoped (overridden to 7305) + residential (10957)
    expect(notes).toHaveLength(2)
    const unscoped = notes.find((r) => !r.setting)
    const residential = notes.find((r) => r.setting === 'residential')
    expect(unscoped?.retentionDays).toBe(7305) // child overrode parent's 2555
    expect(residential?.retentionDays).toBe(10957)
  })

  it('flattens extends chain so a single active child pulls in parent rules', () => {
    registerJurisdictionPacks([parent, child])
    const merged = getMergedRules([child])
    // parent-only contributions survive
    expect(merged.requiredFields.some((r) => r.field === 'gdpr_legal_basis')).toBe(true)
    expect(merged.encryption.some((e) => e.hashContext === 'parent.ctx')).toBe(true)
    expect(merged.validations.some((v) => v.id === 'pl.pesel.valid')).toBe(true)
  })
})
