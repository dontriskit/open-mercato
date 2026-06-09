"use client"
import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Page, PageBody } from '@open-mercato/ui/backend/Page'
import { CrudForm, type CrudField } from '@open-mercato/ui/backend/CrudForm'
import { ErrorMessage, RecordNotFoundState } from '@open-mercato/ui/backend/detail'
import { fetchCrudList, updateCrud, deleteCrud } from '@open-mercato/ui/backend/utils/crud'
import { pushWithFlash } from '@open-mercato/ui/backend/utils/flash'
import type { CareNoteListItem } from '../../../../types'
import { useT } from '@open-mercato/shared/lib/i18n/context'

type FormValues = {
  id: string
  care_episode_id: string
  care_recipient_id: string
  body: string
  authored_by: string
}

export default function EditCareNotePage({ params }: { params?: { id?: string } }) {
  const t = useT()
  const router = useRouter()
  const id = params?.id
  const [initial, setInitial] = React.useState<FormValues | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [err, setErr] = React.useState<string | null>(null)
  const [isNotFound, setIsNotFound] = React.useState(false)

  const fields = React.useMemo<CrudField[]>(() => [
    { id: 'care_episode_id', label: t('opencare.care_notes.form.fields.care_episode_id.label'), type: 'text', required: true },
    { id: 'care_recipient_id', label: t('opencare.care_notes.form.fields.care_recipient_id.label'), type: 'text', required: true },
    { id: 'body', label: t('opencare.care_notes.form.fields.body.label'), type: 'textarea', required: true },
    { id: 'authored_by', label: t('opencare.care_notes.form.fields.authored_by.label'), type: 'text' },
  ], [t])
  const successRedirect = React.useMemo(
    () => `/backend/care_notes?flash=${encodeURIComponent(t('opencare.care_notes.form.flash.saved'))}&type=success`,
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
        const data = await fetchCrudList<CareNoteListItem>('opencare/care_notes', { ids: String(id), pageSize: 1 })
        const item = data?.items?.[0]
        if (!item) {
          if (!cancelled) setIsNotFound(true)
          return
        }
        const init: FormValues = {
          id: item.id,
          care_episode_id: item.care_episode_id ?? '',
          care_recipient_id: item.care_recipient_id ?? '',
          body: item.body ?? '',
          authored_by: item.authored_by ?? '',
        }
        if (!cancelled) setInitial(init)
      } catch (error: unknown) {
        if (!cancelled) {
          if ((error as { status?: number }).status === 404) {
            setIsNotFound(true)
          } else {
            const message = error instanceof Error && error.message ? error.message : t('opencare.care_notes.form.error.load')
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
    care_episode_id: '',
    care_recipient_id: '',
    body: '',
    authored_by: '',
  }), [id])

  if (!id) return null

  if (isNotFound) {
    return (
      <Page>
        <PageBody>
          <RecordNotFoundState
            label={t('opencare.care_notes.form.error.notFound')}
            backHref="/backend/care_notes"
            backLabel={t('opencare.care_notes.form.actions.backToList')}
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
            title={t('opencare.care_notes.form.edit.title')}
            backHref="/backend/care_notes"
            entityId="opencare:care_note"
            fields={fields}
            initialValues={initial ?? fallbackInitialValues}
            submitLabel={t('opencare.care_notes.form.edit.submit')}
            cancelHref="/backend/care_notes"
            successRedirect={successRedirect}
            isLoading={loading}
            loadingMessage={t('opencare.care_notes.form.loading')}
            onSubmit={async (vals) => { await updateCrud('opencare/care_notes', vals) }}
            onDelete={async () => {
              if (!id) return
              try {
                await deleteCrud('opencare/care_notes', String(id))
                pushWithFlash(router, '/backend/care_notes', t('opencare.care_notes.form.flash.deleted'), 'success')
              } catch (error) {
                const message = error instanceof Error && error.message ? error.message : t('opencare.care_notes.table.error.delete')
                setErr(message)
              }
            }}
          />
        )}
      </PageBody>
    </Page>
  )
}
