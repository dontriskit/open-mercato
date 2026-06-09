import type { ModuleSetupConfig } from '@open-mercato/shared/modules/setup'

export const setup: ModuleSetupConfig = {
  defaultRoleFeatures: {
    superadmin: ['opencare.*'],
    admin: [
      'opencare.backend',
      'opencare.care_recipients.view', 'opencare.care_recipients.manage',
      'opencare.care_settings.view', 'opencare.care_settings.manage',
      'opencare.care_episodes.view', 'opencare.care_episodes.manage',
      'opencare.care_notes.view', 'opencare.care_notes.manage',
      'opencare.care_documents.view', 'opencare.care_documents.manage',
      'opencare.consent_records.view', 'opencare.consent_records.manage',
    ],
    employee: [
      'opencare.backend',
      'opencare.care_recipients.view',
      'opencare.care_settings.view',
      'opencare.care_episodes.view',
      'opencare.care_notes.view',
      'opencare.care_documents.view',
      'opencare.consent_records.view',
    ],
  },
}

export default setup
