import type { ModuleSetupConfig } from '@open-mercato/shared/modules/setup'

export const setup: ModuleSetupConfig = {
  defaultRoleFeatures: {
    superadmin: ['opencare.*'],
    admin: ['opencare.backend', 'opencare.care_recipients.view', 'opencare.care_recipients.manage'],
    employee: ['opencare.backend', 'opencare.care_recipients.view'],
  },
}

export default setup
