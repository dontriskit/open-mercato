import { Migration } from '@mikro-orm/migrations';

export class Migration20260609000159_opencare extends Migration {

  override up(): void | Promise<void> {
    this.addSql(`create table "care_documents" ("id" uuid not null default gen_random_uuid(), "tenant_id" uuid not null, "organization_id" uuid not null, "care_recipient_id" uuid not null, "attachment_id" uuid not null, "title" text not null, "created_at" timestamptz not null, "updated_at" timestamptz not null, "deleted_at" timestamptz null, primary key ("id"));`);
    this.addSql(`create index "care_documents_tenant_org_idx" on "care_documents" ("tenant_id", "organization_id");`);

    this.addSql(`create table "care_episodes" ("id" uuid not null default gen_random_uuid(), "tenant_id" uuid not null, "organization_id" uuid not null, "care_recipient_id" uuid not null, "care_setting_id" uuid not null, "responsible_staff_id" uuid null, "started_at" timestamptz not null, "ended_at" timestamptz null, "diagnosis_summary" text null, "created_at" timestamptz not null, "updated_at" timestamptz not null, "deleted_at" timestamptz null, primary key ("id"));`);
    this.addSql(`create index "care_episodes_tenant_org_idx" on "care_episodes" ("tenant_id", "organization_id");`);

    this.addSql(`create table "care_notes" ("id" uuid not null default gen_random_uuid(), "tenant_id" uuid not null, "organization_id" uuid not null, "care_episode_id" uuid not null, "care_recipient_id" uuid not null, "body" text not null, "authored_by" uuid null, "created_at" timestamptz not null, "updated_at" timestamptz not null, "deleted_at" timestamptz null, primary key ("id"));`);
    this.addSql(`create index "care_notes_tenant_org_idx" on "care_notes" ("tenant_id", "organization_id");`);

    this.addSql(`create table "care_settings" ("id" uuid not null default gen_random_uuid(), "tenant_id" uuid not null, "organization_id" uuid not null, "name" text not null, "kind" text not null, "created_at" timestamptz not null, "updated_at" timestamptz not null, "deleted_at" timestamptz null, primary key ("id"));`);
    this.addSql(`create index "care_settings_tenant_org_idx" on "care_settings" ("tenant_id", "organization_id");`);

    this.addSql(`create table "consent_records" ("id" uuid not null default gen_random_uuid(), "tenant_id" uuid not null, "organization_id" uuid not null, "care_recipient_id" uuid not null, "consent_type" text not null, "lawful_basis" text not null, "jurisdiction" text not null, "granted" boolean not null default false, "granted_by" uuid null, "evidence_attachment_id" uuid null, "granted_at" timestamptz null, "expires_at" timestamptz null, "revoked_at" timestamptz null, "created_at" timestamptz not null, "updated_at" timestamptz not null, "deleted_at" timestamptz null, primary key ("id"));`);
    this.addSql(`create index "consent_records_active_idx" on "consent_records" ("tenant_id", "organization_id", "care_recipient_id", "consent_type");`);
    this.addSql(`create index "consent_records_tenant_org_idx" on "consent_records" ("tenant_id", "organization_id");`);
  }

}
