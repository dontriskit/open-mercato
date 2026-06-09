"use client"
import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Page, PageBody } from '@open-mercato/ui/backend/Page'
import { CrudForm, type CrudField, type CrudFormGroup } from '@open-mercato/ui/backend/CrudForm'
import { ErrorMessage, RecordNotFoundState } from '@open-mercato/ui/backend/detail'
import { fetchCrudList, updateCrud, deleteCrud } from '@open-mercato/ui/backend/utils/crud'
import { pushWithFlash } from '@open-mercato/ui/backend/utils/flash'
import type { ConsentRecordListItem } from '../../../../types'
import { useT } from '@open-mercato/shared/lib/i18n/context'

type FormValues = {
  id: string
  care_recipient_id: string
  consent_type: string
  lawful_basis: string
  jurisdiction: string
  granted: boolean
  granted_by: string
  evidence_attachment_id: string
  granted_at: string
  expires_at: string
  revoked_at: string
}

export default function EditConsentRecordPage({ params }: { params?: { id?: string } }) {
  const t = useT()
  const router = useRouter()
  const id = params?.id
  const [initial, setInitial] = React.useState<FormValues | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [err, setErr] = React.useState<string | null>(null)
  const [isNotFound, setIsNotFound] = React.useState(false)

  const fields = React.useMemo<CrudField[]>(() => [
    { id: 'care_recipient_id', label: t('opencare.consent_records.form.fields.care_recipient_id.label'), type: 'text', required: true },
    { id: 'consent_type', label: t('opencare.consent_records.form.fields.consent_type.label'), type: 'text', required: true },
    { id: 'lawful_basis', label: t('opencare.consent_records.form.fields.lawful_basis.label'), type: 'text', required: true },
    { id: 'jurisdiction', label: t('opencare.consent_records.form.fields.jurisdiction.label'), type: 'text', required: true },
    { id: 'granted', label: t('opencare.consent_records.form.fields.granted.label'), type: 'checkbox' },
    { id: 'granted_by', label: t('opencare.consent_records.form.fields.granted_by.label'), type: 'text' },
    { id: 'evidence_attachment_id', label: t('opencare.consent_records.form.fields.evidence_attachment_id.label'), type: 'text' },
    { id: 'granted_at', label: t('opencare.consent_records.form.fields.granted_at.label'), type: 'text' },
    { id: 'expires_at', label: t('opencare.consent_records.form.fields.expires_at.label'), type: 'text' },
    { id: 'revoked_at', label: t('opencare.consent_records.form.fields.revoked_at.label'), type: 'text' },
  ], [t])
  const groups = React.useMemo<CrudFormGroup[]>(() => [
    { id: 'consent', title: t('opencare.consent_records.form.groups.consent'), column: 1, fields: ['care_recipient_id', 'consent_type', 'lawful_basis', 'jurisdiction', 'granted'] },
    { id: 'evidence', title: t('opencare.consent_records.form.groups.evidence'), column: 2, fields: ['granted_by', 'evidence_attachment_id', 'granted_at', 'expires_at', 'revoked_at'] },
  ], [t])
  const successRedirect = React.useMemo(
    () => `/backend/consent_records?flash=${encodeURIComponent(t('opencare.consent_records.form.flash.saved'))}&type=success`,
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
        const data = await fetchCrudList<ConsentRecordListItem>('opencare/consent_records', { ids: String(id), pageSize: 1 })
        const item = data?.items?.[0]
        if (!item) {
          if (!cancelled) setIsNotFound(true)
          return
        }
        const init: FormValues = {
          id: item.id,
          care_recipient_id: item.care_recipient_id ?? '',
          consent_type: item.consent_type ?? '',
          lawful_basis: item.lawful_basis ?? '',
          jurisdiction: item.jurisdiction ?? '',
          granted: Boolean(item.granted),
          granted_by: item.granted_by ?? '',
          evidence_attachment_id: item.evidence_attachment_id ?? '',
          granted_at: item.granted_at ?? '',
          expires_at: item.expires_at ?? '',
          revoked_at: item.revoked_at ?? '',
        }
        if (!cancelled) setInitial(init)
      } catch (error: unknown) {
        if (!cancelled) {
          if ((error as { status?: number }).status === 404) {
            setIsNotFound(true)
          } else {
            const message = error instanceof Error && error.message ? error.message : t('opencare.consent_records.form.error.load')
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
    consent_type: '',
    lawful_basis: '',
    jurisdiction: '',
    granted: false,
    granted_by: '',
    evidence_attachment_id: '',
    granted_at: '',
    expires_at: '',
    revoked_at: '',
  }), [id])

  if (!id) return null

  if (isNotFound) {
    return (
      <Page>
        <PageBody>
          <RecordNotFoundState
            label={t('opencare.consent_records.form.error.notFound')}
            backHref="/backend/consent_records"
            backLabel={t('opencare.consent_records.form.actions.backToList')}
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
            title={t('opencare.consent_records.form.edit.title')}
            backHref="/backend/consent_records"
            entityId="opencare:consent_record"
            fields={fields}
            groups={groups}
            initialValues={initial ?? fallbackInitialValues}
            submitLabel={t('opencare.consent_records.form.edit.submit')}
            cancelHref="/backend/consent_records"
            successRedirect={successRedirect}
            isLoading={loading}
            loadingMessage={t('opencare.consent_records.form.loading')}
            onSubmit={async (vals) => { await updateCrud('opencare/consent_records', vals) }}
            onDelete={async () => {
              if (!id) return
              try {
                await deleteCrud('opencare/consent_records', String(id))
                pushWithFlash(router, '/backend/consent_records', t('opencare.consent_records.form.flash.deleted'), 'success')
              } catch (error) {
                const message = error instanceof Error && error.message ? error.message : t('opencare.consent_records.table.error.delete')
                setErr(message)
              }
            }}
          />
        )}
      </PageBody>
    </Page>
  )
}
