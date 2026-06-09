// The typed compliance contract — see OPENCARE_PLAN.md §3.1.
// Jurisdiction packs contribute DATA shaped by these types; the framework
// merges and consumes that data. No behavior lives here.

export type LawfulBasis =
  | 'consent'
  | 'contract'
  | 'legal_obligation'
  | 'vital_interests'
  | 'public_task'
  | 'legitimate_interests'

export type RequiredFieldRule = {
  entityId: string // 'opencare:care_recipient'
  field: string // 'gdpr_legal_basis'
  setting?: 'home' | 'residential' | 'clinic'
  message?: Record<string, string> // i18n by locale
}

export type ConsentTypeDef = {
  code: string // 'health_data_processing'
  label: Record<string, string> // { en, pl, de, es }
  lawfulBasis: LawfulBasis
  required: boolean
  appliesTo: string[] // entityIds: ['opencare:care_episode', 'opencare:care_note']
}

export type RetentionAnchor = 'created_at' | 'episode_ended_at' | 'granted_at'
export type RetentionAction = 'soft_delete' | 'anonymize' // NEVER hard_delete

export type RetentionRule = {
  entityId: string
  setting?: string
  retentionDays: number // engineering placeholder; counsel sign-off required
  anchor: RetentionAnchor
  action: RetentionAction
  legalRef?: string
}

export type EncryptionRequirement = {
  entityId: string
  field: string
  hashField?: string // for searchable PII
  hashContext?: string // STABLE shared context string
}

export type ValidationRule = {
  entityId: string
  field: string
  id: string // 'pl.pesel.valid'
  validate: (value: unknown, record: Record<string, unknown>) => boolean
  message: Record<string, string>
}

export type AuditObligation = {
  entityId: string
  auditMutations?: boolean // create/update/delete -> actionLogService
  logAccess?: ('read' | 'export')[] // -> accessLogService via enricher
}

export type JurisdictionPack = {
  id: string // 'eu-gdpr'
  extends?: string // 'eu-gdpr'
  priority: number // higher wins on conflict
  featureToggleId: string // 'compliance.eu-gdpr.enabled'
  requiredFields: RequiredFieldRule[]
  consentTypes: ConsentTypeDef[]
  retention: RetentionRule[]
  encryption: EncryptionRequirement[]
  validations: ValidationRule[]
  audit: AuditObligation[]
}

// The flattened, conflict-resolved view produced by `getMergedRules`.
export type MergedRules = {
  requiredFields: RequiredFieldRule[]
  consentTypes: ConsentTypeDef[]
  retention: RetentionRule[]
  encryption: EncryptionRequirement[]
  validations: ValidationRule[]
  audit: AuditObligation[]
}
