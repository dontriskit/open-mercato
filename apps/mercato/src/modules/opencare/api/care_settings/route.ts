/* eslint-disable @typescript-eslint/no-explicit-any */
import { z } from 'zod'
import { makeCrudRoute } from '@open-mercato/shared/lib/crud/factory'
import { CareSetting } from '../../data/entities'
import type { Where, WhereValue } from '@open-mercato/shared/lib/query/types'
import type { CareSettingListItem } from '../../types'

const ENTITY_ID = 'opencare:care_setting' as const

const querySchema = z
  .object({
    id: z.string().uuid().optional(),
    page: z.coerce.number().min(1).default(1),
    pageSize: z.coerce.number().min(1).max(100).default(50),
    ids: z.string().optional(),
    sortField: z.string().optional().default('name'),
    sortDir: z.enum(['asc', 'desc']).optional().default('asc'),
    name: z.string().optional(),
    withDeleted: z.coerce.boolean().optional().default(false),
    organizationId: z.string().uuid().optional(),
    createdFrom: z.string().optional(),
    createdTo: z.string().optional(),
    format: z.enum(['json', 'csv']).optional(),
  })
  .passthrough()

const rawBodySchema = z.object({}).passthrough()

type Query = z.infer<typeof querySchema>

const listFields = ['id', 'name', 'kind', 'tenant_id', 'organization_id', 'created_at']

const sortFieldMap: Record<string, unknown> = {
  id: 'id',
  name: 'name',
  kind: 'kind',
  created_at: 'created_at',
}

type BaseFields = {
  id: string
  name: string
  kind: string
  tenant_id: string | null
  organization_id: string | null
  created_at: Date
}

export const { metadata, GET, POST, PUT, DELETE } = makeCrudRoute({
  metadata: {
    GET: { requireAuth: true, requireFeatures: ['opencare.care_settings.view'] },
    POST: { requireAuth: true, requireFeatures: ['opencare.care_settings.manage'] },
    PUT: { requireAuth: true, requireFeatures: ['opencare.care_settings.manage'] },
    DELETE: { requireAuth: true, requireFeatures: ['opencare.care_settings.manage'] },
  },
  orm: {
    entity: CareSetting,
    idField: 'id',
    orgField: 'organizationId',
    tenantField: 'tenantId',
    softDeleteField: 'deletedAt',
  },
  events: { module: 'opencare', entity: 'care_setting', persistent: true },
  indexer: { entityType: ENTITY_ID },
  list: {
    schema: querySchema,
    entityId: ENTITY_ID,
    fields: listFields,
    sortFieldMap,
    buildFilters: async (q: Query): Promise<Where<BaseFields>> => {
      const filters: Where<BaseFields> = {}
      const F = filters as Record<string, WhereValue>
      if (q.ids) {
        const ids = q.ids.split(',').map((v) => v.trim()).filter((v) => v.length > 0)
        if (ids.length > 0) F.id = { $in: ids }
      }
      if (q.id) F.id = q.id
      if (q.name) F.name = { $ilike: `%${q.name}%` }
      if (q.organizationId) F.organization_id = q.organizationId
      if (q.createdFrom || q.createdTo) {
        const range: { $gte?: Date; $lte?: Date } = {}
        if (q.createdFrom) range.$gte = new Date(q.createdFrom)
        if (q.createdTo) range.$lte = new Date(q.createdTo)
        F.created_at = range
      }
      return filters
    },
    transformItem: (item: BaseFields): CareSettingListItem => ({
      id: String(item.id),
      name: String(item.name),
      kind: String(item.kind),
      tenant_id: (item.tenant_id as string | null) ?? null,
      organization_id: (item.organization_id as string | null) ?? null,
    }),
    allowCsv: true,
    csv: {
      headers: ['id', 'name', 'kind', 'organization_id', 'tenant_id'],
      row: (t: CareSettingListItem) => [t.id, t.name, t.kind, t.organization_id ?? '', t.tenant_id ?? ''],
      filename: 'care_settings.csv',
    },
  },
  actions: {
    create: {
      commandId: 'opencare.care_settings.create',
      schema: rawBodySchema,
      mapInput: ({ parsed }) => parsed,
      response: ({ result }) => ({ id: String(result.id) }),
      status: 201,
    },
    update: {
      commandId: 'opencare.care_settings.update',
      schema: rawBodySchema,
      mapInput: ({ parsed }) => parsed,
      response: () => ({ ok: true }),
    },
    delete: {
      commandId: 'opencare.care_settings.delete',
      response: () => ({ ok: true }),
    },
  },
})
