import type { ModuleInfo } from '@open-mercato/shared/modules/registry'

export const metadata: ModuleInfo = {
  name: 'compliance_kit',
  title: 'Compliance Kit',
  version: '0.1.0',
  description:
    'Jurisdiction-as-data compliance framework: pack registry, typed contract, priority merge, and DI service. Inert until packs + guards are wired.',
  author: 'dontriskit',
  license: 'MIT',
}

export { features } from './acl'
