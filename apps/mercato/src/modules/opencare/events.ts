import { createModuleEvents } from '@open-mercato/shared/modules/events'

/**
 * OpenCare Module Events
 */
const events = [
  { id: 'opencare.care_recipient.created', label: 'Care Recipient Created', entity: 'care_recipient', category: 'crud', clientBroadcast: true },
  { id: 'opencare.care_recipient.updated', label: 'Care Recipient Updated', entity: 'care_recipient', category: 'crud', clientBroadcast: true },
  { id: 'opencare.care_recipient.deleted', label: 'Care Recipient Deleted', entity: 'care_recipient', category: 'crud', clientBroadcast: true },
  { id: 'opencare.care_setting.created', label: 'Care Setting Created', entity: 'care_setting', category: 'crud', clientBroadcast: true },
  { id: 'opencare.care_setting.updated', label: 'Care Setting Updated', entity: 'care_setting', category: 'crud', clientBroadcast: true },
  { id: 'opencare.care_setting.deleted', label: 'Care Setting Deleted', entity: 'care_setting', category: 'crud', clientBroadcast: true },
  { id: 'opencare.care_episode.created', label: 'Care Episode Created', entity: 'care_episode', category: 'crud', clientBroadcast: true },
  { id: 'opencare.care_episode.updated', label: 'Care Episode Updated', entity: 'care_episode', category: 'crud', clientBroadcast: true },
  { id: 'opencare.care_episode.deleted', label: 'Care Episode Deleted', entity: 'care_episode', category: 'crud', clientBroadcast: true },
  { id: 'opencare.care_note.created', label: 'Care Note Created', entity: 'care_note', category: 'crud', clientBroadcast: true },
  { id: 'opencare.care_note.updated', label: 'Care Note Updated', entity: 'care_note', category: 'crud', clientBroadcast: true },
  { id: 'opencare.care_note.deleted', label: 'Care Note Deleted', entity: 'care_note', category: 'crud', clientBroadcast: true },
  { id: 'opencare.care_document.created', label: 'Care Document Created', entity: 'care_document', category: 'crud', clientBroadcast: true },
  { id: 'opencare.care_document.updated', label: 'Care Document Updated', entity: 'care_document', category: 'crud', clientBroadcast: true },
  { id: 'opencare.care_document.deleted', label: 'Care Document Deleted', entity: 'care_document', category: 'crud', clientBroadcast: true },
  { id: 'opencare.consent_record.created', label: 'Consent Record Created', entity: 'consent_record', category: 'crud', clientBroadcast: true },
  { id: 'opencare.consent_record.updated', label: 'Consent Record Updated', entity: 'consent_record', category: 'crud', clientBroadcast: true },
  { id: 'opencare.consent_record.deleted', label: 'Consent Record Deleted', entity: 'consent_record', category: 'crud', clientBroadcast: true },
] as const

export const eventsConfig = createModuleEvents({
  moduleId: 'opencare',
  events,
})

export const emitOpenCareEvent = eventsConfig.emit

export type OpenCareEventId = typeof events[number]['id']

export default eventsConfig
