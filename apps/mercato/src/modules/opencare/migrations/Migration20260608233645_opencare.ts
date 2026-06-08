import { Migration } from '@mikro-orm/migrations';

export class Migration20260608233645_opencare extends Migration {

  override up(): void | Promise<void> {
    this.addSql(`create table "care_recipients" ("id" uuid not null default gen_random_uuid(), "tenant_id" uuid not null, "organization_id" uuid not null, "display_name" text not null, "national_id" text null, "primary_email" text null, "phone" text null, "date_of_birth" date null, "gdpr_legal_basis" text null, "created_at" timestamptz not null, "updated_at" timestamptz not null, "deleted_at" timestamptz null, primary key ("id"));`);
    this.addSql(`create index "care_recipients_tenant_org_idx" on "care_recipients" ("tenant_id", "organization_id");`);
  }

}
