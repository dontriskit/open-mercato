"use client"
import * as React from 'react'
import { Page, PageBody } from '@open-mercato/ui/backend/Page'
import { CrudForm, type CrudField } from '@open-mercato/ui/backend/CrudForm'
import { createCrud } from '@open-mercato/ui/backend/utils/crud'
import { useT } from '@open-mercato/shared/lib/i18n/context'

export default function CreateCareSettingPage() {
  const t = useT()
  const fields = React.useMemo<CrudField[]>(() => [
    { id: 'name', label: t('opencare.care_settings.form.fields.name.label'), type: 'text', required: true },
    { id: 'kind', label: t('opencare.care_settings.form.fields.kind.label'), type: 'select', required: true, options: [
      { value: 'home', label: t('opencare.care_settings.kind.home') },
      { value: 'residential', label: t('opencare.care_settings.kind.residential') },
      { value: 'clinic', label: t('opencare.care_settings.kind.clinic') },
    ] },
  ], [t])
  const successRedirect = React.useMemo(
    () => `/backend/care_settings?flash=${encodeURIComponent(t('opencare.care_settings.form.flash.created'))}&type=success`,
    [t],
  )

  return (
    <Page>
      <PageBody>
        <CrudForm
          title={t('opencare.care_settings.form.create.title')}
          backHref="/backend/care_settings"
          entityId="opencare:care_setting"
          fields={fields}
          submitLabel={t('opencare.care_settings.form.create.submit')}
          cancelHref="/backend/care_settings"
          successRedirect={successRedirect}
          onSubmit={async (vals) => { await createCrud('opencare/care_settings', vals) }}
        />
      </PageBody>
    </Page>
  )
}
