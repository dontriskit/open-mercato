import type { JurisdictionPack } from '@/modules/compliance_kit/lib/contract'
import { isValidPesel } from './lib/pesel'

// Polish RODO jurisdiction pack — OPENCARE_PLAN.md §4.2.
// Data-only, extends the eu-gdpr baseline (priority 200 → child wins on conflict).
// Proves a third-party country pack is a pure drop-in: no new tables, no guard,
// no core edits — only data consumed by the compliance_kit framework.
//
// NOTE: retentionDays values are ENGINEERING PLACEHOLDERS pending Polish counsel
// sign-off. They are encoded as data (with legalRef strings) so corrections are
// config, not redeploy.
const pack: JurisdictionPack = {
  id: 'pl-rodo',
  extends: 'eu-gdpr',
  priority: 200,
  featureToggleId: 'compliance.pl-rodo.enabled',
  requiredFields: [
    {
      entityId: 'opencare:care_recipient',
      field: 'national_id', // PESEL required in PL
      message: {
        en: 'PESEL is required',
        pl: 'PESEL jest wymagany',
        de: 'PESEL erforderlich',
        es: 'PESEL requerido',
      },
    },
  ],
  consentTypes: [
    {
      code: 'medical_record_access',
      required: true,
      lawfulBasis: 'legal_obligation',
      appliesTo: ['opencare:care_note', 'opencare:care_document'],
      label: {
        en: 'Medical record access',
        pl: 'Dostep do dokumentacji medycznej',
        de: 'Zugriff auf Patientenakte',
        es: 'Acceso al historial medico',
      },
    },
  ],
  retention: [
    // Ustawa o prawach pacjenta i Rzeczniku Praw Pacjenta, art. 29 ust. 1 — 20 lat.
    // ENGINEERING PLACEHOLDERS, counsel sign-off required.
    {
      entityId: 'opencare:care_note',
      retentionDays: 7305,
      anchor: 'episode_ended_at',
      action: 'soft_delete',
      legalRef: 'Ustawa o prawach pacjenta art. 29 ust. 1 — 20 lat',
    },
    {
      entityId: 'opencare:care_episode',
      retentionDays: 7305,
      anchor: 'episode_ended_at',
      action: 'soft_delete',
      legalRef: 'Ustawa o prawach pacjenta art. 29 ust. 1 — 20 lat',
    },
    // 30 lat (10957d): zgon wskutek uszkodzenia ciala / zatrucia — setting/flag variant.
    // dzieci do 22. roku zycia; zdjecia RTG / skierowania 10 lat (3653d) — add as data
    // when counsel confirms.
  ],
  encryption: [], // inherits baseline encryption maps via extends
  validations: [
    {
      entityId: 'opencare:care_recipient',
      field: 'national_id',
      id: 'pl.pesel.valid',
      validate: (v) => isValidPesel(String(v ?? '')), // weighted checksum 1,3,7,9,1,3,7,9,1,3
      message: {
        en: 'Invalid PESEL checksum',
        pl: 'Nieprawidlowa suma kontrolna PESEL',
        de: 'Ungueltige PESEL-Pruefsumme',
        es: 'Suma de control PESEL invalida',
      },
    },
  ],
  audit: [
    // Stronger read logging for clinical notes under Polish medical-record rules.
    { entityId: 'opencare:care_note', auditMutations: true, logAccess: ['read', 'export'] },
  ],
}

export { pack }
export default pack
