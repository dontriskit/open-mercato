import { z } from 'zod'

export const careRecipientCreateSchema = z.object({
  id: z.string().uuid().optional(),
  display_name: z.string().min(1).max(300),
  national_id: z.string().max(100).optional().nullable(),
  primary_email: z.string().email().max(300).optional().nullable().or(z.literal('')),
  phone: z.string().max(100).optional().nullable(),
  date_of_birth: z.string().optional().nullable(),
  gdpr_legal_basis: z.string().max(200).optional().nullable(),
})

export const careRecipientUpdateSchema = careRecipientCreateSchema.partial().extend({
  id: z.string().uuid(),
})

export type CareRecipientCreateInput = z.infer<typeof careRecipientCreateSchema>
export type CareRecipientUpdateInput = z.infer<typeof careRecipientUpdateSchema>

export const careSettingCreateSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(300),
  kind: z.enum(['home', 'residential', 'clinic']),
})
export const careSettingUpdateSchema = careSettingCreateSchema.partial().extend({
  id: z.string().uuid(),
})
export type CareSettingCreateInput = z.infer<typeof careSettingCreateSchema>
export type CareSettingUpdateInput = z.infer<typeof careSettingUpdateSchema>

export const careEpisodeCreateSchema = z.object({
  id: z.string().uuid().optional(),
  care_recipient_id: z.string().uuid(),
  care_setting_id: z.string().uuid(),
  responsible_staff_id: z.string().uuid().optional().nullable().or(z.literal('')),
  started_at: z.string().min(1),
  ended_at: z.string().optional().nullable().or(z.literal('')),
  diagnosis_summary: z.string().optional().nullable(),
})
export const careEpisodeUpdateSchema = careEpisodeCreateSchema.partial().extend({
  id: z.string().uuid(),
})
export type CareEpisodeCreateInput = z.infer<typeof careEpisodeCreateSchema>
export type CareEpisodeUpdateInput = z.infer<typeof careEpisodeUpdateSchema>

export const careNoteCreateSchema = z.object({
  id: z.string().uuid().optional(),
  care_episode_id: z.string().uuid(),
  care_recipient_id: z.string().uuid(),
  body: z.string().min(1),
  authored_by: z.string().uuid().optional().nullable().or(z.literal('')),
})
export const careNoteUpdateSchema = careNoteCreateSchema.partial().extend({
  id: z.string().uuid(),
})
export type CareNoteCreateInput = z.infer<typeof careNoteCreateSchema>
export type CareNoteUpdateInput = z.infer<typeof careNoteUpdateSchema>

export const careDocumentCreateSchema = z.object({
  id: z.string().uuid().optional(),
  care_recipient_id: z.string().uuid(),
  attachment_id: z.string().uuid(),
  title: z.string().min(1).max(300),
})
export const careDocumentUpdateSchema = careDocumentCreateSchema.partial().extend({
  id: z.string().uuid(),
})
export type CareDocumentCreateInput = z.infer<typeof careDocumentCreateSchema>
export type CareDocumentUpdateInput = z.infer<typeof careDocumentUpdateSchema>

export const consentRecordCreateSchema = z.object({
  id: z.string().uuid().optional(),
  care_recipient_id: z.string().uuid(),
  consent_type: z.string().min(1).max(200),
  lawful_basis: z.string().min(1).max(200),
  jurisdiction: z.string().min(1).max(200),
  granted: z.coerce.boolean().optional().default(false),
  granted_by: z.string().uuid().optional().nullable().or(z.literal('')),
  evidence_attachment_id: z.string().uuid().optional().nullable().or(z.literal('')),
  granted_at: z.string().optional().nullable().or(z.literal('')),
  expires_at: z.string().optional().nullable().or(z.literal('')),
  revoked_at: z.string().optional().nullable().or(z.literal('')),
})
export const consentRecordUpdateSchema = consentRecordCreateSchema.partial().extend({
  id: z.string().uuid(),
})
export type ConsentRecordCreateInput = z.infer<typeof consentRecordCreateSchema>
export type ConsentRecordUpdateInput = z.infer<typeof consentRecordUpdateSchema>
