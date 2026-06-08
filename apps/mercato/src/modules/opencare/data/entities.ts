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

  @Property({ name: 'primary_email', type: 'text', nullable: true })
  primaryEmail?: string | null

  @Property({ name: 'phone', type: 'text', nullable: true })
  phone?: string | null

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
