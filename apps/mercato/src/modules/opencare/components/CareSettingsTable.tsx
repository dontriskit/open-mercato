"use client"
import * as React from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { ColumnDef, SortingState } from '@tanstack/react-table'
import type { CareSettingListItem } from '../types'
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

type Row = CareSettingListItem

type ListResponse = {
  items: CareSettingListItem[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export default function CareSettingsTable() {
  const t = useT()
  const router = useRouter()
  const queryClient = useQueryClient()
  const { confirm, ConfirmDialogElement } = useConfirmDialog()
  const [search, setSearch] = React.useState('')
  const [values, setValues] = React.useState<FilterValues>({})
  const [sorting, setSorting] = React.useState<SortingState>([{ id: 'name', desc: false }])
  const [page, setPage] = React.useState(1)
  const scopeVersion = useOrganizationScopeVersion()

  const columns = React.useMemo<ColumnDef<Row>[]>(() => [
    { accessorKey: 'name', header: t('opencare.care_settings.table.column.name'), meta: { priority: 1 } },
    { accessorKey: 'kind', header: t('opencare.care_settings.table.column.kind'), meta: { priority: 2 } },
  ], [t])

  const queryParams = React.useMemo(() => {
    const params = new URLSearchParams({
      page: page.toString(),
      pageSize: '50',
      sortField: sorting[0]?.id || 'name',
      sortDir: sorting[0]?.desc ? 'desc' : 'asc',
    })
    if (search) params.set('name', search)
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
    queryKey: ['care_settings', queryParams, scopeVersion],
    queryFn: async () => fetchCrudList<CareSettingListItem>('opencare/care_settings', Object.fromEntries(new URLSearchParams(queryParams))),
  })

  const handleSortingChange = (newSorting: SortingState) => {
    setSorting(newSorting)
    setPage(1)
  }

  if (error) {
    return <div className="text-sm text-destructive">{t('opencare.care_settings.table.error.generic')}</div>
  }

  return (
    <>
      <DataTable
        title={t('opencare.care_settings.table.title')}
        actions={(
          <Button asChild>
            <Link href="/backend/care_settings/create">{t('opencare.care_settings.table.actions.create')}</Link>
          </Button>
        )}
        columns={columns}
        data={data?.items ?? []}
        searchValue={search}
        onSearchChange={(v) => { setSearch(v); setPage(1) }}
        searchAlign="right"
        filters={[
          { id: 'created_at', label: t('opencare.care_settings.table.filters.createdAt'), type: 'dateRange' },
        ]}
        filterValues={values}
        onFiltersApply={(vals: FilterValues) => { setValues(vals); setPage(1) }}
        onFiltersClear={() => { setSearch(''); setValues({}); setPage(1) }}
        entityId="opencare:care_setting"
        sortable
        sorting={sorting}
        onSortingChange={handleSortingChange}
        perspective={{ tableId: 'opencare.care_settings.list' }}
        rowActions={(row) => (
          <RowActions
            items={[
              { label: t('opencare.care_settings.table.actions.edit'), href: `/backend/care_settings/${row.id}/edit` },
              {
                label: t('opencare.care_settings.table.actions.delete'),
                destructive: true,
                onSelect: async () => {
                  const confirmed = await confirm({
                    title: t('opencare.care_settings.table.confirm.delete'),
                    variant: 'destructive',
                  })
                  if (!confirmed) return
                  try {
                    await deleteCrud('opencare/care_settings', row.id)
                    flash(t('opencare.care_settings.form.flash.deleted'), 'success')
                    queryClient.invalidateQueries({ queryKey: ['care_settings'] })
                  } catch (err) {
                    const message = err instanceof Error && err.message ? err.message : t('opencare.care_settings.table.error.delete')
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
        onRowClick={(row) => router.push(`/backend/care_settings/${row.id}/edit`)}
      />
      {ConfirmDialogElement}
    </>
  )
}
