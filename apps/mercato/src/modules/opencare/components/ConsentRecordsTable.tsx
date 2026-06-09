"use client"
import * as React from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { ColumnDef, SortingState } from '@tanstack/react-table'
import type { ConsentRecordListItem } from '../types'
import { DataTable } from '@open-mercato/ui/backend/DataTable'
import { RowActions } from '@open-mercato/ui/backend/RowActions'
import type { FilterValues } from '@open-mercato/ui/backend/FilterBar'
import { Button } from '@open-mercato/ui/primitives/button'
import { fetchCrudList, deleteCrud } from '@open-mercato/ui/backend/utils/crud'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { useOrganizationScopeVersion } from '@open-mercato/shared/lib/frontend/useOrganizationScope'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { useConfirmDialog } from '@open-mercato/ui/backend/confirm-dialog'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

type Row = ConsentRecordListItem

type ListResponse = {
  items: ConsentRecordListItem[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export default function ConsentRecordsTable() {
  const t = useT()
  const router = useRouter()
  const queryClient = useQueryClient()
  const { confirm, ConfirmDialogElement } = useConfirmDialog()
  const [values, setValues] = React.useState<FilterValues>({})
  const [sorting, setSorting] = React.useState<SortingState>([{ id: 'created_at', desc: true }])
  const [page, setPage] = React.useState(1)
  const scopeVersion = useOrganizationScopeVersion()

  const columns = React.useMemo<ColumnDef<Row>[]>(() => [
    { accessorKey: 'consent_type', header: t('opencare.consent_records.table.column.consent_type'), meta: { priority: 1 } },
    { accessorKey: 'care_recipient_id', header: t('opencare.consent_records.table.column.care_recipient_id'), enableSorting: false, meta: { priority: 4 } },
    { accessorKey: 'lawful_basis', header: t('opencare.consent_records.table.column.lawful_basis'), enableSorting: false, meta: { priority: 2 } },
    { accessorKey: 'jurisdiction', header: t('opencare.consent_records.table.column.jurisdiction'), enableSorting: false, meta: { priority: 3 } },
    { accessorKey: 'granted', header: t('opencare.consent_records.table.column.granted'), enableSorting: false, meta: { priority: 5 }, cell: ({ getValue }) => (getValue() ? t('opencare.consent_records.value.yes') : t('opencare.consent_records.value.no')) },
  ], [t])

  const queryParams = React.useMemo(() => {
    const params = new URLSearchParams({
      page: page.toString(),
      pageSize: '50',
      sortField: sorting[0]?.id || 'created_at',
      sortDir: sorting[0]?.desc ? 'desc' : 'asc',
    })
    Object.entries(values).forEach(([k, v]) => {
      if (k === 'created_at' && v && typeof v === 'object') {
        const range = v as { from?: string; to?: string }
        if (range.from) params.set('createdFrom', range.from)
        if (range.to) params.set('createdTo', range.to)
      }
    })
    return params.toString()
  }, [page, sorting, values])

  const { data, isLoading, error } = useQuery<ListResponse>({
    queryKey: ['consent_records', queryParams, scopeVersion],
    queryFn: async () => fetchCrudList<ConsentRecordListItem>('opencare/consent_records', Object.fromEntries(new URLSearchParams(queryParams))),
  })

  const handleSortingChange = (newSorting: SortingState) => {
    setSorting(newSorting)
    setPage(1)
  }

  if (error) {
    return <div className="text-sm text-destructive">{t('opencare.consent_records.table.error.generic')}</div>
  }

  return (
    <>
      <DataTable
        title={t('opencare.consent_records.table.title')}
        actions={(
          <Button asChild>
            <Link href="/backend/consent_records/create">{t('opencare.consent_records.table.actions.create')}</Link>
          </Button>
        )}
        columns={columns}
        data={data?.items ?? []}
        filters={[
          { id: 'created_at', label: t('opencare.consent_records.table.filters.createdAt'), type: 'dateRange' },
        ]}
        filterValues={values}
        onFiltersApply={(vals: FilterValues) => { setValues(vals); setPage(1) }}
        onFiltersClear={() => { setValues({}); setPage(1) }}
        entityId="opencare:consent_record"
        sortable
        sorting={sorting}
        onSortingChange={handleSortingChange}
        perspective={{ tableId: 'opencare.consent_records.list' }}
        rowActions={(row) => (
          <RowActions
            items={[
              { label: t('opencare.consent_records.table.actions.edit'), href: `/backend/consent_records/${row.id}/edit` },
              {
                label: t('opencare.consent_records.table.actions.delete'),
                destructive: true,
                onSelect: async () => {
                  const confirmed = await confirm({
                    title: t('opencare.consent_records.table.confirm.delete'),
                    variant: 'destructive',
                  })
                  if (!confirmed) return
                  try {
                    await deleteCrud('opencare/consent_records', row.id)
                    flash(t('opencare.consent_records.form.flash.deleted'), 'success')
                    queryClient.invalidateQueries({ queryKey: ['consent_records'] })
                  } catch (err) {
                    const message = err instanceof Error && err.message ? err.message : t('opencare.consent_records.table.error.delete')
                    flash(message, 'error')
                  }
                },
              },
            ]}
          />
        )}
        pagination={{
          page,
          pageSize: 50,
          total: data?.total || 0,
          totalPages: data?.totalPages || 0,
          onPageChange: setPage,
        }}
        isLoading={isLoading}
        onRowClick={(row) => router.push(`/backend/consent_records/${row.id}/edit`)}
      />
      {ConfirmDialogElement}
    </>
  )
}
