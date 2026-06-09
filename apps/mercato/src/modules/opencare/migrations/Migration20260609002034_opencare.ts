import { Migration } from '@mikro-orm/migrations';

export class Migration20260609002034_opencare extends Migration {

  override up(): void | Promise<void> {
    this.addSql(`alter table "care_recipients" add "national_id_hash" text null, add "primary_email_hash" text null, add "phone_hash" text null;`);
  }

  override down(): void | Promise<void> {
    this.addSql(`alter table "care_recipients" drop column "national_id_hash", drop column "primary_email_hash", drop column "phone_hash";`);
  }

}
