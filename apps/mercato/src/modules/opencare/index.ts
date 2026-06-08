import './commands/care_recipients'
import type { ModuleInfo } from '@open-mercato/shared/modules/registry'

export const metadata: ModuleInfo = {
  name: 'opencare',
  title: 'OpenCare',
  version: '0.1.0',
  description: 'Care-provider tailoring on top of Open Mercato (patients, care plans, scheduling).',
  author: 'dontriskit',
  license: 'MIT',
}
