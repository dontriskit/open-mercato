"use client"
import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Page, PageBody } from '@open-mercato/ui/backend/Page'
import { CrudForm, type CrudField, type CrudFormGroup } from '@open-mercato/ui/backend/CrudForm'
import { ErrorMessage, RecordNotFoundState } from '@open-mercato/ui/backend/detail'
import { fetchCrudList, updateCrud, deleteCrud } from '@open-mercato/ui/backend/utils/crud'
import { pushWithFlash } from '@open-mercato/ui/backend/utils/flash'
import type { CareRecipientListItem } from '../../../../types'
import { useT } from '@open-mercato/shared/lib/i18n/context'

type FormValues = {
  id: string
  display_name: string
  national_id: string
  primary_email: string
  phone: string
  date_of_birth: string
  gdpr_legal_basis: string
}

export default function EditCareRecipientPage({ params }: { params?: { id?: string } }) {
  const t = useT()
  const router = useRouter()
  const id = params?.id
  const [initial, setInitial] = React.useState<FormValues | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [err, setErr] = React.useState<string | null>(null)
  const [isNotFound, setIsNotFound] = React.useState(false)

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
    () => `/backend/care_recipients?flash=${encodeURIComponent(t('opencare.care_recipients.form.flash.saved'))}&type=success`,
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
        const data = await fetchCrudList<CareRecipientListItem>('opencare/care_recipients', { ids: String(id), pageSize: 1 })
        const item = data?.items?.[0]
        if (!item) {
          if (!cancelled) setIsNotFound(true)
          return
        }
        const init: FormValues = {
          id: item.id,
          display_name: item.display_name ?? '',
          national_id: item.national_id ?? '',
          primary_email: item.primary_email ?? '',
          phone: item.phone ?? '',
          date_of_birth: item.date_of_birth ?? '',
          gdpr_legal_basis: item.gdpr_legal_basis ?? '',
        }
        if (!cancelled) setInitial(init)
      } catch (error: unknown) {
        if (!cancelled) {
          if ((error as { status?: number }).status === 404) {
            setIsNotFound(true)
          } else {
            const message = error instanceof Error && error.message ? error.message : t('opencare.care_recipients.form.error.load')
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
    display_name: '',
    national_id: '',
    primary_email: '',
    phone: '',
    date_of_birth: '',
    gdpr_legal_basis: '',
  }), [id])

  if (!id) return null

  if (isNotFound) {
    return (
      <Page>
        <PageBody>
          <RecordNotFoundState
            label={t('opencare.care_recipients.form.error.notFound')}
            backHref="/backend/care_recipients"
            backLabel={t('opencare.care_recipients.form.actions.backToList')}
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
            title={t('opencare.care_recipients.form.edit.title')}
            backHref="/backend/care_recipients"
            entityId="opencare:care_recipient"
            fields={fields}
            groups={groups}
            initialValues={initial ?? fallbackInitialValues}
            submitLabel={t('opencare.care_recipients.form.edit.submit')}
            cancelHref="/backend/care_recipients"
            successRedirect={successRedirect}
            isLoading={loading}
            loadingMessage={t('opencare.care_recipients.form.loading')}
            onSubmit={async (vals) => { await updateCrud('opencare/care_recipients', vals) }}
            onDelete={async () => {
              if (!id) return
              try {
                await deleteCrud('opencare/care_recipients', String(id))
                pushWithFlash(router, '/backend/care_recipients', t('opencare.care_recipients.form.flash.deleted'), 'success')
              } catch (error) {
                const message = error instanceof Error && error.message ? error.message : t('opencare.care_recipients.table.error.delete')
                setErr(message)
              }
            }}
          />
        )}
      </PageBody>
    </Page>
  )
}
