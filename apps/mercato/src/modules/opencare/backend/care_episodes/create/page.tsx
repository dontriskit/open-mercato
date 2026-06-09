"use client"
import * as React from 'react'
import { Page, PageBody } from '@open-mercato/ui/backend/Page'
import { CrudForm, type CrudField, type CrudFormGroup } from '@open-mercato/ui/backend/CrudForm'
import { createCrud } from '@open-mercato/ui/backend/utils/crud'
import { useT } from '@open-mercato/shared/lib/i18n/context'

export default function CreateCareEpisodePage() {
  const t = useT()
  const fields = React.useMemo<CrudField[]>(() => [
    { id: 'care_recipient_id', label: t('opencare.care_episodes.form.fields.care_recipient_id.label'), type: 'text', required: true },
    { id: 'care_setting_id', label: t('opencare.care_episodes.form.fields.care_setting_id.label'), type: 'text', required: true },
    { id: 'responsible_staff_id', label: t('opencare.care_episodes.form.fields.responsible_staff_id.label'), type: 'text' },
    { id: 'started_at', label: t('opencare.care_episodes.form.fields.started_at.label'), type: 'text', required: true },
    { id: 'ended_at', label: t('opencare.care_episodes.form.fields.ended_at.label'), type: 'text' },
    { id: 'diagnosis_summary', label: t('opencare.care_episodes.form.fields.diagnosis_summary.label'), type: 'textarea' },
  ], [t])
  const groups = React.useMemo<CrudFormGroup[]>(() => [
    { id: 'links', title: t('opencare.care_episodes.form.groups.links'), column: 1, fields: ['care_recipient_id', 'care_setting_id', 'responsible_staff_id'] },
    { id: 'clinical', title: t('opencare.care_episodes.form.groups.clinical'), column: 2, fields: ['started_at', 'ended_at', 'diagnosis_summary'] },
  ], [t])
  const successRedirect = React.useMemo(
    () => `/backend/care_episodes?flash=${encodeURIComponent(t('opencare.care_episodes.form.flash.created'))}&type=success`,
    [t],
  )

  return (
    <Page>
      <PageBody>
        <CrudForm
          title={t('opencare.care_episodes.form.create.title')}
          backHref="/backend/care_episodes"
          entityId="opencare:care_episode"
          fields={fields}
          groups={groups}
          submitLabel={t('opencare.care_episodes.form.create.submit')}
          cancelHref="/backend/care_episodes"
          successRedirect={successRedirect}
          onSubmit={async (vals) => { await createCrud('opencare/care_episodes', vals) }}
        />
      </PageBody>
    </Page>
  )
}
