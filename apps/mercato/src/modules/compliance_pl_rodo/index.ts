import type { ModuleInfo } from '@open-mercato/shared/modules/registry'

export const metadata: ModuleInfo = {
  name: 'compliance_pl_rodo',
  title: 'Compliance — Poland (RODO)',
  version: '0.1.0',
  description:
    'Polish RODO jurisdiction pack (data-only, extends eu-gdpr): PESEL required field + checksum validation and statutory medical-record retention overrides consumed by compliance_kit.',
  author: 'dontriskit',
  license: 'MIT',
}
