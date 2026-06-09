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

export type CareSettingListItem = {
  id: string
  name: string
  kind: string
  tenant_id?: string | null
  organization_id?: string | null
}

export type CareEpisodeListItem = {
  id: string
  care_recipient_id: string
  care_setting_id: string
  responsible_staff_id?: string | null
  started_at?: string | null
  ended_at?: string | null
  diagnosis_summary?: string | null
  tenant_id?: string | null
  organization_id?: string | null
}

export type CareNoteListItem = {
  id: string
  care_episode_id: string
  care_recipient_id: string
  body: string
  authored_by?: string | null
  tenant_id?: string | null
  organization_id?: string | null
}

export type CareDocumentListItem = {
  id: string
  care_recipient_id: string
  attachment_id: string
  title: string
  tenant_id?: string | null
  organization_id?: string | null
}

export type ConsentRecordListItem = {
  id: string
  care_recipient_id: string
  consent_type: string
  lawful_basis: string
  jurisdiction: string
  granted: boolean
  granted_by?: string | null
  evidence_attachment_id?: string | null
  granted_at?: string | null
  expires_at?: string | null
  revoked_at?: string | null
  tenant_id?: string | null
  organization_id?: string | null
}
