"use client"
import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Page, PageBody } from '@open-mercato/ui/backend/Page'
import { CrudForm, type CrudField, type CrudFormGroup } from '@open-mercato/ui/backend/CrudForm'
import { ErrorMessage, RecordNotFoundState } from '@open-mercato/ui/backend/detail'
import { fetchCrudList, updateCrud, deleteCrud } from '@open-mercato/ui/backend/utils/crud'
import { pushWithFlash } from '@open-mercato/ui/backend/utils/flash'
import type { CareEpisodeListItem } from '../../../../types'
import { useT } from '@open-mercato/shared/lib/i18n/context'

type FormValues = {
  id: string
  care_recipient_id: string
  care_setting_id: string
  responsible_staff_id: string
  started_at: string
  ended_at: string
  diagnosis_summary: string
}

export default function EditCareEpisodePage({ params }: { params?: { id?: string } }) {
  const t = useT()
  const router = useRouter()
  const id = params?.id
  const [initial, setInitial] = React.useState<FormValues | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [err, setErr] = React.useState<string | null>(null)
  const [isNotFound, setIsNotFound] = React.useState(false)

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
    () => `/backend/care_episodes?flash=${encodeURIComponent(t('opencare.care_episodes.form.flash.saved'))}&type=success`,
    [t],
  )

  React.useEffect(() => {
    let cancelled = false
    async function load() {
      if (!id) return
      setLoading(true)
      setErr(null)
      setIsNotFound(false)
      try {
        const data = await fetchCrudList<CareEpisodeListItem>('opencare/care_episodes', { ids: String(id), pageSize: 1 })
        const item = data?.items?.[0]
        if (!item) {
          if (!cancelled) setIsNotFound(true)
          return
        }
        const init: FormValues = {
          id: item.id,
          care_recipient_id: item.care_recipient_id ?? '',
          care_setting_id: item.care_setting_id ?? '',
          responsible_staff_id: item.responsible_staff_id ?? '',
          started_at: item.started_at ?? '',
          ended_at: item.ended_at ?? '',
          diagnosis_summary: item.diagnosis_summary ?? '',
        }
        if (!cancelled) setInitial(init)
      } catch (error: unknown) {
        if (!cancelled) {
          if ((error as { status?: number }).status === 404) {
            setIsNotFound(true)
          } else {
            const message = error instanceof Error && error.message ? error.message : t('opencare.care_episodes.form.error.load')
            setErr(message)
          }
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [id, t])

  const fallbackInitialValues = React.useMemo<FormValues>(() => ({
    id: id ?? '',
    care_recipient_id: '',
    care_setting_id: '',
    responsible_staff_id: '',
    started_at: '',
    ended_at: '',
    diagnosis_summary: '',
  }), [id])

  if (!id) return null

  if (isNotFound) {
    return (
      <Page>
        <PageBody>
          <RecordNotFoundState
            label={t('opencare.care_episodes.form.error.notFound')}
            backHref="/backend/care_episodes"
            backLabel={t('opencare.care_episodes.form.actions.backToList')}
          />
        </PageBody>
      </Page>
    )
  }

  return (
    <Page>
      <PageBody>
        {err ? (
          <ErrorMessage label={err} />
        ) : (
          <CrudForm<FormValues>
            title={t('opencare.care_episodes.form.edit.title')}
            backHref="/backend/care_episodes"
            entityId="opencare:care_episode"
            fields={fields}
            groups={groups}
            initialValues={initial ?? fallbackInitialValues}
            submitLabel={t('opencare.care_episodes.form.edit.submit')}
            cancelHref="/backend/care_episodes"
            successRedirect={successRedirect}
            isLoading={loading}
            loadingMessage={t('opencare.care_episodes.form.loading')}
            onSubmit={async (vals) => { await updateCrud('opencare/care_episodes', vals) }}
            onDelete={async () => {
              if (!id) return
              try {
                await deleteCrud('opencare/care_episodes', String(id))
                pushWithFlash(router, '/backend/care_episodes', t('opencare.care_episodes.form.flash.deleted'), 'success')
              } catch (error) {
                const message = error instanceof Error && error.message ? error.message : t('opencare.care_episodes.table.error.delete')
                setErr(message)
              }
            }}
          />
        )}
      </PageBody>
    </Page>
  )
}
