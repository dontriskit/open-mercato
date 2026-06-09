"use client"
import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Page, PageBody } from '@open-mercato/ui/backend/Page'
import { CrudForm, type CrudField } from '@open-mercato/ui/backend/CrudForm'
import { ErrorMessage, RecordNotFoundState } from '@open-mercato/ui/backend/detail'
import { fetchCrudList, updateCrud, deleteCrud } from '@open-mercato/ui/backend/utils/crud'
import { pushWithFlash } from '@open-mercato/ui/backend/utils/flash'
import type { CareDocumentListItem } from '../../../../types'
import { useT } from '@open-mercato/shared/lib/i18n/context'

type FormValues = {
  id: string
  care_recipient_id: string
  attachment_id: string
  title: string
}

export default function EditCareDocumentPage({ params }: { params?: { id?: string } }) {
  const t = useT()
  const router = useRouter()
  const id = params?.id
  const [initial, setInitial] = React.useState<FormValues | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [err, setErr] = React.useState<string | null>(null)
  const [isNotFound, setIsNotFound] = React.useState(false)

  const fields = React.useMemo<CrudField[]>(() => [
    { id: 'title', label: t('opencare.care_documents.form.fields.title.label'), type: 'text', required: true },
    { id: 'care_recipient_id', label: t('opencare.care_documents.form.fields.care_recipient_id.label'), type: 'text', required: true },
    { id: 'attachment_id', label: t('opencare.care_documents.form.fields.attachment_id.label'), type: 'text', required: true },
  ], [t])
  const successRedirect = React.useMemo(
    () => `/backend/care_documents?flash=${encodeURIComponent(t('opencare.care_documents.form.flash.saved'))}&type=success`,
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
        const data = await fetchCrudList<CareDocumentListItem>('opencare/care_documents', { ids: String(id), pageSize: 1 })
        const item = data?.items?.[0]
        if (!item) {
          if (!cancelled) setIsNotFound(true)
          return
        }
        const init: FormValues = {
          id: item.id,
          care_recipient_id: item.care_recipient_id ?? '',
          attachment_id: item.attachment_id ?? '',
          title: item.title ?? '',
        }
        if (!cancelled) setInitial(init)
      } catch (error: unknown) {
        if (!cancelled) {
          if ((error as { status?: number }).status === 404) {
            setIsNotFound(true)
          } else {
            const message = error instanceof Error && error.message ? error.message : t('opencare.care_documents.form.error.load')
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
    attachment_id: '',
    title: '',
  }), [id])

  if (!id) return null

  if (isNotFound) {
    return (
      <Page>
        <PageBody>
          <RecordNotFoundState
            label={t('opencare.care_documents.form.error.notFound')}
            backHref="/backend/care_documents"
            backLabel={t('opencare.care_documents.form.actions.backToList')}
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
            title={t('opencare.care_documents.form.edit.title')}
            backHref="/backend/care_documents"
            entityId="opencare:care_document"
            fields={fields}
            initialValues={initial ?? fallbackInitialValues}
            submitLabel={t('opencare.care_documents.form.edit.submit')}
            cancelHref="/backend/care_documents"
            successRedirect={successRedirect}
            isLoading={loading}
            loadingMessage={t('opencare.care_documents.form.loading')}
            onSubmit={async (vals) => { await updateCrud('opencare/care_documents', vals) }}
            onDelete={async () => {
              if (!id) return
              try {
                await deleteCrud('opencare/care_documents', String(id))
                pushWithFlash(router, '/backend/care_documents', t('opencare.care_documents.form.flash.deleted'), 'success')
              } catch (error) {
                const message = error instanceof Error && error.message ? error.message : t('opencare.care_documents.table.error.delete')
                setErr(message)
              }
            }}
          />
        )}
      </PageBody>
    </Page>
  )
}
