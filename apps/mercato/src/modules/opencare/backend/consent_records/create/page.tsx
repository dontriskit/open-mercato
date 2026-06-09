"use client"
import * as React from 'react'
import { Page, PageBody } from '@open-mercato/ui/backend/Page'
import { CrudForm, type CrudField, type CrudFormGroup } from '@open-mercato/ui/backend/CrudForm'
import { createCrud } from '@open-mercato/ui/backend/utils/crud'
import { useT } from '@open-mercato/shared/lib/i18n/context'

export default function CreateConsentRecordPage() {
  const t = useT()
  const fields = React.useMemo<CrudField[]>(() => [
    { id: 'care_recipient_id', label: t('opencare.consent_records.form.fields.care_recipient_id.label'), type: 'text', required: true },
    { id: 'consent_type', label: t('opencare.consent_records.form.fields.consent_type.label'), type: 'text', required: true },
    { id: 'lawful_basis', label: t('opencare.consent_records.form.fields.lawful_basis.label'), type: 'text', required: true },
    { id: 'jurisdiction', label: t('opencare.consent_records.form.fields.jurisdiction.label'), type: 'text', required: true },
    { id: 'granted', label: t('opencare.consent_records.form.fields.granted.label'), type: 'checkbox' },
    { id: 'granted_by', label: t('opencare.consent_records.form.fields.granted_by.label'), type: 'text' },
    { id: 'evidence_attachment_id', label: t('opencare.consent_records.form.fields.evidence_attachment_id.label'), type: 'text' },
    { id: 'granted_at', label: t('opencare.consent_records.form.fields.granted_at.label'), type: 'text' },
    { id: 'expires_at', label: t('opencare.consent_records.form.fields.expires_at.label'), type: 'text' },
    { id: 'revoked_at', label: t('opencare.consent_records.form.fields.revoked_at.label'), type: 'text' },
  ], [t])
  const groups = React.useMemo<CrudFormGroup[]>(() => [
    { id: 'consent', title: t('opencare.consent_records.form.groups.consent'), column: 1, fields: ['care_recipient_id', 'consent_type', 'lawful_basis', 'jurisdiction', 'granted'] },
    { id: 'evidence', title: t('opencare.consent_records.form.groups.evidence'), column: 2, fields: ['granted_by', 'evidence_attachment_id', 'granted_at', 'expires_at', 'revoked_at'] },
  ], [t])
  const successRedirect = React.useMemo(
    () => `/backend/consent_records?flash=${encodeURIComponent(t('opencare.consent_records.form.flash.created'))}&type=success`,
    [t],
  )

  return (
    <Page>
      <PageBody>
        <CrudForm
          title={t('opencare.consent_records.form.create.title')}
          backHref="/backend/consent_records"
          entityId="opencare:consent_record"
          fields={fields}
          groups={groups}
          submitLabel={t('opencare.consent_records.form.create.submit')}
          cancelHref="/backend/consent_records"
          successRedirect={successRedirect}
          onSubmit={async (vals) => { await createCrud('opencare/consent_records', vals) }}
        />
      </PageBody>
    </Page>
  )
}
