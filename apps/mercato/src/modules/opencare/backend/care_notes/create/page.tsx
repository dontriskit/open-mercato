"use client"
import * as React from 'react'
import { Page, PageBody } from '@open-mercato/ui/backend/Page'
import { CrudForm, type CrudField } from '@open-mercato/ui/backend/CrudForm'
import { createCrud } from '@open-mercato/ui/backend/utils/crud'
import { useT } from '@open-mercato/shared/lib/i18n/context'

export default function CreateCareNotePage() {
  const t = useT()
  const fields = React.useMemo<CrudField[]>(() => [
    { id: 'care_episode_id', label: t('opencare.care_notes.form.fields.care_episode_id.label'), type: 'text', required: true },
    { id: 'care_recipient_id', label: t('opencare.care_notes.form.fields.care_recipient_id.label'), type: 'text', required: true },
    { id: 'body', label: t('opencare.care_notes.form.fields.body.label'), type: 'textarea', required: true },
    { id: 'authored_by', label: t('opencare.care_notes.form.fields.authored_by.label'), type: 'text' },
  ], [t])
  const successRedirect = React.useMemo(
    () => `/backend/care_notes?flash=${encodeURIComponent(t('opencare.care_notes.form.flash.created'))}&type=success`,
    [t],
  )

  return (
    <Page>
      <PageBody>
        <CrudForm
          title={t('opencare.care_notes.form.create.title')}
          backHref="/backend/care_notes"
          entityId="opencare:care_note"
          fields={fields}
          submitLabel={t('opencare.care_notes.form.create.submit')}
          cancelHref="/backend/care_notes"
          successRedirect={successRedirect}
          onSubmit={async (vals) => { await createCrud('opencare/care_notes', vals) }}
        />
      </PageBody>
    </Page>
  )
}
