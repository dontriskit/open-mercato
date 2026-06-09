import type { ModuleSetupConfig } from '@open-mercato/shared/modules/setup'

// compliance_kit setup — OPENCARE_PLAN.md §3.7.
//
// Phase 3 is INERT: we only declare role-feature grants. Seeding the
// `compliance.eu-gdpr.enabled` / `compliance.pl-rodo.enabled` toggles and the
// per-tenant consent/retention rows is intentionally deferred to the phases
// that ship the actual packs (Phase 4+), so this module adds no behavior and
// no data until a jurisdiction pack exists to back those toggles.
//
// TODO(phase 4): in `seedDefaults`, upsert the pack feature toggles
// (eu-gdpr default true, pl-rodo default false) via the feature_toggles
// definition/seed API, plus the active packs' consent types + retention
// business-rules per tenant.
export const setup: ModuleSetupConfig = {
  defaultRoleFeatures: {
    superadmin: ['compliance_kit.*'],
    admin: ['compliance_kit.manage', 'compliance_kit.audit.view'],
    auditor: ['compliance_kit.audit.view'],
  },
}

export default setup
