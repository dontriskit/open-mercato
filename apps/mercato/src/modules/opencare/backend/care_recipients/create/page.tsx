"use client"
import * as React from 'react'
import { Page, PageBody } from '@open-mercato/ui/backend/Page'
import { CrudForm, type CrudField, type CrudFormGroup } from '@open-mercato/ui/backend/CrudForm'
import { createCrud } from '@open-mercato/ui/backend/utils/crud'
import { useT } from '@open-mercato/shared/lib/i18n/context'

export default function CreateCareRecipientPage() {
  const t = useT()
  const fields = React.useMemo<CrudField[]>(() => [
    { id: 'display_name', label: t('opencare.care_recipients.form.fields.display_name.label'), type: 'text', required: true },
    { id: 'national_id', label: t('opencare.care_recipients.form.fields.national_id.label'), type: 'text' },
    { id: 'primary_email', label: t('opencare.care_recipients.form.fields.primary_email.label'), type: 'text' },
    { id: 'phone', label: t('opencare.care_recipients.form.fields.phone.label'), type: 'text' },
    { id: 'date_of_birth', label: t('opencare.care_recipients.form.fields.date_of_birth.label'), type: 'text' },
    { id: 'gdpr_legal_basis', label: t('opencare.care_recipients.form.fields.gdpr_legal_basis.label'), type: 'text' },
  ], [t])
  const groups = React.useMemo<CrudFormGroup[]>(() => [
    { id: 'identity', title: t('opencare.care_recipients.form.groups.identity'), column: 1, fields: ['display_name', 'national_id', 'date_of_birth'] },
    { id: 'contact', title: t('opencare.care_recipients.form.groups.contact'), column: 2, fields: ['primary_email', 'phone', 'gdpr_legal_basis'] },
  ], [t])
  const successRedirect = React.useMemo(
    () => `/backend/care_recipients?flash=${encodeURIComponent(t('opencare.care_recipients.form.flash.created'))}&type=success`,
    [t],
  )

  return (
    <Page>
      <PageBody>
        <CrudForm
          title={t('opencare.care_recipients.form.create.title')}
          backHref="/backend/care_recipients"
          entityId="opencare:care_recipient"
          fields={fields}
          groups={groups}
          submitLabel={t('opencare.care_recipients.form.create.submit')}
          cancelHref="/backend/care_recipients"
          successRedirect={successRedirect}
          onSubmit={async (vals) => { await createCrud('opencare/care_recipients', vals) }}
        />
      </PageBody>
    </Page>
  )
}
