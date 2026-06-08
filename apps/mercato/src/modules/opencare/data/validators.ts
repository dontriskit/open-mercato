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
