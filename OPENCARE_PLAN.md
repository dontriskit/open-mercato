# OpenCare Implementation Blueprint

> Jurisdiction-as-module spine + first-class care/consent data model.
> Target repo: `/home/mhm/Documents/opencare`. All work lives under `apps/mercato/src/modules/` with `from: '@app'`. **Zero edits to `packages/core`.**

---

## 1. Executive Summary + Layered Architecture

OpenCare adds a multi-jurisdiction care-management capability to Open Mercato without forking core. The clinical record and consent ledger are **real tables** (not EAV). Jurisdiction rules (GDPR baseline, Polish RODO) are **drop-in modules** that contribute *data* (consent specs, retention rules, required-field rules, encryption maps) consumed by a single framework module. Per-tenant enablement is pure `feature_toggles` — flip a country without redeploy.

Four `@app` modules are added:

| Module | Role |
|--------|------|
| `opencare` | First-class care domain entities + CRUD + admin screens |
| `compliance_kit` | Framework: registry, DI service, ONE shared guard, retention sweep, audit subscriber, encryption aggregation |
| `compliance_eu_gdpr` | Baseline jurisdiction pack (data-only) |
| `compliance_pl_rodo` | Polish pack, `extends: eu-gdpr` (data-only; proves third-party drop-in) |

```
+-----------------------------------------------------------------------------+
|  Layer 5  Jurisdiction Packs (data-only, from:'@app')                        |
|    compliance_eu_gdpr (baseline)      compliance_pl_rodo (extends eu-gdpr)   |
|    compliance.pack.ts + encryption.ts + i18n                                 |
+-----------------------------------------------------------------------------+
                 | registerJurisdictionPack() at import time
                 v
+-----------------------------------------------------------------------------+
|  Layer 2/3/4  compliance_kit framework (from:'@app')                         |
|    registry.ts  ->  complianceKitService (DI, scoped)                        |
|    getActivePacks(tenantId) via featureTogglesService.getBoolConfig          |
|    explicit `extends` + `priority` merge (child wins)                        |
|                                                                             |
|    Maps contract -> 5 verified core primitives:                             |
|     1. requiredFields/validations -> ONE MutationGuard ('opencare.*')        |
|        + gate the create COMMAND + bulk-import (anti-bypass)                 |
|     2. consent -> first-class consent_records + same guard                   |
|     3. retention -> business_rules + nightly retention-sweep worker          |
|     4. encryption -> generator-aggregated defaultEncryptionMaps (global)     |
|     5. audit -> persistent wildcard subscriber + read ResponseEnricher       |
|                                                                             |
|    Per-tenant enablement: feature_toggles (compliance.<pack>.enabled)        |
+-----------------------------------------------------------------------------+
                 | FK-id references (no cross-module ORM relations)
                 v
+-----------------------------------------------------------------------------+
|  Layer 1  opencare care domain (from:'@app', tenant+org scoped)              |
|    care_recipients  care_settings  care_episodes  care_notes                 |
|    care_documents   consent_records                                          |
|    each: makeCrudRoute + Zod validators + events + indexer + admin screens   |
+-----------------------------------------------------------------------------+
                 |
                 v
+-----------------------------------------------------------------------------+
|  packages/core (UNTOUCHED): staff, attachments, audit_logs, business_rules,  |
|  feature_toggles, scheduler, encryption, crud factory, mutation-guard reg.   |
+-----------------------------------------------------------------------------+
```

Boot wiring (one edit to `apps/mercato/src/modules.ts`):
```ts
{ id: 'opencare', from: '@app' },
{ id: 'compliance_kit', from: '@app' },
{ id: 'compliance_eu_gdpr', from: '@app' },
{ id: 'compliance_pl_rodo', from: '@app' },
```
`bootstrap.ts` already calls `applyModuleOverridesFromEnabledModules` before registries load — no change needed there.

---

## 2. The Generic Care Domain (`opencare`)

Rules for every entity: `@mikro-orm/decorators/legacy`; `id` uuid `gen_random_uuid()`; non-null `tenant_id` + `organization_id` uuid; `created_at`/`updated_at`/`deleted_at`; composite index `(tenant_id, organization_id)`; FK-id references (string uuids, **no `@ManyToOne`**); sensitive fields encrypted via the module's `encryption.ts` map (declared globally, gated per-tenant by `TENANT_DATA_ENCRYPTION`). Jurisdiction-specific recipient data goes into encrypted `address_json` jsonb — **never new global columns**.

`(E)` = encrypted field, `(H)` = also has `_hash` lookup column via `hashForLookup` with a STABLE context string (e.g. `opencare.care_recipient.national_id`). Same context MUST be used by GDPR and RODO or PESEL dedupe breaks.

### `care_recipients` — `opencare:care_recipient`
| column | type | notes |
|---|---|---|
| id | uuid PK | |
| tenant_id / organization_id | uuid | scoping |
| display_name | text | non-PII label |
| national_id | text (E,H) | PESEL / national id; `national_id_hash` |
| primary_email | text (E,H) | `primary_email_hash` |
| phone | text (E,H) | `phone_hash` |
| date_of_birth | date (E) | |
| address_json | jsonb (E) | jurisdiction-specific structured PII |
| gdpr_legal_basis | text null | required by packs via guard, not NOT-NULL |
| created_at/updated_at/deleted_at | timestamptz | |

### `care_settings` — `opencare:care_setting`
| column | type | notes |
|---|---|---|
| id, tenant_id, organization_id | uuid | |
| name | text | |
| kind | text | `home` \| `residential` \| `clinic` (rules key off this) |
| timestamps | | |

### `care_episodes` — `opencare:care_episode`
| column | type | notes |
|---|---|---|
| id, tenant_id, organization_id | uuid | |
| care_recipient_id | uuid | FK-id -> care_recipients |
| care_setting_id | uuid | FK-id -> care_settings |
| responsible_staff_id | uuid null | FK-id -> **core `staff`** (do NOT add a Carer table) |
| started_at | timestamptz | retention anchor `episode_ended_at` uses ended_at |
| ended_at | timestamptz null | |
| diagnosis_summary | text (E) | Art.9 health data |
| timestamps | | |

### `care_notes` — `opencare:care_note`
| column | type | notes |
|---|---|---|
| id, tenant_id, organization_id | uuid | |
| care_episode_id | uuid | FK-id -> care_episodes |
| care_recipient_id | uuid | denormalized FK-id for retention/access queries |
| body | text (E) | highest sensitivity (Art.9) |
| authored_by | uuid null | FK-id -> staff |
| timestamps | | |

### `care_documents` — `opencare:care_document`
| column | type | notes |
|---|---|---|
| id, tenant_id, organization_id | uuid | |
| care_recipient_id | uuid | FK-id |
| attachment_id | uuid | FK-id -> core `attachments` |
| title | text | |
| timestamps | | |

### `consent_records` — `opencare:consent_record` (FIRST-CLASS ledger)
| column | type | notes |
|---|---|---|
| id, tenant_id, organization_id | uuid | |
| care_recipient_id | uuid | FK-id |
| consent_type | text | matches pack `ConsentTypeDef.code` |
| lawful_basis | text | `consent` \| `contract` \| `legal_obligation` \| ... |
| jurisdiction | text | `eu-gdpr` \| `pl-rodo` |
| granted | boolean | |
| granted_by | uuid null | actor user id |
| evidence_attachment_id | uuid null | FK-id -> attachments |
| granted_at | timestamptz null | |
| expires_at | timestamptz null | |
| revoked_at | timestamptz null | |
| timestamps | | |

**Active-consent check** (used by the guard): join `(care_recipient_id, consent_type, jurisdiction)` `WHERE granted AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at > now())`. Index `(tenant_id, organization_id, care_recipient_id, consent_type)`.

### Migration command sequence (run from `apps/mercato`)
```bash
yarn generate        # entity registries
yarn db:generate     # creates migrations/Migration<ts>_opencare.ts + updates .snapshot
yarn db:migrate      # apply locally (optional; migrations are committed)
yarn typecheck
```
Do NOT hand-edit `.snapshot-open-mercato.json`. Each entity is a named export in `data/entities.ts`.

---

## 3. The Compliance-Plugin Framework (`compliance_kit`)

### 3.1 The typed contract — `compliance_kit/lib/contract.ts`
```ts
export type LawfulBasis =
  | 'consent' | 'contract' | 'legal_obligation'
  | 'vital_interests' | 'public_task' | 'legitimate_interests'

export type RequiredFieldRule = {
  entityId: string                 // 'opencare:care_recipient'
  field: string                    // 'gdpr_legal_basis'
  setting?: 'home' | 'residential' | 'clinic'
  message?: Record<string, string> // i18n by locale
}

export type ConsentTypeDef = {
  code: string                     // 'health_data_processing'
  label: Record<string, string>   // { en, pl, de, es }
  lawfulBasis: LawfulBasis
  required: boolean
  appliesTo: string[]              // entityIds: ['opencare:care_episode', 'opencare:care_note']
}

export type RetentionAnchor = 'created_at' | 'episode_ended_at' | 'granted_at'
export type RetentionAction = 'soft_delete' | 'anonymize'  // NEVER hard_delete

export type RetentionRule = {
  entityId: string
  setting?: string
  retentionDays: number            // engineering placeholder; counsel sign-off required
  anchor: RetentionAnchor
  action: RetentionAction
  legalRef?: string
}

export type EncryptionRequirement = {
  entityId: string
  field: string
  hashField?: string               // for searchable PII
  hashContext?: string             // STABLE shared context string
}

export type ValidationRule = {
  entityId: string
  field: string
  id: string                       // 'pl.pesel.valid'
  validate: (value: unknown, record: Record<string, unknown>) => boolean
  message: Record<string, string>
}

export type AuditObligation = {
  entityId: string
  auditMutations?: boolean         // create/update/delete -> actionLogService
  logAccess?: ('read' | 'export')[] // -> accessLogService via enricher
}

export type JurisdictionPack = {
  id: string                       // 'eu-gdpr'
  extends?: string                 // 'eu-gdpr'
  priority: number                 // higher wins on conflict
  featureToggleId: string          // 'compliance.eu-gdpr.enabled'
  requiredFields: RequiredFieldRule[]
  consentTypes: ConsentTypeDef[]
  retention: RetentionRule[]
  encryption: EncryptionRequirement[]
  validations: ValidationRule[]
  audit: AuditObligation[]
}
```

### 3.2 Registry — `compliance_kit/lib/registry.ts`
Import-time registration, mirroring core `registerCommand`.
```ts
const PACKS = new Map<string, JurisdictionPack>()
export function registerJurisdictionPack(pack: JurisdictionPack) { PACKS.set(pack.id, pack) }
export function registerJurisdictionPacks(packs: JurisdictionPack[]) { packs.forEach(registerJurisdictionPack) }
export function getAllPacks(): JurisdictionPack[] { return [...PACKS.values()] }
export function resolvePackChain(id: string): JurisdictionPack[] { /* flatten extends, leaf-last */ }
```

### 3.3 Explicit merge (unit-tested) — `compliance_kit/lib/merge.ts`
`getMergedRules(activePacks)` flattens `extends` chains and resolves conflicts by `priority` (child/higher wins), keyed by:
- requiredFields/validations/encryption: `entityId + field`
- consentTypes: `code`
- retention: `entityId + (setting ?? '')`

Precedence is EXPLICIT and covered by `compliance_kit/__tests__/merge.test.ts` (addresses the "undefined merge order" risk).

### 3.4 DI service — `compliance_kit/di.ts`
```ts
import { asClass } from 'awilix'
export function register(container) {
  container.register({ complianceKitService: asClass(ComplianceKitService).scoped() })
}
```
`ComplianceKitService` depends on `featureTogglesService`:
- `getActivePacks(tenantId)`: for each registered pack, `featureTogglesService.getBoolConfig(pack.featureToggleId, tenantId)`; include if `ok && value`. 5-min in-service cache.
- `getMergedRules(tenantId)` -> merged contract for active packs (+ their `extends` parents).
- `getActiveConsents(em, recipientId, tenantId, orgId)` -> active-consent check query.

### 3.5 GeneratorPlugin discovery — `compliance_kit/generators.ts`
**`import type` only** (CLI executes this at generation time — verified gotcha).
- `compliance.packs`: convention file `compliance.pack.ts`, default export `JurisdictionPack`, `bootstrapRegistration.buildCall -> registerJurisdictionPacks(...)`. This is what makes a third-party country pack truly drop-in.
- `compliance.encryptionMaps`: aggregates each pack module's `encryption.ts` (`defaultEncryptionMaps: ModuleEncryptionMap[]`) into the global union, so encrypted fields are declared statically/globally and gated per-tenant by the `TENANT_DATA_ENCRYPTION` toggle + per-tenant DEK.

### 3.6 The five mapped surfaces
1. **Required fields + validations -> ONE `MutationGuard`** `compliance_kit/api/guards.ts`, `targetEntity:'opencare.*'`, `operations:['create','update']`. Loads `getMergedRules`, checks required-field presence, runs `validate` fns; returns `{ ok:false, status:422, message }` on failure. Packs contribute DATA, not guards — no per-jurisdiction guard wiring/ordering. **Anti-bypass hardening:** also call the same validation helper inside the create COMMAND and the bulk-import path, not just the CRUD route.
2. **Consent -> first-class `consent_records` + same guard.** Guard rejects mutations on an entity that needs a `required:true, lawfulBasis:'consent'` consent (per `appliesTo`) when no active consent exists. `setup.ts seedDefaults` upserts each active pack's consent types per tenant.
3. **Retention -> `business_rules` + scheduled sweep.** `seedDefaults` writes one `business_rules` rule per merged `RetentionRule`. `compliance_kit/workers/retention-sweep.ts` (via `packages/scheduler`) runs nightly per tenant calling `executeRules`. **Mandatory safeguards:** dry-run review before enable; `soft_delete`/`anonymize` only; NEVER hard-delete under legal hold; an erasure guard refuses deletion while statutory retention is active (Polish lex specialis overrides GDPR erasure).
4. **Encryption -> generator-aggregated `defaultEncryptionMaps`** (union of pack fields). All reads use `findWithDecryption`/`findOneWithDecryption`. PII uses `hashForLookup` with the STABLE shared context. Audit-log snapshots must encrypt any pack-required PII (else it leaks into action-log snapshots in plaintext).
5. **Audit -> persistent wildcard subscriber + read enricher.** `compliance_kit/subscribers/audit-care-mutations.ts` (`persistent:true`, `opencare.*.created|updated|deleted`) writes to core `actionLogService` only when an active pack sets `auditMutations`. Keep handler minimal / enqueue heavy work (hot-path gotcha). `compliance_kit/data/enrichers.ts` `ResponseEnricher` on `opencare:care_recipient` / `opencare:care_note` fires `accessLogService.log({ accessType:'read' })` for `read`/`export` obligations. Note: access-log default 8h retention is NOT the medical record store — the care entities + soft-delete/anonymize sweeper are.

### 3.7 Per-tenant enablement — `compliance_kit/setup.ts`
- `seedDefaults`: seed toggles `compliance.eu-gdpr.enabled` (baseline, default true) and `compliance.pl-rodo.enabled` (default false); upsert active packs' consent types + retention business-rules per tenant.
- `defaultRoleFeatures`: `compliance_kit.audit.view` -> auditor; `compliance_kit.manage` -> admin.
- Post-deploy: `yarn mercato auth sync-role-acls` (existing tenants don't auto-receive features).
- Hard legal switch: accept 1-min toggle cache window, or `OM_FEATURE_TOGGLES_CACHE_DISABLED=1`. Enabling a pack is forward-looking only — ship a one-off re-encryption + retention backfill worker.
- Apps can disable a single pack contribution via `entry.overrides` (e.g. `enrichers: { 'compliance.rodo.read-audit': null }`) without forking the pack.

---

## 4. Reference Plugins

### 4.1 `compliance_eu_gdpr` (baseline) — `compliance.pack.ts`
```ts
const pack: JurisdictionPack = {
  id: 'eu-gdpr', priority: 100, featureToggleId: 'compliance.eu-gdpr.enabled',
  requiredFields: [
    { entityId: 'opencare:care_recipient', field: 'gdpr_legal_basis',
      message: { en: 'Legal basis for processing is required', pl: 'Wymagana podstawa prawna przetwarzania',
                 de: 'Rechtsgrundlage erforderlich', es: 'Base juridica requerida' } },
  ],
  consentTypes: [
    { code: 'data_processing', required: true, lawfulBasis: 'consent',
      appliesTo: ['opencare:care_recipient'],
      label: { en: 'Personal data processing', pl: 'Przetwarzanie danych osobowych',
               de: 'Verarbeitung personenbezogener Daten', es: 'Tratamiento de datos personales' } },
    { code: 'health_data_processing', required: true, lawfulBasis: 'consent',  // Art.9 explicit
      appliesTo: ['opencare:care_episode', 'opencare:care_note'],
      label: { en: 'Health data processing (Art. 9)', pl: 'Przetwarzanie danych o zdrowiu (art. 9)',
               de: 'Verarbeitung von Gesundheitsdaten (Art. 9)', es: 'Tratamiento de datos de salud (art. 9)' } },
    { code: 'marketing', required: false, lawfulBasis: 'consent', appliesTo: ['opencare:care_recipient'],
      label: { en: 'Marketing communications', pl: 'Komunikacja marketingowa',
               de: 'Marketingkommunikation', es: 'Comunicaciones de marketing' } },
  ],
  retention: [
    // GDPR storage limitation baseline; jurisdictions override with statutory minimums
    { entityId: 'opencare:care_note', retentionDays: 2555, anchor: 'episode_ended_at',
      action: 'soft_delete', legalRef: 'GDPR Art. 5(1)(e) storage limitation (baseline ~7y)' },
  ],
  encryption: [
    { entityId: 'opencare:care_recipient', field: 'national_id', hashField: 'national_id_hash', hashContext: 'opencare.care_recipient.national_id' },
    { entityId: 'opencare:care_recipient', field: 'primary_email', hashField: 'primary_email_hash', hashContext: 'opencare.care_recipient.primary_email' },
    { entityId: 'opencare:care_recipient', field: 'phone', hashField: 'phone_hash', hashContext: 'opencare.care_recipient.phone' },
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
export default pack
```
Ships `encryption.ts` (`defaultEncryptionMaps` translating the `encryption[]` above into `ModuleEncryptionMap[]`) + `i18n/{en,de,es,pl}.json`.

### 4.2 `compliance_pl_rodo` (`extends: eu-gdpr`, higher priority) — `compliance.pack.ts`
```ts
const pack: JurisdictionPack = {
  id: 'pl-rodo', extends: 'eu-gdpr', priority: 200, featureToggleId: 'compliance.pl-rodo.enabled',
  requiredFields: [
    { entityId: 'opencare:care_recipient', field: 'national_id',  // PESEL required in PL
      message: { en: 'PESEL is required', pl: 'PESEL jest wymagany',
                 de: 'PESEL erforderlich', es: 'PESEL requerido' } },
  ],
  consentTypes: [
    { code: 'medical_record_access', required: true, lawfulBasis: 'legal_obligation',
      appliesTo: ['opencare:care_note', 'opencare:care_document'],
      label: { en: 'Medical record access', pl: 'Dostep do dokumentacji medycznej',
               de: 'Zugriff auf Patientenakte', es: 'Acceso al historial medico' } },
  ],
  retention: [
    // Ustawa o prawach pacjenta i Rzeczniku Praw Pacjenta, art. 29 — ENGINEERING PLACEHOLDERS, counsel sign-off required
    { entityId: 'opencare:care_note',    retentionDays: 7305,  anchor: 'episode_ended_at', action: 'soft_delete', legalRef: 'Ustawa o prawach pacjenta art. 29 ust. 1 — 20 lat' },
    { entityId: 'opencare:care_episode', retentionDays: 7305,  anchor: 'episode_ended_at', action: 'soft_delete', legalRef: 'art. 29 ust. 1 — 20 lat' },
    // 30 lat (10957d): zgon wskutek uszkodzenia ciala / zatrucia — handled by a setting/flag variant
    // dzieci do 22. roku zycia; zdjecia RTG / skierowania 10 lat (3653d) — add as data when counsel confirms
  ],
  encryption: [],  // inherits baseline encryption maps via extends
  validations: [
    { entityId: 'opencare:care_recipient', field: 'national_id', id: 'pl.pesel.valid',
      validate: (v) => isValidPesel(String(v ?? '')),  // weighted checksum 1,3,7,9,1,3,7,9,1,3
      message: { en: 'Invalid PESEL checksum', pl: 'Nieprawidlowa suma kontrolna PESEL',
                 de: 'Ungueltige PESEL-Pruefsumme', es: 'Suma de control PESEL invalida' } },
  ],
  audit: [
    { entityId: 'opencare:care_note', auditMutations: true, logAccess: ['read', 'export'] },  // stronger read logging
  ],
}
export default pack
```
Ships ONLY `compliance.pack.ts` + `encryption.ts` (empty/inherited) + `i18n/pl.json` — proving a third party could ship `compliance_de_bdsg` identically. **Day-counts are placeholders requiring Polish counsel sign-off; encoded as data so corrections are config, not redeploy.**

PESEL checksum helper lives in `compliance_pl_rodo/lib/pesel.ts`.

### 4.3 PL i18n strings (`compliance_pl_rodo/i18n/pl.json` excerpt)
```json
{
  "compliance.pl_rodo.pack.label": "Polska (RODO)",
  "compliance.consent.medical_record_access": "Dostep do dokumentacji medycznej",
  "compliance.field.national_id.required": "PESEL jest wymagany",
  "compliance.validation.pesel.invalid": "Nieprawidlowa suma kontrolna PESEL",
  "compliance.retention.note.20y": "Dokumentacja medyczna przechowywana 20 lat (art. 29 ustawy o prawach pacjenta)"
}
```
opencare admin screens get full `pl.json` per the CrudForm i18n recipe (table columns, form fields, groups, flash messages) — keys like `opencare.care_recipients.form.fields.national_id.label` = `"PESEL"`.

---

## 5. ORDERED Incremental Implementation Checklist

> Principle: Phase 1 is the **smallest vertical slice that builds, migrates, and renders**. Every later phase is additive. Run the listed `yarn` commands from `apps/mercato` after each step. Never leave the tree non-building.

### PHASE 1 — One real table + admin screen (no compliance yet)
Goal: `care_recipients` end-to-end. Proves the spine.
1. Add `{ id: 'opencare', from: '@app' }` to `apps/mercato/src/modules.ts`.
2. Create `opencare/index.ts`, `opencare/acl.ts` (`opencare.care_recipients.view|manage`), `opencare/data/entities.ts` (just `CareRecipient`), `opencare/data/validators.ts`.
3. Create `opencare/commands/care_recipients.ts` (create/update/delete, `registerCommand`, `isUndoable:true`) and import it in `index.ts`.
4. Create `opencare/api/care_recipients/route.ts` via `makeCrudRoute` (events `{module:'opencare',entity:'care_recipient',persistent:true}`, `indexer:{entityType:'opencare:care_recipient'}`).
5. Create backend pages: `backend/care_recipients/page.tsx` + `page.meta.ts`, `components/CareRecipientsTable.tsx`, `backend/care_recipients/create/page.tsx` (+meta), `backend/care_recipients/[id]/edit/page.tsx` (+meta).
6. Create `i18n/{en,pl,de,es}.json`.
```bash
yarn generate
yarn db:generate     # produces Migration<ts>_opencare.ts + snapshot
yarn typecheck
yarn db:migrate      # local
```
**Verify:** start app, navigate `/backend/care_recipients`, create/edit/delete a recipient; confirm row in `care_recipients`; confirm undo works from action log.

### PHASE 2 — Rest of the care domain
1. Add `CareSetting`, `CareEpisode`, `CareNote`, `CareDocument`, `ConsentRecord` to `data/entities.ts` (+ validators, commands, routes, admin screens, i18n) following Phase 1 pattern.
2. Add composite indexes incl. consent active-check index.
```bash
yarn generate && yarn db:generate && yarn typecheck && yarn db:migrate
```
**Verify:** create a setting -> episode -> note -> consent record chain via UI; FK-id fields resolve; soft-delete hides rows.

### PHASE 3 — compliance_kit framework skeleton (inert)
1. Add `{ id:'compliance_kit', from:'@app' }` to `modules.ts`.
2. Create `compliance_kit/lib/contract.ts`, `lib/registry.ts`, `lib/merge.ts` + `__tests__/merge.test.ts`, `di.ts` (`complianceKitService`), `acl.ts`, `setup.ts` (toggles seed only), `generators.ts` (`import type` only).
```bash
yarn generate && yarn typecheck && yarn test compliance_kit
```
**Verify:** merge unit tests pass; app still boots; no behavioral change yet.

### PHASE 4 — eu-gdpr pack (data-only) + encryption aggregation
1. Add `{ id:'compliance_eu_gdpr', from:'@app' }`.
2. Create `compliance_eu_gdpr/compliance.pack.ts`, `encryption.ts`, `i18n/*`, `index.ts`.
3. Wire `compliance_kit/generators.ts` `compliance.packs` + `compliance.encryptionMaps`.
```bash
yarn generate && yarn db:generate && yarn typecheck   # db:generate only if hash columns added
```
**Verify:** generated `compliance-packs.generated.ts` includes eu-gdpr; with `TENANT_DATA_ENCRYPTION` on, new care_notes persist ciphertext; reads via `findWithDecryption` return plaintext.

### PHASE 5 — The shared guard + command/bulk anti-bypass
1. Create `compliance_kit/api/guards.ts` (required-field + validation + consent guard, `targetEntity:'opencare.*'`).
2. Call the same validation helper inside opencare create commands + any bulk-import path.
```bash
yarn generate && yarn typecheck
```
**Verify:** with eu-gdpr enabled, creating a recipient without `gdpr_legal_basis` returns 422 via UI AND via direct command/bulk import; with valid data, succeeds.

### PHASE 6 — Audit subscriber + access enricher
1. Create `compliance_kit/subscribers/audit-care-mutations.ts` (`persistent:true`, wildcard `opencare.*`).
2. Create `compliance_kit/data/enrichers.ts` read/export access logging.
```bash
yarn generate && yarn typecheck
```
**Verify:** mutating a note writes an `action_log` row (encrypted snapshot); listing/viewing a recipient writes an `access_log` row.

### PHASE 7 — Retention (business_rules + nightly sweep, dry-run first)
1. `setup.ts seedDefaults` writes one business rule per merged RetentionRule.
2. Create `compliance_kit/workers/retention-sweep.ts` (scheduler), default DRY-RUN; erasure-guard refusing deletion under active statutory retention.
```bash
yarn generate && yarn typecheck && yarn db:migrate
```
**Verify:** run sweep in dry-run; inspect rule-execution logs; flip a single rule to live and confirm only `soft_delete`/`anonymize`, never hard delete, never under legal hold.

### PHASE 8 — pl-rodo pack (proves drop-in)
1. Add `{ id:'compliance_pl_rodo', from:'@app' }`.
2. Create `compliance_pl_rodo/compliance.pack.ts`, `encryption.ts`, `lib/pesel.ts`, `i18n/pl.json`, `index.ts`.
```bash
yarn generate && yarn typecheck
```
**Verify:** enable `compliance.pl-rodo.enabled` for a tenant; PESEL now required + checksum-validated; merged retention shows 20y (7305d) overriding the GDPR baseline; same `national_id` hash context preserves dedupe across activation.

### PHASE 9 — Roles + production rollout
```bash
yarn typecheck
# deploy, then:
yarn mercato auth sync-role-acls
# optional hard switch:  OM_FEATURE_TOGGLES_CACHE_DISABLED=1
```
**Verify:** auditor sees audit views; admin can flip jurisdiction toggles; run the one-off re-encryption + retention backfill worker for pre-existing data.

---

## 6. Directory Tree (files to create under `apps/mercato/src/modules/`)

```
apps/mercato/src/modules/
├── opencare/
│   ├── index.ts                                  # imports command files
│   ├── acl.ts
│   ├── di.ts
│   ├── setup.ts
│   ├── events.ts
│   ├── encryption.ts                             # base care encryption map (union also via packs)
│   ├── data/
│   │   ├── entities.ts                           # CareRecipient, CareSetting, CareEpisode, CareNote, CareDocument, ConsentRecord
│   │   └── validators.ts                         # Zod create/update per entity
│   ├── commands/
│   │   ├── care_recipients.ts
│   │   ├── care_settings.ts
│   │   ├── care_episodes.ts
│   │   ├── care_notes.ts
│   │   ├── care_documents.ts
│   │   └── consent_records.ts
│   ├── api/
│   │   ├── care_recipients/route.ts
│   │   ├── care_settings/route.ts
│   │   ├── care_episodes/route.ts
│   │   ├── care_notes/route.ts
│   │   ├── care_documents/route.ts
│   │   └── consent_records/route.ts
│   ├── components/
│   │   ├── CareRecipientsTable.tsx
│   │   ├── CareSettingsTable.tsx
│   │   ├── CareEpisodesTable.tsx
│   │   ├── CareNotesTable.tsx
│   │   ├── CareDocumentsTable.tsx
│   │   └── ConsentRecordsTable.tsx
│   ├── backend/
│   │   ├── care_recipients/{page.tsx,page.meta.ts,create/{page.tsx,page.meta.ts},[id]/edit/{page.tsx,page.meta.ts}}
│   │   ├── care_settings/{...same shape...}
│   │   ├── care_episodes/{...}
│   │   ├── care_notes/{...}
│   │   ├── care_documents/{...}
│   │   └── consent_records/{...}
│   ├── i18n/{en.json,pl.json,de.json,es.json}
│   └── migrations/                               # auto-generated (do not hand-edit snapshot)
│
├── compliance_kit/
│   ├── index.ts
│   ├── acl.ts                                    # compliance_kit.manage, compliance_kit.audit.view
│   ├── di.ts                                     # complianceKitService (scoped)
│   ├── setup.ts                                  # toggles seed, consent seed, retention rules, defaultRoleFeatures
│   ├── generators.ts                             # import type ONLY: compliance.packs + compliance.encryptionMaps
│   ├── lib/
│   │   ├── contract.ts                           # JurisdictionPack + all rule types
│   │   ├── registry.ts                           # registerJurisdictionPack(s), resolvePackChain
│   │   ├── merge.ts                              # explicit priority merge
│   │   └── compliance-kit-service.ts             # getActivePacks/getMergedRules/getActiveConsents
│   ├── api/
│   │   └── guards.ts                             # ONE MutationGuard for opencare.* (required+validate+consent)
│   ├── subscribers/
│   │   └── audit-care-mutations.ts               # persistent wildcard opencare.*
│   ├── data/
│   │   └── enrichers.ts                          # read/export access logging ResponseEnricher
│   ├── workers/
│   │   └── retention-sweep.ts                    # nightly executeRules per tenant (dry-run default)
│   └── __tests__/
│       └── merge.test.ts
│
├── compliance_eu_gdpr/
│   ├── index.ts
│   ├── compliance.pack.ts                        # default export JurisdictionPack 'eu-gdpr'
│   ├── encryption.ts                             # defaultEncryptionMaps
│   └── i18n/{en.json,pl.json,de.json,es.json}
│
└── compliance_pl_rodo/
    ├── index.ts
    ├── compliance.pack.ts                        # default export JurisdictionPack 'pl-rodo' extends eu-gdpr
    ├── encryption.ts                             # inherited/empty
    ├── lib/pesel.ts                              # checksum validator
    └── i18n/pl.json
```

Plus one edit to `apps/mercato/src/modules.ts` (the four module entries). `bootstrap.ts` is unchanged.
