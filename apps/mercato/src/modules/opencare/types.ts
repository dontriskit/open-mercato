// Shared UI/API types for the OpenCare module

// Item shape returned by the care_recipients list API (via CRUD factory transform)
export type CareRecipientListItem = {
  id: string
  display_name: string
  national_id?: string | null
  primary_email?: string | null
  phone?: string | null
  date_of_birth?: string | null
  gdpr_legal_basis?: string | null
  tenant_id?: string | null
  organization_id?: string | null
}
