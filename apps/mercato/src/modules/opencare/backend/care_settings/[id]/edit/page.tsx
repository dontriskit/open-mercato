"use client"
import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Page, PageBody } from '@open-mercato/ui/backend/Page'
import { CrudForm, type CrudField } from '@open-mercato/ui/backend/CrudForm'
import { ErrorMessage, RecordNotFoundState } from '@open-mercato/ui/backend/detail'
import { fetchCrudList, updateCrud, deleteCrud } from '@open-mercato/ui/backend/utils/crud'
import { pushWithFlash } from '@open-mercato/ui/backend/utils/flash'
import type { CareSettingListItem } from '../../../../types'
import { useT } from '@open-mercato/shared/lib/i18n/context'

type FormValues = {
  id: string
  name: string
  kind: string
}

export default function EditCareSettingPage({ params }: { params?: { id?: string } }) {
  const t = useT()
  const router = useRouter()
  const id = params?.id
  const [initial, setInitial] = React.useState<FormValues | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [err, setErr] = React.useState<string | null>(null)
  const [isNotFound, setIsNotFound] = React.useState(false)

  const fields = React.useMemo<CrudField[]>(() => [
    { id: 'name', label: t('opencare.care_settings.form.fields.name.label'), type: 'text', required: true },
    { id: 'kind', label: t('opencare.care_settings.form.fields.kind.label'), type: 'select', required: true, options: [
      { value: 'home', label: t('opencare.care_settings.kind.home') },
      { value: 'residential', label: t('opencare.care_settings.kind.residential') },
      { value: 'clinic', label: t('opencare.care_settings.kind.clinic') },
    ] },
  ], [t])
  const successRedirect = React.useMemo(
    () => `/backend/care_settings?flash=${encodeURIComponent(t('opencare.care_settings.form.flash.saved'))}&type=success`,
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
        const data = await fetchCrudList<CareSettingListItem>('opencare/care_settings', { ids: String(id), pageSize: 1 })
        const item = data?.items?.[0]
        if (!item) {
          if (!cancelled) setIsNotFound(true)
          return
        }
        const init: FormValues = { id: item.id, name: item.name ?? '', kind: item.kind ?? '' }
        if (!cancelled) setInitial(init)
      } catch (error: unknown) {
        if (!cancelled) {
          if ((error as { status?: number }).status === 404) {
            setIsNotFound(true)
          } else {
            const message = error instanceof Error && error.message ? error.message : t('opencare.care_settings.form.error.load')
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

  const fallbackInitialValues = React.useMemo<FormValues>(() => ({ id: id ?? '', name: '', kind: '' }), [id])

  if (!id) return null

  if (isNotFound) {
    return (
      <Page>
        <PageBody>
          <RecordNotFoundState
            label={t('opencare.care_settings.form.error.notFound')}
            backHref="/backend/care_settings"
            backLabel={t('opencare.care_settings.form.actions.backToList')}
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
            title={t('opencare.care_settings.form.edit.title')}
            backHref="/backend/care_settings"
            entityId="opencare:care_setting"
            fields={fields}
            initialValues={initial ?? fallbackInitialValues}
            submitLabel={t('opencare.care_settings.form.edit.submit')}
            cancelHref="/backend/care_settings"
            successRedirect={successRedirect}
            isLoading={loading}
            loadingMessage={t('opencare.care_settings.form.loading')}
            onSubmit={async (vals) => { await updateCrud('opencare/care_settings', vals) }}
            onDelete={async () => {
              if (!id) return
              try {
                await deleteCrud('opencare/care_settings', String(id))
                pushWithFlash(router, '/backend/care_settings', t('opencare.care_settings.form.flash.deleted'), 'success')
              } catch (error) {
                const message = error instanceof Error && error.message ? error.message : t('opencare.care_settings.table.error.delete')
                setErr(message)
              }
            }}
          />
        )}
      </PageBody>
    </Page>
  )
}
