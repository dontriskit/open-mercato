import type { ModuleEncryptionMap } from '@open-mercato/shared/modules/encryption'

// Translation of the eu-gdpr pack's `encryption[]` requirements into the real
// ModuleEncryptionMap shape (packages/shared/src/modules/encryption.ts).
// Aggregated globally by the compliance_kit `compliance.encryptionMaps`
// generator (convention file: compliance.encryption.ts) and gated per-tenant by
// TENANT_DATA_ENCRYPTION at runtime. Searchable PII declares a `hashField`
// column for hash-for-lookup (mirrors customer_accounts:customer_user.email).
export const defaultEncryptionMaps: ModuleEncryptionMap[] = [
  {
    entityId: 'opencare:care_recipient',
    fields: [
      { field: 'national_id', hashField: 'national_id_hash' },
      { field: 'primary_email', hashField: 'primary_email_hash' },
      { field: 'phone', hashField: 'phone_hash' },
      { field: 'date_of_birth' },
      { field: 'address_json' },
    ],
  },
  {
    entityId: 'opencare:care_note',
    fields: [{ field: 'body' }],
  },
  {
    entityId: 'opencare:care_episode',
    fields: [{ field: 'diagnosis_summary' }],
  },
]

export default defaultEncryptionMaps
