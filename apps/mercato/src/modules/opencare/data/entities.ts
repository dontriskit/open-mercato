import { Entity, Index, PrimaryKey, Property } from '@mikro-orm/decorators/legacy'

@Entity({ tableName: 'care_recipients' })
@Index({ name: 'care_recipients_tenant_org_idx', properties: ['tenantId', 'organizationId'] })
export class CareRecipient {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @Property({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string

  @Property({ name: 'organization_id', type: 'uuid' })
  organizationId!: string

  @Property({ name: 'display_name', type: 'text' })
  displayName!: string

  @Property({ name: 'national_id', type: 'text', nullable: true })
  nationalId?: string | null

  @Property({ name: 'national_id_hash', type: 'text', nullable: true })
  nationalIdHash?: string | null

  @Property({ name: 'primary_email', type: 'text', nullable: true })
  primaryEmail?: string | null

  @Property({ name: 'primary_email_hash', type: 'text', nullable: true })
  primaryEmailHash?: string | null

  @Property({ name: 'phone', type: 'text', nullable: true })
  phone?: string | null

  @Property({ name: 'phone_hash', type: 'text', nullable: true })
  phoneHash?: string | null

  @Property({ name: 'date_of_birth', type: 'date', nullable: true })
  dateOfBirth?: string | null

  @Property({ name: 'gdpr_legal_basis', type: 'text', nullable: true })
  gdprLegalBasis?: string | null

  @Property({ name: 'created_at', type: Date, onCreate: () => new Date() })
  createdAt: Date = new Date()

  @Property({ name: 'updated_at', type: Date, onUpdate: () => new Date() })
  updatedAt: Date = new Date()

  @Property({ name: 'deleted_at', type: Date, nullable: true })
  deletedAt?: Date | null
}

@Entity({ tableName: 'care_settings' })
@Index({ name: 'care_settings_tenant_org_idx', properties: ['tenantId', 'organizationId'] })
export class CareSetting {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @Property({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string

  @Property({ name: 'organization_id', type: 'uuid' })
  organizationId!: string

  @Property({ name: 'name', type: 'text' })
  name!: string

  @Property({ name: 'kind', type: 'text' })
  kind!: string

  @Property({ name: 'created_at', type: Date, onCreate: () => new Date() })
  createdAt: Date = new Date()

  @Property({ name: 'updated_at', type: Date, onUpdate: () => new Date() })
  updatedAt: Date = new Date()

  @Property({ name: 'deleted_at', type: Date, nullable: true })
  deletedAt?: Date | null
}

@Entity({ tableName: 'care_episodes' })
@Index({ name: 'care_episodes_tenant_org_idx', properties: ['tenantId', 'organizationId'] })
export class CareEpisode {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @Property({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string

  @Property({ name: 'organization_id', type: 'uuid' })
  organizationId!: string

  @Property({ name: 'care_recipient_id', type: 'uuid' })
  careRecipientId!: string

  @Property({ name: 'care_setting_id', type: 'uuid' })
  careSettingId!: string

  @Property({ name: 'responsible_staff_id', type: 'uuid', nullable: true })
  responsibleStaffId?: string | null

  @Property({ name: 'started_at', type: Date })
  startedAt!: Date

  @Property({ name: 'ended_at', type: Date, nullable: true })
  endedAt?: Date | null

  @Property({ name: 'diagnosis_summary', type: 'text', nullable: true })
  diagnosisSummary?: string | null

  @Property({ name: 'created_at', type: Date, onCreate: () => new Date() })
  createdAt: Date = new Date()

  @Property({ name: 'updated_at', type: Date, onUpdate: () => new Date() })
  updatedAt: Date = new Date()

  @Property({ name: 'deleted_at', type: Date, nullable: true })
  deletedAt?: Date | null
}

@Entity({ tableName: 'care_notes' })
@Index({ name: 'care_notes_tenant_org_idx', properties: ['tenantId', 'organizationId'] })
export class CareNote {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @Property({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string

  @Property({ name: 'organization_id', type: 'uuid' })
  organizationId!: string

  @Property({ name: 'care_episode_id', type: 'uuid' })
  careEpisodeId!: string

  @Property({ name: 'care_recipient_id', type: 'uuid' })
  careRecipientId!: string

  @Property({ name: 'body', type: 'text' })
  body!: string

  @Property({ name: 'authored_by', type: 'uuid', nullable: true })
  authoredBy?: string | null

  @Property({ name: 'created_at', type: Date, onCreate: () => new Date() })
  createdAt: Date = new Date()

  @Property({ name: 'updated_at', type: Date, onUpdate: () => new Date() })
  updatedAt: Date = new Date()

  @Property({ name: 'deleted_at', type: Date, nullable: true })
  deletedAt?: Date | null
}

@Entity({ tableName: 'care_documents' })
@Index({ name: 'care_documents_tenant_org_idx', properties: ['tenantId', 'organizationId'] })
export class CareDocument {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @Property({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string

  @Property({ name: 'organization_id', type: 'uuid' })
  organizationId!: string

  @Property({ name: 'care_recipient_id', type: 'uuid' })
  careRecipientId!: string

  @Property({ name: 'attachment_id', type: 'uuid' })
  attachmentId!: string

  @Property({ name: 'title', type: 'text' })
  title!: string

  @Property({ name: 'created_at', type: Date, onCreate: () => new Date() })
  createdAt: Date = new Date()

  @Property({ name: 'updated_at', type: Date, onUpdate: () => new Date() })
  updatedAt: Date = new Date()

  @Property({ name: 'deleted_at', type: Date, nullable: true })
  deletedAt?: Date | null
}

@Entity({ tableName: 'consent_records' })
@Index({ name: 'consent_records_tenant_org_idx', properties: ['tenantId', 'organizationId'] })
@Index({ name: 'consent_records_active_idx', properties: ['tenantId', 'organizationId', 'careRecipientId', 'consentType'] })
export class ConsentRecord {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @Property({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string

  @Property({ name: 'organization_id', type: 'uuid' })
  organizationId!: string

  @Property({ name: 'care_recipient_id', type: 'uuid' })
  careRecipientId!: string

  @Property({ name: 'consent_type', type: 'text' })
  consentType!: string

  @Property({ name: 'lawful_basis', type: 'text' })
  lawfulBasis!: string

  @Property({ name: 'jurisdiction', type: 'text' })
  jurisdiction!: string

  @Property({ name: 'granted', type: 'boolean' })
  granted: boolean = false

  @Property({ name: 'granted_by', type: 'uuid', nullable: true })
  grantedBy?: string | null

  @Property({ name: 'evidence_attachment_id', type: 'uuid', nullable: true })
  evidenceAttachmentId?: string | null

  @Property({ name: 'granted_at', type: Date, nullable: true })
  grantedAt?: Date | null

  @Property({ name: 'expires_at', type: Date, nullable: true })
  expiresAt?: Date | null

  @Property({ name: 'revoked_at', type: Date, nullable: true })
  revokedAt?: Date | null

  @Property({ name: 'created_at', type: Date, onCreate: () => new Date() })
  createdAt: Date = new Date()

  @Property({ name: 'updated_at', type: Date, onUpdate: () => new Date() })
  updatedAt: Date = new Date()

  @Property({ name: 'deleted_at', type: Date, nullable: true })
  deletedAt?: Date | null
}
