"use client"
import * as React from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { ColumnDef, SortingState } from '@tanstack/react-table'
import type { CareRecipientListItem } from '../types'
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

type Row = CareRecipientListItem

type ListResponse = {
  items: CareRecipientListItem[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export default function CareRecipientsTable() {
  const t = useT()
  const router = useRouter()
  const queryClient = useQueryClient()
  const { confirm, ConfirmDialogElement } = useConfirmDialog()
  const [search, setSearch] = React.useState('')
  const [values, setValues] = React.useState<FilterValues>({})
  const [sorting, setSorting] = React.useState<SortingState>([{ id: 'display_name', desc: false }])
  const [page, setPage] = React.useState(1)
  const scopeVersion = useOrganizationScopeVersion()

  const columns = React.useMemo<ColumnDef<Row>[]>(() => [
    { accessorKey: 'display_name', header: t('opencare.care_recipients.table.column.display_name'), meta: { priority: 1 } },
    { accessorKey: 'national_id', header: t('opencare.care_recipients.table.column.national_id'), enableSorting: false, meta: { priority: 3 } },
    { accessorKey: 'primary_email', header: t('opencare.care_recipients.table.column.primary_email'), meta: { priority: 2 } },
    { accessorKey: 'phone', header: t('opencare.care_recipients.table.column.phone'), enableSorting: false, meta: { priority: 4 } },
    { accessorKey: 'date_of_birth', header: t('opencare.care_recipients.table.column.date_of_birth'), enableSorting: false, meta: { priority: 5 } },
  ], [t])

  const queryParams = React.useMemo(() => {
    const params = new URLSearchParams({
      page: page.toString(),
      pageSize: '50',
      sortField: sorting[0]?.id || 'display_name',
      sortDir: sorting[0]?.desc ? 'desc' : 'asc',
    })
    if (search) params.set('displayName', search)
    Object.entries(values).forEach(([k, v]) => {
      if (k === 'created_at' && v && typeof v === 'object') {
        const range = v as { from?: string; to?: string }
        if (range.from) params.set('createdFrom', range.from)
        if (range.to) params.set('createdTo', range.to)
      }
    })
    return params.toString()
  }, [page, sorting, search, values])

  const { data, isLoading, error } = useQuery<ListResponse>({
    queryKey: ['care_recipients', queryParams, scopeVersion],
    queryFn: async () => fetchCrudList<CareRecipientListItem>('opencare/care_recipients', Object.fromEntries(new URLSearchParams(queryParams))),
  })

  const handleSortingChange = (newSorting: SortingState) => {
    setSorting(newSorting)
    setPage(1)
  }

  if (error) {
    return <div className="text-sm text-destructive">{t('opencare.care_recipients.table.error.generic')}</div>
  }

  return (
    <>
      <DataTable
        title={t('opencare.care_recipients.table.title')}
        actions={(
          <Button asChild>
            <Link href="/backend/care_recipients/create">{t('opencare.care_recipients.table.actions.create')}</Link>
          </Button>
        )}
        columns={columns}
        data={data?.items ?? []}
        searchValue={search}
        onSearchChange={(v) => { setSearch(v); setPage(1) }}
        searchAlign="right"
        filters={[
          { id: 'created_at', label: t('opencare.care_recipients.table.filters.createdAt'), type: 'dateRange' },
        ]}
        filterValues={values}
        onFiltersApply={(vals: FilterValues) => { setValues(vals); setPage(1) }}
        onFiltersClear={() => { setSearch(''); setValues({}); setPage(1) }}
        entityId="opencare:care_recipient"
        sortable
        sorting={sorting}
        onSortingChange={handleSortingChange}
        perspective={{ tableId: 'opencare.care_recipients.list' }}
        rowActions={(row) => (
          <RowActions
            items={[
              { label: t('opencare.care_recipients.table.actions.edit'), href: `/backend/care_recipients/${row.id}/edit` },
              {
                label: t('opencare.care_recipients.table.actions.delete'),
                destructive: true,
                onSelect: async () => {
                  const confirmed = await confirm({
                    title: t('opencare.care_recipients.table.confirm.delete'),
                    variant: 'destructive',
                  })
                  if (!confirmed) return
                  try {
                    await deleteCrud('opencare/care_recipients', row.id)
                    flash(t('opencare.care_recipients.form.flash.deleted'), 'success')
                    queryClient.invalidateQueries({ queryKey: ['care_recipients'] })
                  } catch (err) {
                    const message = err instanceof Error && err.message ? err.message : t('opencare.care_recipients.table.error.delete')
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
        onRowClick={(row) => router.push(`/backend/care_recipients/${row.id}/edit`)}
      />
      {ConfirmDialogElement}
    </>
  )
}
