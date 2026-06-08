import { createModuleEvents } from '@open-mercato/shared/modules/events'

/**
 * OpenCare Module Events
 */
const events = [
  { id: 'opencare.care_recipient.created', label: 'Care Recipient Created', entity: 'care_recipient', category: 'crud', clientBroadcast: true },
  { id: 'opencare.care_recipient.updated', label: 'Care Recipient Updated', entity: 'care_recipient', category: 'crud', clientBroadcast: true },
  { id: 'opencare.care_recipient.deleted', label: 'Care Recipient Deleted', entity: 'care_recipient', category: 'crud', clientBroadcast: true },
] as const

export const eventsConfig = createModuleEvents({
  moduleId: 'opencare',
  events,
})

export const emitOpenCareEvent = eventsConfig.emit

export type OpenCareEventId = typeof events[number]['id']

export default eventsConfig
