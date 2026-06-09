export const features = [
  { id: 'opencare.backend', title: 'Access OpenCare backend', module: 'opencare' },
  { id: 'opencare.care_recipients.view', title: 'View care recipients', module: 'opencare' },
  {
    id: 'opencare.care_recipients.manage',
    title: 'Manage care recipients',
    module: 'opencare',
    dependsOn: ['opencare.care_recipients.view'],
  },
  { id: 'opencare.care_settings.view', title: 'View care settings', module: 'opencare' },
  { id: 'opencare.care_settings.manage', title: 'Manage care settings', module: 'opencare', dependsOn: ['opencare.care_settings.view'] },
  { id: 'opencare.care_episodes.view', title: 'View care episodes', module: 'opencare' },
  { id: 'opencare.care_episodes.manage', title: 'Manage care episodes', module: 'opencare', dependsOn: ['opencare.care_episodes.view'] },
  { id: 'opencare.care_notes.view', title: 'View care notes', module: 'opencare' },
  { id: 'opencare.care_notes.manage', title: 'Manage care notes', module: 'opencare', dependsOn: ['opencare.care_notes.view'] },
  { id: 'opencare.care_documents.view', title: 'View care documents', module: 'opencare' },
  { id: 'opencare.care_documents.manage', title: 'Manage care documents', module: 'opencare', dependsOn: ['opencare.care_documents.view'] },
  { id: 'opencare.consent_records.view', title: 'View consent records', module: 'opencare' },
  { id: 'opencare.consent_records.manage', title: 'Manage consent records', module: 'opencare', dependsOn: ['opencare.consent_records.view'] },
]

export default features
