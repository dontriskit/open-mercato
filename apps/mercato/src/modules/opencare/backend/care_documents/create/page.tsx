"use client"
import * as React from 'react'
import { Page, PageBody } from '@open-mercato/ui/backend/Page'
import { CrudForm, type CrudField } from '@open-mercato/ui/backend/CrudForm'
import { createCrud } from '@open-mercato/ui/backend/utils/crud'
import { useT } from '@open-mercato/shared/lib/i18n/context'

export default function CreateCareDocumentPage() {
  const t = useT()
  const fields = React.useMemo<CrudField[]>(() => [
    { id: 'title', label: t('opencare.care_documents.form.fields.title.label'), type: 'text', required: true },
    { id: 'care_recipient_id', label: t('opencare.care_documents.form.fields.care_recipient_id.label'), type: 'text', required: true },
    { id: 'attachment_id', label: t('opencare.care_documents.form.fields.attachment_id.label'), type: 'text', required: true },
  ], [t])
  const successRedirect = React.useMemo(
    () => `/backend/care_documents?flash=${encodeURIComponent(t('opencare.care_documents.form.flash.created'))}&type=success`,
    [t],
  )

  return (
    <Page>
      <PageBody>
        <CrudForm
          title={t('opencare.care_documents.form.create.title')}
          backHref="/backend/care_documents"
          entityId="opencare:care_document"
          fields={fields}
          submitLabel={t('opencare.care_documents.form.create.submit')}
          cancelHref="/backend/care_documents"
          successRedirect={successRedirect}
          onSubmit={async (vals) => { await createCrud('opencare/care_documents', vals) }}
        />
      </PageBody>
    </Page>
  )
}
