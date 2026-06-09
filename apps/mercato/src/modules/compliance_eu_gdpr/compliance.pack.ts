import type { JurisdictionPack } from '@/modules/compliance_kit/lib/contract'

// Baseline EU GDPR jurisdiction pack — OPENCARE_PLAN.md §4.1.
// Data-only: contributes rules consumed by the compliance_kit framework.
const pack: JurisdictionPack = {
  id: 'eu-gdpr',
  priority: 100,
  featureToggleId: 'compliance.eu-gdpr.enabled',
  requiredFields: [
    {
      entityId: 'opencare:care_recipient',
      field: 'gdpr_legal_basis',
      message: {
        en: 'Legal basis for processing is required',
        pl: 'Wymagana podstawa prawna przetwarzania',
        de: 'Rechtsgrundlage erforderlich',
        es: 'Base juridica requerida',
      },
    },
  ],
  consentTypes: [
    {
      code: 'data_processing',
      required: true,
      lawfulBasis: 'consent',
      appliesTo: ['opencare:care_recipient'],
      label: {
        en: 'Personal data processing',
        pl: 'Przetwarzanie danych osobowych',
        de: 'Verarbeitung personenbezogener Daten',
        es: 'Tratamiento de datos personales',
      },
    },
    {
      code: 'health_data_processing',
      required: true,
      lawfulBasis: 'consent', // Art. 9 explicit
      appliesTo: ['opencare:care_episode', 'opencare:care_note'],
      label: {
        en: 'Health data processing (Art. 9)',
        pl: 'Przetwarzanie danych o zdrowiu (art. 9)',
        de: 'Verarbeitung von Gesundheitsdaten (Art. 9)',
        es: 'Tratamiento de datos de salud (art. 9)',
      },
    },
    {
      code: 'marketing',
      required: false,
      lawfulBasis: 'consent',
      appliesTo: ['opencare:care_recipient'],
      label: {
        en: 'Marketing communications',
        pl: 'Komunikacja marketingowa',
        de: 'Marketingkommunikation',
        es: 'Comunicaciones de marketing',
      },
    },
  ],
  retention: [
    // GDPR storage limitation baseline; jurisdictions override with statutory minimums.
    {
      entityId: 'opencare:care_note',
      retentionDays: 2555,
      anchor: 'episode_ended_at',
      action: 'soft_delete',
      legalRef: 'GDPR Art. 5(1)(e) storage limitation (baseline ~7y)',
    },
  ],
  encryption: [
    {
      entityId: 'opencare:care_recipient',
      field: 'national_id',
      hashField: 'national_id_hash',
      hashContext: 'opencare.care_recipient.national_id',
    },
    {
      entityId: 'opencare:care_recipient',
      field: 'primary_email',
      hashField: 'primary_email_hash',
      hashContext: 'opencare.care_recipient.primary_email',
    },
    {
      entityId: 'opencare:care_recipient',
      field: 'phone',
      hashField: 'phone_hash',
      hashContext: 'opencare.care_recipient.phone',
    },
    { entityId: 'opencare:care_recipient', field: 'date_of_birth' },
    { entityId: 'opencare:care_recipient', field: 'address_json' },
    { entityId: 'opencare:care_note', field: 'body' },
    { entityId: 'opencare:care_episode', field: 'diagnosis_summary' },
  ],
  validations: [],
  audit: [
    { entityId: 'opencare:care_recipient', auditMutations: true, logAccess: ['read', 'export'] },
    { entityId: 'opencare:care_note', auditMutations: true, logAccess: ['read', 'export'] },
    { entityId: 'opencare:care_episode', auditMutations: true },
  ],
}

export { pack }
export default pack
